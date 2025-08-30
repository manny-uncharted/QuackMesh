from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select, delete
from ..db import get_session, Base, engine
from ..models import ProviderMachine
from ..schemas import ProviderRegisterRequest, ProviderListResponse, ProviderItem
from ..security import require_auth
from ..config import settings

# Ensure tables exist
if settings.enable_create_all:
    Base.metadata.create_all(bind=engine)

router = APIRouter(prefix="/provider", tags=["provider"]) 

@router.post("/register")
def register_provider(payload: ProviderRegisterRequest, _auth: dict = Depends(require_auth())):
    with get_session() as session:
        # upsert by machine_id
        stmt = select(ProviderMachine).where(ProviderMachine.machine_id == payload.machine_id)
        pm = session.execute(stmt).scalar_one_or_none()
        if pm:
            pm.provider_address = payload.provider_address
            pm.specs = payload.specs
            pm.endpoint = payload.endpoint
        else:
            pm = ProviderMachine(
                machine_id=payload.machine_id,
                provider_address=payload.provider_address,
                specs=payload.specs,
                endpoint=payload.endpoint,
            )
            session.add(pm)
        return {"status": "ok", "machine_id": payload.machine_id}

@router.get("/", response_model=ProviderListResponse)
def list_providers():
    with get_session() as session:
        stmt = select(ProviderMachine)
        items = [
            ProviderItem(
                machine_id=pm.machine_id,
                provider_address=pm.provider_address,
                specs=pm.specs,
                endpoint=pm.endpoint,
            )
            for pm in session.execute(stmt).scalars().all()
        ]
        return ProviderListResponse(providers=items)
