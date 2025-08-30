from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from ..db import get_session, Base, engine
from ..models import Dataset, DatasetUsage
from ..schemas import DatasetCreateRequest, DatasetResponse, DatasetUsageResponse
from ..security import require_auth
from ..config import settings
from typing import List, Optional
import json
import hashlib
from datetime import datetime
import os

# Ensure tables exist
if settings.enable_create_all:
    Base.metadata.create_all(bind=engine)

router = APIRouter(prefix="/datasets", tags=["datasets"])

@router.post("/upload", response_model=DatasetResponse)
async def upload_dataset(
    name: str = Form(...),
    description: str = Form(...),
    labels: str = Form(...),
    format: str = Form(...),
    file: Optional[UploadFile] = File(None),
    external_url: Optional[str] = Form(None),
    _auth: dict = Depends(require_auth())
):
    """Upload a dataset or register an external dataset"""
    
    if not file and not external_url:
        raise HTTPException(status_code=400, detail="Either file or external_url must be provided")
    
    with get_session() as session:
        # Calculate file hash for deduplication
        file_hash = None
        file_size = 0
        file_path = None
        
        if file:
            # Save uploaded file
            upload_dir = "uploads/datasets"
            os.makedirs(upload_dir, exist_ok=True)
            
            file_content = await file.read()
            file_hash = hashlib.sha256(file_content).hexdigest()
            file_size = len(file_content)
            file_path = f"{upload_dir}/{file_hash}_{file.filename}"
            
            with open(file_path, "wb") as f:
                f.write(file_content)
        
        # Check for duplicate
        if file_hash:
            existing = session.execute(
                select(Dataset).where(Dataset.file_hash == file_hash)
            ).scalar_one_or_none()
            
            if existing:
                raise HTTPException(status_code=409, detail="Dataset already exists")
        
        # Create dataset record
        dataset = Dataset(
            name=name,
            description=description,
            labels=labels.split(",") if labels else [],
            format=format,
            file_path=file_path,
            external_url=external_url,
            file_hash=file_hash,
            file_size=file_size,
            owner_address=_auth.get("address", "unknown"),
            created_at=datetime.utcnow()
        )
        
        session.add(dataset)
        session.flush()
        
        return DatasetResponse(
            id=dataset.id,
            name=dataset.name,
            description=dataset.description,
            labels=dataset.labels,
            format=dataset.format,
            file_size=dataset.file_size,
            owner_address=dataset.owner_address,
            created_at=dataset.created_at,
            usage_count=0,
            total_rewards=0.0
        )

@router.get("/", response_model=List[DatasetResponse])
def list_datasets(owner_address: Optional[str] = None, _auth: dict = Depends(require_auth())):
    """List datasets, optionally filtered by owner"""
    
    with get_session() as session:
        query = select(Dataset)
        if owner_address:
            query = query.where(Dataset.owner_address == owner_address)
        
        datasets = session.execute(query).scalars().all()
        
        result = []
        for dataset in datasets:
            # Get usage statistics
            usage_stats = session.execute(
                select(
                    func.count(DatasetUsage.id).label("usage_count"),
                    func.sum(DatasetUsage.reward_amount).label("total_rewards")
                ).where(DatasetUsage.dataset_id == dataset.id)
            ).first()
            
            result.append(DatasetResponse(
                id=dataset.id,
                name=dataset.name,
                description=dataset.description,
                labels=dataset.labels,
                format=dataset.format,
                file_size=dataset.file_size,
                owner_address=dataset.owner_address,
                created_at=dataset.created_at,
                usage_count=usage_stats.usage_count or 0,
                total_rewards=float(usage_stats.total_rewards or 0)
            ))
        
        return result

@router.get("/{dataset_id}", response_model=DatasetResponse)
def get_dataset(dataset_id: int, _auth: dict = Depends(require_auth())):
    """Get dataset details"""
    
    with get_session() as session:
        dataset = session.get(Dataset, dataset_id)
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        # Get usage statistics
        usage_stats = session.execute(
            select(
                func.count(DatasetUsage.id).label("usage_count"),
                func.sum(DatasetUsage.reward_amount).label("total_rewards")
            ).where(DatasetUsage.dataset_id == dataset_id)
        ).first()
        
        return DatasetResponse(
            id=dataset.id,
            name=dataset.name,
            description=dataset.description,
            labels=dataset.labels,
            format=dataset.format,
            file_size=dataset.file_size,
            owner_address=dataset.owner_address,
            created_at=dataset.created_at,
            usage_count=usage_stats.usage_count or 0,
            total_rewards=float(usage_stats.total_rewards or 0)
        )

@router.get("/{dataset_id}/usage", response_model=List[DatasetUsageResponse])
def get_dataset_usage(dataset_id: int, _auth: dict = Depends(require_auth())):
    """Get usage history for a dataset"""
    
    with get_session() as session:
        dataset = session.get(Dataset, dataset_id)
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        usage_records = session.execute(
            select(DatasetUsage).where(DatasetUsage.dataset_id == dataset_id)
            .order_by(DatasetUsage.used_at.desc())
        ).scalars().all()
        
        return [
            DatasetUsageResponse(
                id=usage.id,
                dataset_id=usage.dataset_id,
                job_id=usage.job_id,
                user_address=usage.user_address,
                reward_amount=usage.reward_amount,
                used_at=usage.used_at
            )
            for usage in usage_records
        ]

@router.post("/{dataset_id}/use")
def record_dataset_usage(
    dataset_id: int, 
    job_id: int,
    reward_amount: float = 0.0,
    _auth: dict = Depends(require_auth())
):
    """Record dataset usage and calculate rewards"""
    
    with get_session() as session:
        dataset = session.get(Dataset, dataset_id)
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
        
        # Record usage
        usage = DatasetUsage(
            dataset_id=dataset_id,
            job_id=job_id,
            user_address=_auth.get("address", "unknown"),
            reward_amount=reward_amount,
            used_at=datetime.utcnow()
        )
        
        session.add(usage)
        
        return {"status": "usage_recorded", "reward_amount": reward_amount}