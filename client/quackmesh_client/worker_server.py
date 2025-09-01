from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
import numpy as np
import requests
import os
import logging
import psutil
from typing import List, Optional
from collections import deque
import threading
import multiprocessing as mp
import time
import anyio
import torch
from torch import nn
from torch.utils.data import DataLoader
import torchvision
from torchvision import transforms
import base64
from cryptography.fernet import Fernet
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from tempfile import TemporaryDirectory
from datasets import load_dataset
import flwr as fl

from .data_pipeline import get_mnist_loaders, get_fake_mnist_loaders, get_text_classification_data

API_BASE = os.getenv("ORCHESTRATOR_API", "http://localhost:8000/api")
API_KEY = os.getenv("API_KEY")
CONTROL_KEY = os.getenv("WORKER_CONTROL_KEY")
DATA_DIR = os.getenv("DATA_DIR", "/tmp/data")
DATASET = os.getenv("DATASET", "FAKE").upper()  # FAKE (default) or MNIST
HF_TOKEN_DEC_KEY = os.getenv("HF_TOKEN_DEC_KEY") or os.getenv("HF_TOKEN_ENC_KEY")

# Logging
LOG_LEVEL = os.getenv("WORKER_LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.INFO))
logger = logging.getLogger("quackmesh.worker")

# In-memory log buffer and handler for /logs
LOG_BUFFER: deque[str] = deque(maxlen=500)

class _LogBufferHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        try:
            ts = record.asctime if hasattr(record, "asctime") else None
            msg = self.format(record) if self.formatter else record.getMessage()
            line = f"{msg}"
            LOG_BUFFER.append(line)
        except Exception:
            # best-effort
            pass

_log_handler = _LogBufferHandler()
_log_handler.setLevel(logging.INFO)
logger.addHandler(_log_handler)


def api_headers():
    return {"X-API-Key": API_KEY} if API_KEY else None


def build_model() -> nn.Module:
    # Simple MNIST MLP: 28*28 -> 128 -> 10
    return nn.Sequential(
        nn.Flatten(),
        nn.Linear(28 * 28, 128),
        nn.ReLU(),
        nn.Linear(128, 10),
    )


def serialize_weights(model: nn.Module) -> List[List[float]]:
    """Flatten each parameter tensor to a 1D float list."""
    weights: List[List[float]] = []
    with torch.no_grad():
        for _, tensor in model.state_dict().items():
            arr = tensor.detach().cpu().contiguous().view(-1).numpy().astype(np.float32)
            weights.append(arr.tolist())
    return weights


def load_weights_into_model(model: nn.Module, weights: List[List[float]]) -> bool:
    """Load flattened weights into model by reshaping to each param's shape.
    Returns True if successfully loaded (shapes match), else False.
    """
    state = model.state_dict()
    if len(weights) != len(state):
        return False
    new_state = {}
    with torch.no_grad():
        for (name, tensor), flat in zip(state.items(), weights):
            t = torch.tensor(flat, dtype=tensor.dtype)
            if t.numel() != tensor.numel():
                return False
            new_state[name] = t.view_as(tensor)
    model.load_state_dict(new_state)
    return True


def get_data_loaders(batch_size: int = 128) -> tuple[DataLoader, DataLoader]:
    if DATASET == "MNIST":
        return get_mnist_loaders(batch_size=batch_size)
    else:
        return get_fake_mnist_loaders(batch_size=batch_size)


def _collect_metrics() -> dict:
    try:
        cpu = float(psutil.cpu_percent(interval=0.1))
        mem = psutil.virtual_memory()
        ram_pct = float(mem.percent)
        net = psutil.net_io_counters()
        metrics = {
            "cpu": cpu,
            "ram_pct": ram_pct,
            "ram_gb": round(mem.total / (1024**3), 2),
            "net_bytes_sent": int(net.bytes_sent),
            "net_bytes_recv": int(net.bytes_recv),
            "gpu": 0,
        }
        return metrics
    except Exception:
        return {}


class TrainTask(BaseModel):
    job_id: int
    steps: int = 1


def create_app() -> FastAPI:
    app = FastAPI(title="QuackMesh Provider Worker")
    state = {
        "suspended": False,
        # job_id -> pid mapping for Flower client processes
        "flower_pids": {},  # dict[int,int]
    }

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.get("/info")
    def node_info():
        """Return detailed node information for discovery"""
        cpu_count = psutil.cpu_count(logical=True)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        return {
            "node_id": os.getenv("NODE_ID", "unknown"),
            "specs": {
                "cpu": cpu_count,
                "gpu": 0,  # TODO: Add GPU detection
                "ram_gb": round(memory.total / (1024**3), 2),
                "disk_gb": round(disk.total / (1024**3), 2),
            },
            "usage": {
                "cpu_percent": psutil.cpu_percent(interval=1),
                "memory_percent": memory.percent,
                "disk_percent": (disk.used / disk.total) * 100,
            },
            "capabilities": ["training", "inference"],
            "status": "online",
            "last_updated": time.time(),
        }

    @app.get("/peers")
    def get_peers():
        """Return known peer nodes for P2P discovery"""
        # This would be populated by the discovery system
        return {
            "peers": [],  # TODO: Implement peer discovery
            "node_id": os.getenv("NODE_ID", "unknown"),
        }

    @app.post("/task/train")
    def task_train(task: TrainTask):
        try:
            logger.info("train.start", extra={"job_id": task.job_id, "steps": task.steps})
            device = torch.device("cpu")

            # Try Hugging Face path first
            hf_meta = None
            try:
                logger.info("hf.meta.fetch", extra={"job_id": task.job_id})
                m = requests.get(f"{API_BASE}/job/{task.job_id}/hf_meta", headers=api_headers(), timeout=10)
                if m.status_code == 200:
                    hf_meta = m.json()
                    logger.info("hf.meta.ok", extra={"has_model": bool(hf_meta.get("huggingface_model_id")), "has_token": bool(hf_meta.get("token_enc_b64")), "dataset": hf_meta.get("huggingface_dataset_id")})
            except Exception:
                hf_meta = None

            if hf_meta and hf_meta.get("huggingface_model_id") and hf_meta.get("token_enc_b64"):
                # HF fine-tune minimal and push
                if not HF_TOKEN_DEC_KEY:
                    raise HTTPException(status_code=500, detail="HF_TOKEN_DEC_KEY not configured")
                try:
                    # Build Fernet from provided key (accept raw or needs base64)
                    try:
                        logger.info("hf.token.decrypt.begin")
                        f = Fernet(HF_TOKEN_DEC_KEY)
                    except Exception:
                        f = Fernet(base64.urlsafe_b64encode(HF_TOKEN_DEC_KEY.encode("utf-8")))
                    token_enc = base64.b64decode(hf_meta["token_enc_b64"])  # bytes
                    hf_token = f.decrypt(token_enc).decode("utf-8")
                    logger.info("hf.token.decrypt.ok")
                except Exception:
                    raise HTTPException(status_code=500, detail="Failed to decrypt HF token")

                model_id = hf_meta["huggingface_model_id"]
                hf_private = bool(hf_meta.get("hf_private", True))
                dataset_id = hf_meta.get("huggingface_dataset_id")

                # Tiny fine-tune on small subset (dataset if provided; else dummy texts)
                logger.info("hf.model.load.begin", extra={"model": model_id})
                tokenizer = AutoTokenizer.from_pretrained(model_id, use_auth_token=hf_token)
                model_hf = AutoModelForSequenceClassification.from_pretrained(model_id, use_auth_token=hf_token)
                logger.info("hf.model.load.ok", extra={"model": model_id})
                model_hf.train()
                optim = torch.optim.AdamW(model_hf.parameters(), lr=5e-5)
                texts = ["hello world", "quack mesh", "duck ai", "federated learning"]
                labels = torch.tensor([0, 1, 0, 1])

                # If dataset provided, try to load a tiny split
                if dataset_id:
                    try:
                        logger.info("hf.dataset.load.begin", extra={"dataset": dataset_id})
                        ds_train = load_dataset(dataset_id, split="train[:1%]", use_auth_token=hf_token)
                        # Heuristics to find text/label columns
                        text_cols = [c for c in ds_train.column_names if c.lower() in ("text", "sentence", "review", "content", "document")]
                        label_cols = [c for c in ds_train.column_names if c.lower() in ("label", "labels", "target", "class")]
                        tcol = text_cols[0] if text_cols else None
                        lcol = label_cols[0] if label_cols else None
                        if tcol and lcol:
                            # Build a small list to keep runtime bounded
                            texts = [ex[tcol] for ex in ds_train.select(range(min(64, len(ds_train))))]
                            raw_labels = [ex[lcol] for ex in ds_train.select(range(min(64, len(ds_train))))]
                            # Normalize labels to ints
                            if isinstance(raw_labels[0], (list, tuple)):
                                raw_labels = [int(x[0]) for x in raw_labels]
                            labels = torch.tensor([int(x) for x in raw_labels])
                        logger.info("hf.dataset.load.ok", extra={"dataset": dataset_id, "n_texts": len(texts)})
                    except Exception as e:
                        # Keep default dummy texts if dataset loading fails
                        logger.warning("hf.dataset.load.fail", extra={"dataset": dataset_id, "error": str(e)})
                steps = max(1, int(task.steps))
                steps_done = 0
                for t, y in zip(texts, labels):
                    enc = tokenizer(t, return_tensors="pt", padding=True, truncation=True, max_length=32)
                    optim.zero_grad(set_to_none=True)
                    out = model_hf(**enc, labels=torch.tensor([int(y.item())]))
                    loss = out.loss
                    loss.backward()
                    optim.step()
                    steps_done += 1
                    if steps_done % 5 == 0 or steps_done == steps:
                        logger.info("hf.train.step", extra={"step": steps_done, "loss": float(loss.item())})
                    if steps_done >= steps:
                        break

                # For validation proxy, just compute a dummy accuracy on same texts
                model_hf.eval()
                with torch.no_grad():
                    preds = []
                    for t in texts:
                        enc = tokenizer(t, return_tensors="pt", padding=True, truncation=True, max_length=32)
                        logits = model_hf(**enc).logits
                        preds.append(int(logits.argmax(dim=-1).item()))
                val_acc = float(100.0 * sum(p in (0, 1) for p in preds) / len(preds))

                # Submit HF model weights to orchestrator for FedAvg
                out_weights = serialize_weights(model_hf)
                logger.info("hf.update.submit.begin", extra={"job_id": task.job_id})
                r = requests.post(
                    f"{API_BASE}/job/{task.job_id}/update",
                    json={"weights": out_weights, "val_accuracy": val_acc},
                    headers=api_headers(),
                    timeout=30,
                )
                r.raise_for_status()
                logger.info("hf.update.submit.ok", extra={"status": r.status_code, "val_accuracy": val_acc})
                # Clear token from memory (best-effort)
                del hf_token
                return {"submitted": True, "val_accuracy": val_acc, "hf_model": model_id}

            # Default FedAvg MNIST path
            # Model and data
            model = build_model().to(device)

            # Fetch current global weights; if shapes mismatch, start fresh
            resp = requests.get(f"{API_BASE}/job/{task.job_id}/model", timeout=10)
            resp.raise_for_status()
            data = resp.json()
            server_weights = data.get("weights") or []
            if server_weights:
                try:
                    loaded = load_weights_into_model(model, server_weights)
                except Exception:
                    loaded = False
                if not loaded:
                    # Proceed with randomly initialized model
                    pass

            logger.info("mnist.data.load.begin", extra={"dataset": DATASET})
            train_loader, test_loader = get_data_loaders()
            logger.info("mnist.data.load.ok", extra={"dataset": DATASET})
            model.train()
            optimizer = torch.optim.SGD(model.parameters(), lr=0.01, momentum=0.9)
            criterion = nn.CrossEntropyLoss()

            # Train for `steps` mini-batches to keep runtime bounded
            steps = max(1, int(task.steps))
            batches_trained = 0
            logger.info("mnist.train.begin", extra={"steps": steps})
            for x, y in train_loader:
                x, y = x.to(device), y.to(device)
                optimizer.zero_grad(set_to_none=True)
                logits = model(x)
                loss = criterion(logits, y)
                loss.backward()
                optimizer.step()
                batches_trained += 1
                if batches_trained % 10 == 0 or batches_trained == steps:
                    logger.info("mnist.train.step", extra={"step": batches_trained, "loss": float(loss.item())})
                if batches_trained >= steps:
                    break

            # Quick validation on a limited subset for speed
            model.eval()
            correct = 0
            total = 0
            with torch.no_grad():
                for i, (x, y) in enumerate(test_loader):
                    x, y = x.to(device), y.to(device)
                    logits = model(x)
                    pred = logits.argmax(dim=1)
                    correct += (pred == y).sum().item()
                    total += y.size(0)
                    if total >= 2000:  # limit to ~2k samples for speed
                        break
            val_acc = float(100.0 * correct / max(1, total))

            # Serialize and submit update
            out_weights = serialize_weights(model)
            logger.info("mnist.update.submit.begin", extra={"job_id": task.job_id})
            r = requests.post(
                f"{API_BASE}/job/{task.job_id}/update",
                json={"weights": out_weights, "val_accuracy": val_acc},
                headers=api_headers(),
                timeout=30,
            )
            r.raise_for_status()
            logger.info("mnist.update.submit.ok", extra={"status": r.status_code, "val_accuracy": val_acc})
            return {"submitted": True, "val_accuracy": val_acc}
        except Exception as e:
            logger.exception("train.fail", extra={"job_id": getattr(task, "job_id", None)})
            raise HTTPException(status_code=502, detail=f"train failed: {e}")

    @app.get("/logs")
    def logs():
        return PlainTextResponse("\n".join(list(LOG_BUFFER)))

    class PushTask(BaseModel):
        job_id: int

    @app.post("/task/push_hf")
    def task_push_hf(task: PushTask):
        try:
            logger.info("push_hf.start", extra={"job_id": task.job_id})
            # Fetch HF meta
            m = requests.get(f"{API_BASE}/job/{task.job_id}/hf_meta", headers=api_headers(), timeout=10)
            m.raise_for_status()
            hf_meta = m.json()
            if not hf_meta.get("huggingface_model_id") or not hf_meta.get("token_enc_b64"):
                raise HTTPException(status_code=400, detail="HF meta missing model id or token")

            if not HF_TOKEN_DEC_KEY:
                raise HTTPException(status_code=500, detail="HF_TOKEN_DEC_KEY not configured")

            # Decrypt token
            logger.info("push_hf.token.decrypt.begin")
            try:
                try:
                    f = Fernet(HF_TOKEN_DEC_KEY)
                except Exception:
                    f = Fernet(base64.urlsafe_b64encode(HF_TOKEN_DEC_KEY.encode("utf-8")))
                token_enc = base64.b64decode(hf_meta["token_enc_b64"])  # bytes
                hf_token = f.decrypt(token_enc).decode("utf-8")
                logger.info("push_hf.token.decrypt.ok")
            except Exception:
                raise HTTPException(status_code=500, detail="Failed to decrypt HF token")

            model_id = hf_meta["huggingface_model_id"]
            hf_private = bool(hf_meta.get("hf_private", True))

            # Fetch aggregated weights from orchestrator
            logger.info("push_hf.model.fetch", extra={"job_id": task.job_id})
            resp = requests.get(f"{API_BASE}/job/{task.job_id}/model", headers=api_headers(), timeout=15)
            resp.raise_for_status()
            data = resp.json()
            weights = data.get("weights") or []
            if not weights:
                raise HTTPException(status_code=400, detail="No aggregated weights available for job")

            # Load base model and apply weights
            logger.info("push_hf.model.load.begin", extra={"model": model_id})
            model_hf = AutoModelForSequenceClassification.from_pretrained(model_id, use_auth_token=hf_token)
            ok = load_weights_into_model(model_hf, weights)
            if not ok:
                raise HTTPException(status_code=400, detail="Aggregated weights shape mismatch for HF model")

            # Push to Hub
            logger.info("push_hf.hub.push.begin", extra={"model": model_id, "private": hf_private})
            with TemporaryDirectory() as tmpd:
                model_hf.save_pretrained(tmpd)
                # Push via model API
                model_hf.push_to_hub(model_id, use_auth_token=hf_token, private=hf_private, commit_message="quackmesh aggregated push")
            logger.info("push_hf.hub.push.ok", extra={"model": model_id})

            # Clear token
            del hf_token
            return {"pushed": True, "hf_model": model_id}
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("push_hf.fail", extra={"job_id": getattr(task, "job_id", None)})
            raise HTTPException(status_code=502, detail=f"push_hf failed: {e}")

    class FlowerStartTask(BaseModel):
        job_id: int
        server_address: str  # host:port
        steps: int = 1

    def _hf_meta(job_id: int) -> Optional[dict]:
        try:
            m = requests.get(f"{API_BASE}/job/{job_id}/hf_meta", headers=api_headers(), timeout=10)
            if m.status_code == 200:
                return m.json()
        except Exception:
            return None
        return None

    def _decrypt_hf_token(token_enc_b64: str) -> str:
        if not HF_TOKEN_DEC_KEY:
            raise HTTPException(status_code=500, detail="HF_TOKEN_DEC_KEY not configured")
        try:
            try:
                f = Fernet(HF_TOKEN_DEC_KEY)
            except Exception:
                f = Fernet(base64.urlsafe_b64encode(HF_TOKEN_DEC_KEY.encode("utf-8")))
            token_enc = base64.b64decode(token_enc_b64)
            return f.decrypt(token_enc).decode("utf-8")
        except Exception:
            raise HTTPException(status_code=500, detail="Failed to decrypt HF token")

    def _build_model_for_job(job_id: int):
        """Build a model for the job: HF text classifier if configured, else MNIST MLP."""
        meta = _hf_meta(job_id)
        if meta and meta.get("huggingface_model_id") and meta.get("token_enc_b64"):
            token = _decrypt_hf_token(meta["token_enc_b64"])
            model_id = meta["huggingface_model_id"]
            tokenizer = AutoTokenizer.from_pretrained(model_id, use_auth_token=token)
            model = AutoModelForSequenceClassification.from_pretrained(model_id, use_auth_token=token)
            return {"type": "hf", "model": model, "tokenizer": tokenizer, "model_id": model_id, "hf_token": token, "dataset_id": meta.get("huggingface_dataset_id")}
        # default MNIST
        return {"type": "mnist", "model": build_model()}

    def _set_model_weights(model: nn.Module, weights: List[List[float]]):
        if not weights:
            return
        ok = load_weights_into_model(model, weights)
        if not ok:
            raise RuntimeError("Flower: weights shape mismatch")

    class _FlowerClient(fl.client.NumPyClient):
        def __init__(self, job_id: int, steps: int = 1):
            self.job_id = job_id
            self.steps = max(1, int(steps))
            info = _build_model_for_job(job_id)
            self.kind = info["type"]
            self.model = info["model"]
            self.hf_token = info.get("hf_token")
            self.tokenizer = info.get("tokenizer")
            self.dataset_id = info.get("dataset_id")

        def get_parameters(self, config):
            return [np.array(w, dtype=np.float32) for w in serialize_weights(self.model)]

        def fit(self, parameters, config):
            weights = [w.tolist() if isinstance(w, np.ndarray) else w for w in parameters]
            _set_model_weights(self.model, weights)
            if self.kind == "hf":
                texts, labels = get_text_classification_data(self.dataset_id, self.hf_token, max_examples=64)
                optim = torch.optim.AdamW(self.model.parameters(), lr=5e-5)
                self.model.train()
                steps_done = 0
                for t, y in zip(texts, labels):
                    enc = self.tokenizer(t, return_tensors="pt", padding=True, truncation=True, max_length=32)
                    optim.zero_grad(set_to_none=True)
                    out = self.model(**enc, labels=torch.tensor([int(y)]))
                    loss = out.loss
                    loss.backward()
                    optim.step()
                    steps_done += 1
                    if steps_done >= self.steps:
                        break
            else:
                train_loader, _ = get_data_loaders()
                optimizer = torch.optim.SGD(self.model.parameters(), lr=0.01, momentum=0.9)
                criterion = nn.CrossEntropyLoss()
                self.model.train()
                batches_trained = 0
                for x, y in train_loader:
                    optimizer.zero_grad(set_to_none=True)
                    logits = self.model(x)
                    loss = criterion(logits, y)
                    loss.backward()
                    optimizer.step()
                    batches_trained += 1
                    if batches_trained >= self.steps:
                        break
            new_params = [np.array(w, dtype=np.float32) for w in serialize_weights(self.model)]
            return new_params, self.steps, {}

        def evaluate(self, parameters, config):
            weights = [w.tolist() if isinstance(w, np.ndarray) else w for w in parameters]
            _set_model_weights(self.model, weights)
            if self.kind == "hf":
                texts, _ = get_text_classification_data(self.dataset_id, self.hf_token, max_examples=64)
                self.model.eval()
                with torch.no_grad():
                    preds = []
                    for t in texts:
                        enc = self.tokenizer(t, return_tensors="pt", padding=True, truncation=True, max_length=32)
                        logits = self.model(**enc).logits
                        preds.append(int(logits.argmax(dim=-1).item()))
                # dummy metric
                return float(0.0), len(texts), {"metric": 0.0}
            else:
                _, test_loader = get_data_loaders()
                self.model.eval()
                correct = 0
                total = 0
                with torch.no_grad():
                    for x, y in test_loader:
                        logits = self.model(x)
                        pred = logits.argmax(dim=1)
                        correct += (pred == y).sum().item()
                        total += y.size(0)
                        if total >= 2000:
                            break
                acc = float(100.0 * correct / max(1, total))
                return float(1.0 - acc / 100.0), total, {"val_accuracy": acc}

    @app.post("/task/flower/start")
    def task_flower_start(task: FlowerStartTask):
        try:
            logger.info("flower.client.start", extra={"job_id": task.job_id, "server": task.server_address, "steps": task.steps})
            client = _FlowerClient(job_id=task.job_id, steps=task.steps)

            def _run():
                try:
                    fl.client.start_numpy_client(server_address=task.server_address, client=client)
                except Exception:
                    logger.exception("flower.client.fail", extra={"job_id": task.job_id})

            proc = mp.Process(target=_run, daemon=True, name=f"flower-client-{task.job_id}")
            proc.start()
            # record pid for control ops
            try:
                state["flower_pids"][int(task.job_id)] = int(proc.pid)
            except Exception:
                pass
            return {"started": True, "pid": proc.pid}
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("flower.client.start.fail", extra={"job_id": getattr(task, "job_id", None)})
            raise HTTPException(status_code=502, detail=f"flower client start failed: {e}")

    @app.post("/control")
    def control(request: Request):
        try:
            body = request.json() if hasattr(request, "json") else None
        except Exception:
            body = None
        try:
            # FastAPI Request.json() is async; handle properly
            async def _read_json(req: Request):
                try:
                    return await req.json()
                except Exception:
                    return None
            body = anyio.run(_read_json, request)
        except Exception:
            pass

        if not isinstance(body, dict):
            body = {}
        action = str(body.get("action") or "").lower()

        # Optional control-key check
        if CONTROL_KEY:
            hdr_key = request.headers.get("X-Control-Key") or request.headers.get("x-control-key")
            if hdr_key != CONTROL_KEY:
                raise HTTPException(status_code=403, detail="invalid control key")

        if action not in {"start", "stop", "restart", "terminate"}:
            raise HTTPException(status_code=400, detail="unknown action")

        result: dict = {"action": action}

        try:
            if action == "start":
                state["suspended"] = False
                result["suspended"] = False
            elif action == "stop":
                state["suspended"] = True
                # best-effort: stop any flower client processes
                for jid, pid in list(state["flower_pids"].items()):
                    try:
                        p = psutil.Process(int(pid))
                        if p.is_running():
                            p.terminate()
                    except Exception:
                        pass
                result["suspended"] = True
            elif action == "restart":
                state["suspended"] = True
                # stop clients
                for jid, pid in list(state["flower_pids"].items()):
                    try:
                        p = psutil.Process(int(pid))
                        if p.is_running():
                            p.terminate()
                    except Exception:
                        pass
                # resume
                state["suspended"] = False
                result["suspended"] = False
            elif action == "terminate":
                # stop clients, then exit the worker process (supervisor may restart)
                for jid, pid in list(state["flower_pids"].items()):
                    try:
                        p = psutil.Process(int(pid))
                        if p.is_running():
                            p.terminate()
                    except Exception:
                        pass
                result["exiting"] = True
                # delayed hard-exit to allow response to flush
                def _die():
                    time.sleep(0.5)
                    os._exit(0)
                threading.Thread(target=_die, daemon=True).start()
            logger.info("control", extra={"action": action, "result": result})
            return {"ok": True, **result}
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("control.fail", extra={"action": action})
            raise HTTPException(status_code=500, detail=f"control failed: {e}")

    # Background heartbeat sender
    def _heartbeat_loop():
        base = os.getenv("ORCHESTRATOR_API", API_BASE)
        machine_id = os.getenv("MACHINE_ID")
        provider_address = os.getenv("PROVIDER_ADDRESS")
        endpoint = os.getenv("PROVIDER_ENDPOINT")
        if not machine_id or not provider_address:
            logger.info("heartbeat.disabled", extra={"reason": "missing MACHINE_ID or PROVIDER_ADDRESS"})
            return
        url = f"{base}/nodes/ping"
        while True:
            try:
                payload = {
                    "machine_id": int(machine_id),
                    "provider_address": provider_address,
                    "endpoint": endpoint,
                    # report offline when suspended
                    "status": "offline" if state.get("suspended") else "online",
                    "metrics": _collect_metrics(),
                }
                r = requests.post(url, json=payload, headers=api_headers(), timeout=5)
                if r.ok:
                    logger.info("heartbeat.ok", extra={"machine_id": machine_id})
                else:
                    logger.warning("heartbeat.fail", extra={"status": r.status_code})
            except Exception:
                logger.exception("heartbeat.error")
            finally:
                time.sleep(30)

    th = threading.Thread(target=_heartbeat_loop, daemon=True, name="heartbeat")
    th.start()

    return app
