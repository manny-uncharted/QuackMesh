from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select, delete
from ..schemas import ClusterResponse, ClusterAssignRequest, ProvisionRequest, ProvisionResult, RentAssignRequest, RentAssignResponse
from ..db import get_session
from ..models import ClusterNode, ProviderMachine
from ..security import require_auth
from ..services.cluster_manager import cluster_manager
from ..config import settings

router = APIRouter(prefix="/cluster", tags=["cluster"]) 

@router.get("/{job_id}", response_model=ClusterResponse)
def get_cluster(job_id: int):
    with get_session() as session:
        stmt = select(ClusterNode).where(ClusterNode.job_id == job_id)
        nodes = session.execute(stmt).scalars().all()
        endpoints = [n.endpoint for n in nodes]
        return ClusterResponse(job_id=job_id, nodes=endpoints)

@router.post("/assign", response_model=ClusterResponse)
def assign_cluster(payload: ClusterAssignRequest, _auth: dict = Depends(require_auth())):
    # If a renter address is provided, enforce that each machine was rented by that address recently
    if payload.renter_address:
        validated = cluster_manager.validate_rentals(payload.machine_ids, renter=payload.renter_address)
        missing = sorted(set(payload.machine_ids) - validated)
        if missing:
            raise HTTPException(status_code=400, detail=f"machine_ids not rented by {payload.renter_address}: {missing}")

    with get_session() as session:
        # clear previous assignment for this job
        session.execute(delete(ClusterNode).where(ClusterNode.job_id == payload.job_id))

        endpoints: list[str] = []
        for mid in payload.machine_ids:
            pm = session.execute(select(ProviderMachine).where(ProviderMachine.machine_id == mid)).scalar_one_or_none()
            if not pm:
                raise HTTPException(status_code=400, detail=f"machine_id {mid} not registered")
            if not pm.endpoint:
                raise HTTPException(status_code=400, detail=f"machine_id {mid} missing endpoint")
            node = ClusterNode(job_id=payload.job_id, machine_id=mid, endpoint=pm.endpoint)
            session.add(node)
            endpoints.append(pm.endpoint)
        return ClusterResponse(job_id=payload.job_id, nodes=endpoints)


@router.post("/rent_and_assign", response_model=RentAssignResponse)
def rent_and_assign(payload: RentAssignRequest, _auth: dict = Depends(require_auth())):
    # Gate insecure private-key flow for production safety
    if not settings.allow_insecure_rent_api:
        raise HTTPException(
            status_code=403,
            detail=(
                "rent_and_assign is disabled. Enable for dev with ALLOW_INSECURE_RENT_API=1, "
                "or rent on-chain client-side and use /api/cluster/assign with renter_address."
            ),
        )

    # Input validation
    if not payload.machine_ids:
        raise HTTPException(status_code=400, detail="machine_ids required")
    unique_mids = sorted(set(int(m) for m in payload.machine_ids))
    if len(unique_mids) != len(payload.machine_ids):
        # de-duplicate silently for safety
        payload.machine_ids = unique_mids
    try:
        hours = int(payload.hours)
    except Exception:
        raise HTTPException(status_code=400, detail="hours must be an integer")
    if hours <= 0 or hours > 720:
        raise HTTPException(status_code=400, detail="hours must be between 1 and 720")

    # 1) Rent machines on-chain using the renter's private key
    try:
        rent_result = cluster_manager.rent_machines(payload.machine_ids, hours, payload.renter_private_key)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"rent failed: {e}")

    renter_address = rent_result.get("renter_address")

    # Post-rent validation: ensure recent MachineRented events for renter and machines
    validated = cluster_manager.validate_rentals(payload.machine_ids, renter=renter_address)
    missing = sorted(set(payload.machine_ids) - validated)
    if missing:
        raise HTTPException(status_code=400, detail=f"rental validation failed for machine_ids: {missing}")

    # 2) Assign cluster endpoints for the job
    with get_session() as session:
        session.execute(delete(ClusterNode).where(ClusterNode.job_id == payload.job_id))

        endpoints: list[str] = []
        for mid in payload.machine_ids:
            pm = session.execute(select(ProviderMachine).where(ProviderMachine.machine_id == mid)).scalar_one_or_none()
            if not pm:
                raise HTTPException(status_code=400, detail=f"machine_id {mid} not registered")
            if not pm.endpoint:
                raise HTTPException(status_code=400, detail=f"machine_id {mid} missing endpoint")
            node = ClusterNode(job_id=payload.job_id, machine_id=mid, endpoint=pm.endpoint)
            session.add(node)
            endpoints.append(pm.endpoint)

    return RentAssignResponse(job_id=payload.job_id, nodes=endpoints, renter_address=renter_address)


@router.post("/provision", response_model=ProvisionResult)
def provision_cluster(payload: ProvisionRequest, _auth: dict = Depends(require_auth())):
    # Start worker containers on remote hosts and persist only healthy endpoints
    if not payload.hosts:
        raise HTTPException(status_code=400, detail="hosts required")

    try:
        result = cluster_manager.provision(
            payload.job_id,
            payload.hosts,
            payload.username,
            payload.key_path,
            image=payload.image,
            worker_port=int(payload.worker_port),
            env=payload.env,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"provision failed: {e}")

    results: dict[str, str] = result.get("results", {})  # per-host statuses
    nodes: list[str] = list(result.get("nodes", []))     # healthy endpoints

    # Persist cluster nodes to DB (replace existing for job)
    with get_session() as session:
        session.execute(delete(ClusterNode).where(ClusterNode.job_id == payload.job_id))
        for endpoint in nodes:
            session.add(ClusterNode(job_id=payload.job_id, machine_id=0, endpoint=endpoint))

    return ProvisionResult(job_id=payload.job_id, nodes=nodes, results=results)
