import os
import logging
from typing import List, Tuple, Optional

import torch
from torch.utils.data import DataLoader
import torchvision
from torchvision import transforms

from datasets import load_dataset
import json
import csv

logger = logging.getLogger("quackmesh.data")

DATA_DIR = os.getenv("DATA_DIR", "/tmp/data")


def get_mnist_loaders(batch_size: int = 128) -> Tuple[DataLoader, DataLoader]:
    tfm = transforms.Compose([transforms.ToTensor()])
    train_ds = torchvision.datasets.MNIST(root=DATA_DIR, train=True, download=True, transform=tfm)
    test_ds = torchvision.datasets.MNIST(root=DATA_DIR, train=False, download=True, transform=tfm)
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, num_workers=0)
    test_loader = DataLoader(test_ds, batch_size=batch_size, shuffle=False, num_workers=0)
    return train_loader, test_loader


def get_fake_mnist_loaders(batch_size: int = 128) -> Tuple[DataLoader, DataLoader]:
    tfm = transforms.Compose([transforms.ToTensor()])
    train_ds = torchvision.datasets.FakeData(size=10000, image_size=(1, 28, 28), num_classes=10, transform=tfm)
    test_ds = torchvision.datasets.FakeData(size=2000, image_size=(1, 28, 28), num_classes=10, transform=tfm)
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, num_workers=0)
    test_loader = DataLoader(test_ds, batch_size=batch_size, shuffle=False, num_workers=0)
    return train_loader, test_loader


def get_text_classification_data(dataset_id: Optional[str], hf_token: Optional[str], max_examples: int = 128) -> Tuple[List[str], List[int]]:
    texts: List[str] = ["hello world", "quack mesh", "duck ai", "federated learning"]
    labels: List[int] = [0, 1, 0, 1]
    # Local override via env vars
    local_path = os.getenv("TEXT_DATA_PATH")
    tcol = os.getenv("TEXT_COL")
    lcol = os.getenv("LABEL_COL")
    if local_path and tcol and lcol:
        try:
            return _load_local_text_data(local_path, tcol, lcol, max_examples)
        except Exception as e:
            logger.warning("local.text.load.fail", extra={"path": local_path, "error": str(e)})
    if not dataset_id:
        return texts, labels
    try:
        logger.info("hf.dataset.load", extra={"dataset": dataset_id})
        ds_train = load_dataset(dataset_id, split="train[:2%]", use_auth_token=hf_token)
        # Heuristics to find text/label columns
        text_cols = [c for c in ds_train.column_names if c.lower() in ("text", "sentence", "review", "content", "document")]
        label_cols = [c for c in ds_train.column_names if c.lower() in ("label", "labels", "target", "class")]
        tcol = text_cols[0] if text_cols else None
        lcol = label_cols[0] if label_cols else None
        if tcol and lcol:
            n = min(max_examples, len(ds_train))
            sub = ds_train.select(range(n))
            texts = [str(ex[tcol]) for ex in sub]
            raw_labels = [ex[lcol] for ex in sub]
            if isinstance(raw_labels[0], (list, tuple)):
                raw_labels = [int(x[0]) for x in raw_labels]
            labels = [int(x) for x in raw_labels]
    except Exception as e:
        logger.warning("hf.dataset.load.fail", extra={"dataset": dataset_id, "error": str(e)})
    return texts, labels


def _load_local_text_data(path: str, text_col: str, label_col: str, max_examples: int) -> Tuple[List[str], List[int]]:
    texts: List[str] = []
    labels: List[int] = []
    if path.lower().endswith(".jsonl") or path.lower().endswith(".ndjson"):
        with open(path, "r", encoding="utf-8") as f:
            for i, line in enumerate(f):
                if i >= max_examples:
                    break
                obj = json.loads(line)
                texts.append(str(obj[text_col]))
                labels.append(int(obj[label_col]))
    elif path.lower().endswith(".csv"):
        with open(path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader):
                if i >= max_examples:
                    break
                texts.append(str(row[text_col]))
                labels.append(int(row[label_col]))
    else:
        raise ValueError("Unsupported local text data format, must be .jsonl or .csv")
    return texts, labels
