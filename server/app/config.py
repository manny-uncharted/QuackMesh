import os
from pydantic import BaseModel

class Settings(BaseModel):
    database_url: str = os.getenv("DATABASE_URL", "postgresql+psycopg2://postgres:postgres@localhost:5432/quackmesh")
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    web3_provider_url: str = os.getenv("WEB3_PROVIDER_URL", "http://localhost:8545")
    duckchain_chain_id: int = int(os.getenv("DUCKCHAIN_CHAIN_ID", "1337"))
    duck_token_address: str = os.getenv("DUCK_TOKEN_ADDRESS", "0x0000000000000000000000000000000000000000")
    compute_marketplace_address: str = os.getenv("COMPUTE_MARKETPLACE_ADDRESS", "0x0000000000000000000000000000000000000000")
    training_pool_address: str = os.getenv("TRAINING_POOL_ADDRESS", "0x0000000000000000000000000000000000000000")
    inference_pool_address: str = os.getenv("INFERENCE_POOL_ADDRESS", "0x0000000000000000000000000000000000000000")
    contracts_abi_dir: str = os.getenv("CONTRACTS_ABI_DIR", "/app/contracts_abi")
    allowed_origins: str = os.getenv("ALLOWED_ORIGINS", "*")
    api_key: str | None = os.getenv("API_KEY")
    rate_limit_per_minute: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))
    sensitive_gets_per_minute: int = int(os.getenv("SENSITIVE_GETS_PER_MINUTE", "30"))
    enable_create_all: bool = os.getenv("ENABLE_CREATE_ALL", "1").lower() in {"1", "true", "yes"}

    # JWT auth
    jwt_secret: str | None = os.getenv("JWT_SECRET")
    jwt_issuer: str = os.getenv("JWT_ISSUER", "quackmesh")
    jwt_audience: str = os.getenv("JWT_AUDIENCE", "quackmesh")
    jwt_exp_minutes: int = int(os.getenv("JWT_EXP_MINUTES", "60"))

    # Event-driven orchestration
    auto_assign_on_event: bool = os.getenv("AUTO_ASSIGN_ON_EVENT", "0").lower() in {"1", "true", "yes"}
    auto_assign_size: int = int(os.getenv("AUTO_ASSIGN_SIZE", "1"))
    auto_start_round_on_event: bool = os.getenv("AUTO_START_ROUND_ON_EVENT", "0").lower() in {"1", "true", "yes"}
    auto_round_steps: int = int(os.getenv("AUTO_ROUND_STEPS", "1"))

    # Safety gates
    allow_insecure_rent_api: bool = os.getenv("ALLOW_INSECURE_RENT_API", "0").lower() in {"1", "true", "yes"}

    # Hugging Face credential encryption
    hf_token_enc_key: str | None = os.getenv("HF_TOKEN_ENC_KEY")

    # Worker control key for forwarding control commands
    worker_control_key: str | None = os.getenv("WORKER_CONTROL_KEY")

settings = Settings()


