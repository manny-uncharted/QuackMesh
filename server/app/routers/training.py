from fastapi import APIRouter, HTTPException, Depends
import logging
from pydantic import BaseModel
from sqlalchemy import select
import requests
from ..db import get_session
from ..models import ClusterNode, Job
from ..security import require_auth
from ..services.flower_server import start_flower_server, is_flower_running

router = APIRouter(prefix="/round", tags=["training"])
logger = logging.getLogger(__name__)

class RoundStartRequest(BaseModel):
    steps: int = 1
    timeout_s: int = 20

@router.post("/{job_id}/start")
def start_round(job_id: int, payload: RoundStartRequest, _auth: dict = Depends(require_auth(["round:start"]))):
    # Fetch cluster nodes
    with get_session() as session:
        nodes = [n.endpoint for n in session.execute(select(ClusterNode).where(ClusterNode.job_id == job_id)).scalars().all()]
    if not nodes:
        raise HTTPException(status_code=400, detail="No cluster nodes assigned for this job")

    # Mark job as running
    try:
        with get_session() as session:
            job = session.get(Job, job_id)
            if job:
                job.status = "running"
    except Exception:
        pass

    results: list[dict] = []
    for ep in nodes:
        url = f"http://{ep}/task/train"
        try:
            logger.info("round.start: calling worker", extra={"job_id": job_id, "endpoint": ep, "timeout_s": payload.timeout_s, "steps": payload.steps})
            r = requests.post(url, json={"job_id": job_id, "steps": payload.steps}, timeout=payload.timeout_s)
            ok = r.status_code == 200
            body = r.json() if ok else r.text
            results.append({"endpoint": ep, "status": r.status_code, "ok": ok, "body": body})
            logger.info("round.start: worker response", extra={"job_id": job_id, "endpoint": ep, "status": r.status_code, "ok": ok})
        except Exception as e:
            results.append({"endpoint": ep, "error": str(e)})
            logger.warning("round.start: worker call failed", extra={"job_id": job_id, "endpoint": ep, "error": str(e)})

    any_ok = any(item.get("ok") for item in results)
    if not any_ok:
        raise HTTPException(status_code=502, detail={"message": "All worker calls failed", "results": results})
    return {"job_id": job_id, "results": results}


class PushHfRequest(BaseModel):
    timeout_s: int = 60


@router.post("/{job_id}/push_hf")
def push_hf(job_id: int, payload: PushHfRequest = PushHfRequest(), _auth: dict = Depends(require_auth(["round:push"]))):
    # Fetch cluster nodes
    with get_session() as session:
        nodes = [n.endpoint for n in session.execute(select(ClusterNode).where(ClusterNode.job_id == job_id)).scalars().all()]
    if not nodes:
        raise HTTPException(status_code=400, detail="No cluster nodes assigned for this job")

    results: list[dict] = []
    # Try nodes in order until one succeeds, but also collect responses
    for ep in nodes:
        url = f"http://{ep}/task/push_hf"
        try:
            logger.info("round.push_hf: calling worker", extra={"job_id": job_id, "endpoint": ep, "timeout_s": payload.timeout_s})
            r = requests.post(url, json={"job_id": job_id}, timeout=payload.timeout_s)
            ok = r.status_code == 200
            body = r.json() if ok else r.text
            results.append({"endpoint": ep, "status": r.status_code, "ok": ok, "body": body})
            logger.info("round.push_hf: worker response", extra={"job_id": job_id, "endpoint": ep, "status": r.status_code, "ok": ok})
            # If one succeeded, we can stop early to avoid multiple pushes
            if ok:
                break
        except Exception as e:
            results.append({"endpoint": ep, "error": str(e)})
            logger.warning("round.push_hf: worker call failed", extra={"job_id": job_id, "endpoint": ep, "error": str(e)})

    any_ok = any(item.get("ok") for item in results)
    if not any_ok:
        raise HTTPException(status_code=502, detail={"message": "All worker push calls failed", "results": results})
    return {"job_id": job_id, "results": results}


class FlowerStartRequest(BaseModel):
    server_host: str = "0.0.0.0"
    server_port: int = 8089
    rounds: int = 1
    steps: int = 1
    client_timeout_s: int = 20


@router.post("/{job_id}/start_flower")
def start_flower(job_id: int, payload: FlowerStartRequest, _auth: dict = Depends(require_auth(["round:start"]))):
    # Fetch cluster nodes
    with get_session() as session:
        nodes = [n.endpoint for n in session.execute(select(ClusterNode).where(ClusterNode.job_id == job_id)).scalars().all()]
    if not nodes:
        raise HTTPException(status_code=400, detail="No cluster nodes assigned for this job")

    # Start Flower server in background
    # Bind host (inside container) vs client connect host (network reachable by workers)
    bind_host = payload.server_host
    client_host = (
        "server" if payload.server_host in ("0.0.0.0", "127.0.0.1", "localhost") else payload.server_host
    )
    srv = start_flower_server(job_id=job_id, host=bind_host, port=payload.server_port, rounds=payload.rounds)

    # Mark job as running
    try:
        with get_session() as session:
            job = session.get(Job, job_id)
            if job:
                job.status = "running"
    except Exception:
        pass

    # Instruct each node to start Flower client
    results: list[dict] = []
    address = f"{client_host}:{payload.server_port}"
    for ep in nodes:
        url = f"http://{ep}/task/flower/start"
        try:
            logger.info("round.flower: starting client", extra={"job_id": job_id, "endpoint": ep, "server": address, "steps": payload.steps})
            r = requests.post(url, json={"job_id": job_id, "server_address": address, "steps": payload.steps}, timeout=payload.client_timeout_s)
            ok = r.status_code == 200
            body = r.json() if ok else r.text
            results.append({"endpoint": ep, "status": r.status_code, "ok": ok, "body": body})
        except Exception as e:
            results.append({"endpoint": ep, "error": str(e)})
            logger.warning("round.flower: client start failed", extra={"job_id": job_id, "endpoint": ep, "error": str(e)})

    any_ok = any(item.get("ok") for item in results)
    if not any_ok:
        raise HTTPException(status_code=502, detail={"message": "All Flower client starts failed", "results": results})
    return {"job_id": job_id, "server": srv, "results": results}
