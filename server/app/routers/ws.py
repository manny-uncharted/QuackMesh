from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from typing import Any, Dict
import asyncio
import requests

from ..db import get_session
from ..models import ProviderMachine

router = APIRouter(tags=["websocket"]) 


async def _send_nodes_snapshot(ws: WebSocket):
    """Fetch nodes from DB and send as a NodeListResponse-like JSON."""
    with get_session() as session:
        stmt = select(ProviderMachine)
        items = []
        for pm in session.execute(stmt).scalars().all():
            # compute effective status similar to routers/nodes.py
            status = pm.status or "offline"
            if pm.last_seen:
                try:
                    from datetime import datetime, timedelta
                    delta = datetime.utcnow() - pm.last_seen
                    if delta.total_seconds() > 180:
                        status = "offline"
                except Exception:
                    pass
            items.append(
                {
                    "machine_id": pm.machine_id,
                    "provider_address": pm.provider_address,
                    "endpoint": pm.endpoint,
                    "status": status,
                    "last_seen": pm.last_seen.isoformat() if pm.last_seen else None,
                    "specs": pm.specs,
                    "metrics": pm.metrics,
                    "price_per_hour_wei": pm.price_per_hour_wei,
                    "listed": bool(pm.listed or 0),
                }
            )
        await ws.send_json({"nodes": items})


@router.websocket("/ws/nodes")
async def ws_nodes(websocket: WebSocket):
    await websocket.accept()
    try:
        # Send initial snapshot
        await _send_nodes_snapshot(websocket)
        # Periodic updates
        while True:
            await asyncio.sleep(2)
            await _send_nodes_snapshot(websocket)
    except WebSocketDisconnect:
        pass
    except Exception:
        # Best effort close
        try:
            await websocket.close()
        except Exception:
            pass


async def _send_logs_snapshot(ws: WebSocket, machine_id: int):
    lines: list[str] = []
    with get_session() as session:
        stmt = select(ProviderMachine).where(ProviderMachine.machine_id == machine_id)
        pm = session.execute(stmt).scalar_one_or_none()
        if pm and pm.endpoint:
            base = pm.endpoint.strip()
            if not base.startswith("http"):
                base = "http://" + base
            try:
                r = requests.get(f"{base}/logs", timeout=3)
                if r.status_code == 200 and isinstance(r.text, str):
                    text = r.text
                    lines = text.strip().splitlines()[-100:]
                else:
                    # fallback to /health
                    h = requests.get(f"{base}/health", timeout=3)
                    if h.ok:
                        lines = [f"health: {h.text}"]
            except Exception:
                # ignore failures
                pass
    await ws.send_json({"machine_id": machine_id, "logs": lines})


@router.websocket("/ws/nodes/{machine_id}/logs")
async def ws_node_logs(websocket: WebSocket, machine_id: int):
    await websocket.accept()
    try:
        # Stream logs periodically
        while True:
            await _send_logs_snapshot(websocket, machine_id)
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        pass
    except Exception:
        try:
            await websocket.close()
        except Exception:
            pass
