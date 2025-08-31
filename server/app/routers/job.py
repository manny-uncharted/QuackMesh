from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..db import get_session, Base, engine
from ..models import Job, ModelArtifact, Update
from ..schemas import CreateJobRequest, CreateJobResponse, ModelResponse, UpdateRequest, HfMetaResponse, JobStatusResponse
from ..services.fedavg import fedavg
from ..security import require_auth
from ..config import settings
from ..services.crypto import encrypt_token
import base64
from ..services.flower_server import is_flower_running

# Create tables if not exist
if settings.enable_create_all:
    Base.metadata.create_all(bind=engine)

router = APIRouter(prefix="/job", tags=["job"]) 

@router.post("/", response_model=CreateJobResponse)
def create_job(payload: CreateJobRequest, _auth: dict = Depends(require_auth(["job:create"]))):
    with get_session() as session:
        job = Job(
            model_arch=payload.model_arch,
            reward_pool_duck=payload.reward_pool_duck,
            huggingface_model_id=payload.huggingface_model_id,
            huggingface_dataset_id=payload.huggingface_dataset_id,
            hf_private=str(bool(payload.hf_private)).lower() if payload.hf_private is not None else "true",
        )
        # Encrypt HF token if provided
        if payload.huggingface_token:
            try:
                job.hf_token_enc = encrypt_token(payload.huggingface_token)
            except Exception as e:
                raise HTTPException(status_code=400, detail="HF token encryption failed; check server config")
        session.add(job)
        session.flush()
        weights = payload.initial_weights or []
        artifact = ModelArtifact(job_id=job.id, weights=weights)
        session.add(artifact)
        return CreateJobResponse(job_id=job.id)

@router.get("/{job_id}/model", response_model=ModelResponse)
def get_model(job_id: int):
    with get_session() as session:
        # Query by job_id since it's not the primary key
        stmt = select(ModelArtifact).where(ModelArtifact.job_id == job_id)
        artifact = session.execute(stmt).scalar_one_or_none()
        if artifact is None:
            raise HTTPException(status_code=404, detail="Model not found")
        return ModelResponse(job_id=job_id, weights=artifact.weights or [])

@router.get("/{job_id}/status", response_model=JobStatusResponse)
def get_job_status(job_id: int):
    with get_session() as session:
        job = session.get(Job, job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Job not found")
        stmt = select(ModelArtifact).where(ModelArtifact.job_id == job_id)
        artifact = session.execute(stmt).scalar_one_or_none()
        has_model = bool(artifact and artifact.weights and len(artifact.weights) > 0)
    return JobStatusResponse(job_id=job_id, status=job.status or "created", flower_running=is_flower_running(job_id), has_model=has_model)

@router.get("/{job_id}/hf_meta", response_model=HfMetaResponse)
def get_hf_meta(job_id: int, _auth: dict = Depends(require_auth(["job:read"]))):
    with get_session() as session:
        job = session.get(Job, job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Job not found")
        token_enc_b64 = base64.b64encode(job.hf_token_enc).decode("ascii") if job.hf_token_enc else None
        return HfMetaResponse(
            job_id=job_id,
            huggingface_model_id=job.huggingface_model_id,
            huggingface_dataset_id=job.huggingface_dataset_id,
            token_enc_b64=token_enc_b64,
            hf_private=(job.hf_private == "true") if job.hf_private is not None else True,
        )

@router.post("/{job_id}/update")
def submit_update(job_id: int, payload: UpdateRequest, _auth: dict = Depends(require_auth(["job:update"]))):
    with get_session() as session:
        job = session.get(Job, job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Job not found")
        upd = Update(job_id=job_id, weights=payload.weights, val_accuracy=payload.val_accuracy, contributor=payload.contributor)
        session.add(upd)
        session.flush()
        # Aggregate (filter out None weights for HF jobs)
        stmt = select(Update).where(Update.job_id == job_id)
        updates_all = session.execute(stmt).scalars().all()
        update_weights = [u.weights for u in updates_all if u.weights]
        if update_weights:
            new_weights = fedavg(update_weights)
            # upsert artifact
            stmt = select(ModelArtifact).where(ModelArtifact.job_id == job_id)
            artifact = session.execute(stmt).scalar_one_or_none()
            if artifact:
                artifact.weights = new_weights
            else:
                artifact = ModelArtifact(job_id=job_id, weights=new_weights)
                session.add(artifact)
        return {"status": "ok"}
