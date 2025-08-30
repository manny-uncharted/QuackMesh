from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime

class CreateJobRequest(BaseModel):
    model_arch: str
    initial_weights: Optional[List[List[float]]] = None
    reward_pool_duck: float = 0.0
    # Hugging Face integration
    huggingface_model_id: Optional[str] = None
    huggingface_dataset_id: Optional[str] = None
    huggingface_token: Optional[str] = None  # plaintext from requester; will be encrypted server-side
    hf_private: bool = True

class CreateJobResponse(BaseModel):
    job_id: int

class ModelResponse(BaseModel):
    job_id: int
    weights: List[List[float]]

class HfMetaResponse(BaseModel):
    job_id: int
    huggingface_model_id: Optional[str] = None
    huggingface_dataset_id: Optional[str] = None
    token_enc_b64: Optional[str] = None
    hf_private: Optional[bool] = True

class UpdateRequest(BaseModel):
    weights: Optional[List[List[float]]] = None
    val_accuracy: float
    contributor: Optional[str] = None

class ClusterResponse(BaseModel):
    job_id: int
    nodes: List[str]

class ProviderRegisterRequest(BaseModel):
    machine_id: int
    provider_address: str
    specs: str  # JSON string
    endpoint: Optional[str] = None  # host:port

class ProviderItem(BaseModel):
    machine_id: int
    provider_address: str
    specs: str
    endpoint: Optional[str] = None

class ProviderListResponse(BaseModel):
    providers: List[ProviderItem]

class ClusterAssignRequest(BaseModel):
    job_id: int
    machine_ids: List[int]
    renter_address: Optional[str] = None


class RentAssignRequest(BaseModel):
    job_id: int
    machine_ids: List[int]
    hours: int = 1
    renter_private_key: str


class RentAssignResponse(BaseModel):
    job_id: int
    nodes: List[str]
    renter_address: str


class TokenIssueRequest(BaseModel):
    sub: str
    scopes: List[str] = []


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class ProvisionRequest(BaseModel):
    job_id: int
    hosts: List[str]
    username: str
    key_path: str
    image: str = "quackmesh-client:latest"
    worker_port: int = 9000
    env: Optional[Dict[str, str]] = None

class ProvisionResult(BaseModel):
    job_id: int
    nodes: List[str]
    results: Dict[str, str]

# Node Management Schemas
class NodeStatusResponse(BaseModel):
    machine_id: int
    name: str
    provider_address: str
    endpoint: Optional[str] = None
    specs: Dict
    status: str
    last_seen: Optional[datetime] = None
    usage: Dict = {}

class NodeHeartbeatRequest(BaseModel):
    machine_id: int
    status: str = "online"
    usage: Optional[Dict] = None
    metadata: Optional[Dict] = None

class NodeControlRequest(BaseModel):
    action: str  # restart, stop, terminate
    params: Optional[Dict] = None

# Dataset Schemas
class DatasetCreateRequest(BaseModel):
    name: str
    description: str
    labels: List[str] = []
    format: str
    external_url: Optional[str] = None

class DatasetResponse(BaseModel):
    id: int
    name: str
    description: str
    labels: List[str]
    format: str
    file_size: int
    owner_address: str
    created_at: datetime
    usage_count: int
    total_rewards: float

class DatasetUsageResponse(BaseModel):
    id: int
    dataset_id: int
    job_id: Optional[int]
    user_address: str
    reward_amount: float
    used_at: datetime

# Marketplace Schemas
class MarketplaceListingRequest(BaseModel):
    machine_id: int
    price_per_hour: float
    availability: str = "available"
    min_rental_hours: int = 1
    max_rental_hours: int = 168

class MarketplaceSearchRequest(BaseModel):
    min_cpu: Optional[int] = None
    min_gpu: Optional[int] = None
    min_ram: Optional[int] = None
    max_price: Optional[float] = None
    availability: Optional[str] = None

class RentalRequest(BaseModel):
    machine_id: int
    hours: int

class RentalResponse(BaseModel):
    rental_id: int
    machine_id: int
    total_cost: float
    rental_start: datetime
    rental_end: datetime
    status: str


# Nodes / heartbeat
class NodeItem(BaseModel):
    machine_id: int
    provider_address: str
    endpoint: Optional[str] = None
    status: str
    last_seen: Optional[str] = None
    specs: Optional[str] = None
    metrics: Optional[Dict] = None
    price_per_hour_wei: Optional[str] = None
    listed: Optional[bool] = None


class NodeListResponse(BaseModel):
    nodes: List[NodeItem]


class NodePingRequest(BaseModel):
    machine_id: int
    provider_address: str
    endpoint: Optional[str] = None
    status: Optional[str] = None  # optional override e.g. training
    metrics: Optional[Dict] = None


# Datasets
class DatasetCreateRequest(BaseModel):
    owner_address: str
    name: str
    description: Optional[str] = None
    uri: str
    size_bytes: Optional[int] = None
    fmt: Optional[str] = None


class DatasetItem(BaseModel):
    id: int
    owner_address: str
    name: str
    description: Optional[str] = None
    uri: str
    size_bytes: Optional[int] = None
    fmt: Optional[str] = None
    created_at: Optional[str] = None


class DatasetListResponse(BaseModel):
    datasets: List[DatasetItem]


# Logs
class LogsResponse(BaseModel):
    machine_id: int
    logs: List[str]


# Marketplace
class MarketplaceListRequest(BaseModel):
    machine_id: int
    price_per_hour_wei: str
    listed: bool = True


class MarketplaceNodeItem(BaseModel):
    machine_id: int
    provider_address: str
    endpoint: Optional[str] = None
    specs: Optional[str] = None
    status: Optional[str] = None
    price_per_hour_wei: Optional[str] = None
    listed: bool = True


class MarketplaceListResponse(BaseModel):
    nodes: List[MarketplaceNodeItem]
