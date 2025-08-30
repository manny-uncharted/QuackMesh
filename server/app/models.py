from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey, LargeBinary, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from .db import Base

class Job(Base):
    __tablename__ = "jobs"
    id = Column(Integer, primary_key=True, index=True)
    model_arch = Column(String, nullable=False)
    status = Column(String, default="created")
    reward_pool_duck = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    # Hugging Face integration
    huggingface_model_id = Column(String, nullable=True)
    huggingface_dataset_id = Column(String, nullable=True)
    hf_token_enc = Column(LargeBinary, nullable=True)
    hf_private = Column(String, default="true")  # use string "true"/"false" for simplicity

    updates = relationship("Update", back_populates="job")
    artifact = relationship("ModelArtifact", back_populates="job", uselist=False)

class Update(Base):
    __tablename__ = "updates"
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), index=True, nullable=False)
    weights = Column(JSON, nullable=True)  # list of lists (numpy arrays tolist()); nullable for HF jobs
    val_accuracy = Column(Float, default=0.0)
    contributor = Column(String, nullable=True)  # contributor wallet or id
    created_at = Column(DateTime, default=datetime.utcnow)

    job = relationship("Job", back_populates="updates")

class ModelArtifact(Base):
    __tablename__ = "model_artifacts"
    id = Column(Integer, primary_key=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), unique=True, index=True)
    weights = Column(JSON, nullable=False)  # latest global model weights
    updated_at = Column(DateTime, default=datetime.utcnow)

    job = relationship("Job", back_populates="artifact")

class ProviderMachine(Base):
    __tablename__ = "provider_machines"
    id = Column(Integer, primary_key=True)
    machine_id = Column(Integer, unique=True, index=True)  # on-chain machineId
    provider_address = Column(String, index=True)
    specs = Column(String)  # JSON string from chain
    endpoint = Column(String, nullable=True)  # e.g. host:port registered by provider
    created_at = Column(DateTime, default=datetime.utcnow)
    # Heartbeat/monitoring
    last_seen = Column(DateTime, nullable=True)
    status = Column(String, default="offline")  # offline|online|training
    metrics = Column(JSON, nullable=True)  # latest metrics snapshot (cpu, ram, gpu, net, etc.)
    # Marketplace listing metadata
    price_per_hour_wei = Column(String, nullable=True)
    listed = Column(Integer, default=0)

class ClusterNode(Base):
    __tablename__ = "cluster_nodes"
    id = Column(Integer, primary_key=True)
    job_id = Column(Integer, index=True)
    machine_id = Column(Integer, index=True)
    endpoint = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class NodeHeartbeat(Base):
    __tablename__ = "node_heartbeats"
    id = Column(Integer, primary_key=True)
    machine_id = Column(Integer, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="online")
    usage = Column(JSON, nullable=True)  # CPU, GPU, RAM usage
    metadata = Column(JSON, nullable=True)

class NodeLog(Base):
    __tablename__ = "node_logs"
    id = Column(Integer, primary_key=True)
    machine_id = Column(Integer, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    level = Column(String, default="INFO")
    message = Column(String)
    metadata = Column(JSON, nullable=True)

class Dataset(Base):
    __tablename__ = "datasets"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(String)
    labels = Column(JSON, nullable=True)  # List of labels/tags
    format = Column(String)  # CSV, JSON, Parquet, etc.
    file_path = Column(String, nullable=True)
    external_url = Column(String, nullable=True)
    file_hash = Column(String, unique=True, nullable=True)
    file_size = Column(Integer, default=0)
    owner_address = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class DatasetUsage(Base):
    __tablename__ = "dataset_usage"
    id = Column(Integer, primary_key=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), index=True)
    job_id = Column(Integer, nullable=True)
    user_address = Column(String, index=True)
    reward_amount = Column(Float, default=0.0)
    used_at = Column(DateTime, default=datetime.utcnow)

class MarketplaceListing(Base):
    __tablename__ = "marketplace_listings"
    id = Column(Integer, primary_key=True)
    machine_id = Column(Integer, unique=True, index=True)
    provider_address = Column(String, index=True)
    price_per_hour = Column(Float, nullable=False)
    availability = Column(String, default="available")  # available, rented, maintenance
    min_rental_hours = Column(Integer, default=1)
    max_rental_hours = Column(Integer, default=168)  # 1 week
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

class RentalHistory(Base):
    __tablename__ = "rental_history"
    id = Column(Integer, primary_key=True)
    machine_id = Column(Integer, index=True)
    renter_address = Column(String, index=True)
    provider_address = Column(String, index=True)
    hours_rented = Column(Integer, nullable=False)
    price_per_hour = Column(Float, nullable=False)
    total_cost = Column(Float, nullable=False)
    rental_start = Column(DateTime, default=datetime.utcnow)
    rental_end = Column(DateTime)
    status = Column(String, default="active")  # active, completed, cancelled


class Dataset(Base):
    __tablename__ = "datasets"
    id = Column(Integer, primary_key=True)
    owner_address = Column(String, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    uri = Column(String, nullable=False)  # e.g., HF repo, IPFS link, or storage URL
    size_bytes = Column(Integer, nullable=True)
    fmt = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
