from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy import select, delete, update
from sqlalchemy.orm import Session
from ..db import get_session, Base, engine
from ..models import ProviderMachine, NodeHeartbeat, NodeLog
from ..schemas import NodeStatusResponse, NodeHeartbeatRequest, NodeControlRequest, NodePingRequest
from ..security import require_auth
from ..config import settings
from typing import List, Dict
import json
import asyncio
from datetime import datetime, timedelta
import logging
import requests

logger = logging.getLogger(__name__)

# Ensure tables exist
if settings.enable_create_all:
    Base.metadata.create_all(bind=engine)

router = APIRouter(prefix="/nodes", tags=["nodes"])

# WebSocket connections for real-time updates
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_text(message)
            except:
                self.disconnect(user_id)

    async def broadcast(self, message: str):
        disconnected = []
        for user_id, connection in self.active_connections.items():
            try:
                await connection.send_text(message)
            except:
                disconnected.append(user_id)
        
        for user_id in disconnected:
            self.disconnect(user_id)

manager = ConnectionManager()

# Helper to normalize worker endpoint (accepts host:port or full URL)
def _normalize_endpoint(ep: str) -> str:
    try:
        ep = (ep or "").strip()
        if not ep:
            return ep
        if ep.startswith("http://") or ep.startswith("https://"):
            return ep
        return f"http://{ep}"
    except Exception:
        return ep

@router.get("/", response_model=List[NodeStatusResponse])
def get_user_nodes(user_address: str = None, _auth: dict = Depends(require_auth())):
    """Fetch all nodes for a user with current status"""
    with get_session() as session:
        query = select(ProviderMachine)
        if user_address:
            query = query.where(ProviderMachine.provider_address == user_address)
        
        nodes = session.execute(query).scalars().all()
        
        result = []
        for node in nodes:
            # Get latest heartbeat
            heartbeat_query = select(NodeHeartbeat).where(
                NodeHeartbeat.machine_id == node.machine_id
            ).order_by(NodeHeartbeat.timestamp.desc()).limit(1)
            
            latest_heartbeat = session.execute(heartbeat_query).scalar_one_or_none()
            
            # Determine status based on heartbeat
            status = "offline"
            last_seen = None
            usage = {}
            
            if latest_heartbeat:
                last_seen = latest_heartbeat.timestamp
                time_diff = datetime.utcnow() - last_seen
                
                if time_diff < timedelta(minutes=5):
                    status = latest_heartbeat.status or "online"
                    usage = latest_heartbeat.usage or {}

            # Normalize usage keys for frontend expectations
            # frontend expects: cpu_percent, memory_percent, gpu_percent
            normalized_usage = {}
            try:
                if isinstance(usage, dict):
                    cpu_percent = usage.get("cpu_percent")
                    if cpu_percent is None:
                        cpu_percent = usage.get("cpu")  # worker metric name
                    normalized_usage["cpu_percent"] = cpu_percent or 0

                    mem_percent = usage.get("memory_percent")
                    if mem_percent is None:
                        mem_percent = usage.get("ram_pct")  # worker metric name
                    normalized_usage["memory_percent"] = mem_percent or 0

                    gpu_percent = usage.get("gpu_percent")
                    if gpu_percent is None:
                        # Some workers may report gpu as utilization percent; default 0
                        gpu_percent = usage.get("gpu")
                    normalized_usage["gpu_percent"] = gpu_percent or 0
            except Exception:
                normalized_usage = {}
            
            result.append(NodeStatusResponse(
                machine_id=node.machine_id,
                name=f"Node-{node.machine_id}",
                provider_address=node.provider_address,
                endpoint=node.endpoint,
                specs=json.loads(node.specs) if node.specs else {},
                status=status,
                last_seen=last_seen,
                usage=normalized_usage
            ))
        
        return result

@router.post("/ping")
async def node_heartbeat(heartbeat: NodePingRequest, _auth: dict = Depends(require_auth())):
    """Receive heartbeat from a node (worker NodePingRequest)."""
    with get_session() as session:
        # Verify node exists
        node = session.execute(
            select(ProviderMachine).where(ProviderMachine.machine_id == heartbeat.machine_id)
        ).scalar_one_or_none()
        
        if not node:
            # Auto-register provider machine on first heartbeat (upsert behavior)
            try:
                node = ProviderMachine(
                    machine_id=heartbeat.machine_id,
                    provider_address=heartbeat.provider_address,
                    specs=None,
                    endpoint=heartbeat.endpoint,
                )
                session.add(node)
            except Exception:
                # If creation fails, return a clear error
                raise HTTPException(status_code=400, detail="Failed to register node on heartbeat")
        
        # Create or update heartbeat record
        now = datetime.utcnow()
        new_heartbeat = NodeHeartbeat(
            machine_id=heartbeat.machine_id,
            timestamp=now,
            status=heartbeat.status or "online",
            usage=heartbeat.metrics,
            metadata_={
                "endpoint": heartbeat.endpoint,
                "provider_address": heartbeat.provider_address,
            },
        )
        session.add(new_heartbeat)
        # Update ProviderMachine cached fields
        try:
            node.last_seen = now
            if heartbeat.status:
                node.status = heartbeat.status
            if heartbeat.endpoint:
                node.endpoint = heartbeat.endpoint
            if heartbeat.metrics is not None:
                node.metrics = heartbeat.metrics
        except Exception:
            pass
        
        # Broadcast status update to connected clients (non-blocking)
        asyncio.create_task(manager.broadcast(json.dumps({
            "type": "node_status_update",
            "machine_id": heartbeat.machine_id,
            "status": heartbeat.status or "online",
            "usage": heartbeat.metrics,
            "timestamp": now.isoformat()
        })))
        
        return {"status": "ok", "timestamp": datetime.utcnow()}

@router.get("/{machine_id}/logs")
def get_node_logs(machine_id: int, limit: int = 100, _auth: dict = Depends(require_auth())):
    """Fetch logs for a specific node"""
    with get_session() as session:
        # Verify node exists and user has access
        node = session.execute(
            select(ProviderMachine).where(ProviderMachine.machine_id == machine_id)
        ).scalar_one_or_none()
        
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        # Fetch logs
        logs_query = select(NodeLog).where(
            NodeLog.machine_id == machine_id
        ).order_by(NodeLog.timestamp.desc()).limit(limit)
        
        logs = session.execute(logs_query).scalars().all()
        
        return {
            "machine_id": machine_id,
            "logs": [
                {
                    "timestamp": log.timestamp,
                    "level": log.level,
                    "message": log.message,
                    "metadata": log.metadata_
                }
                for log in logs
            ]
        }

@router.post("/{machine_id}/control")
def control_node(machine_id: int, control: NodeControlRequest, _auth: dict = Depends(require_auth())):
    """Send control commands to a node"""
    with get_session() as session:
        node = session.execute(
            select(ProviderMachine).where(ProviderMachine.machine_id == machine_id)
        ).scalar_one_or_none()
        
        if not node:
            raise HTTPException(status_code=404, detail="Node not found")
        
        # Basic health check for 'start' to verify worker is reachable.
        action_result: Dict | None = None
        if control.action == "start" and node.endpoint:
            try:
                ep = _normalize_endpoint(node.endpoint)
                r = requests.get(f"{ep}/health", timeout=5)
                action_result = {"reachable": bool(r.ok), "status": r.status_code}
            except Exception as e:
                action_result = {"reachable": False, "error": str(e)}

        # Forward control command to worker if endpoint available
        forward_result: Dict | None = None
        if node.endpoint and control.action in {"start", "stop", "restart", "terminate"}:
            headers = {}
            if settings.worker_control_key:
                headers["X-Control-Key"] = settings.worker_control_key
            try:
                ep = _normalize_endpoint(node.endpoint)
                resp = requests.post(
                    f"{ep}/control",
                    json={"action": control.action, "params": control.params or {}},
                    headers=headers or None,
                    timeout=7,
                )
                # best-effort parse
                try:
                    forward_result = resp.json()
                except Exception:
                    forward_result = {"ok": resp.ok, "status": resp.status_code, "text": resp.text[:200] if resp.text else None}
            except Exception as e:
                forward_result = {"ok": False, "error": str(e)}
        
        # Log the command
        log_entry = NodeLog(
            machine_id=machine_id,
            timestamp=datetime.utcnow(),
            level="INFO",
            message=f"Control command received: {control.action}",
            metadata_={"command": control.action, "params": control.params, "result": action_result, "forward": forward_result}
        )
        session.add(log_entry)
        
        return {"status": "command_sent", "action": control.action, "result": action_result, "forward": forward_result}

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    """WebSocket endpoint for real-time node updates"""
    await manager.connect(websocket, user_id)
    try:
        while True:
            # Keep connection alive and handle incoming messages
            data = await websocket.receive_text()
            # Echo back for now - could handle commands here
            await websocket.send_text(f"Echo: {data}")
    except WebSocketDisconnect:
        manager.disconnect(user_id)