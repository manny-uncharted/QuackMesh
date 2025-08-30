from fastapi import FastAPI, Header
from .routers import job, cluster, provider, training, nodes, datasets, marketplace, nodes, datasets, marketplace, ws
from .db import Base, engine
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from sqlalchemy import text
import redis
from .config import settings
import uuid
from starlette.requests import Request
import logging
import time
import hashlib
from fastapi.responses import JSONResponse, Response
from .services.events import listener
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
import structlog
from .security import authenticate_headers, issue_jwt, extract_identity, get_jwt_subject
from .schemas import TokenIssueRequest, TokenResponse

# Configure structured JSON logging
logging.basicConfig(level=logging.INFO, format="%(message)s")
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.add_log_level,
        structlog.processors.dict_tracebacks,
        structlog.processors.JSONRenderer(),
    ],
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    cache_logger_on_first_use=True,
)
_log = structlog.get_logger("quackmesh")

app = FastAPI(title="QuackMesh Orchestrator", version="0.1.0")

app.include_router(job.router, prefix="/api")
app.include_router(cluster.router, prefix="/api")
app.include_router(provider.router, prefix="/api")
app.include_router(training.router, prefix="/api")
app.include_router(nodes.router, prefix="/api")
app.include_router(datasets.router, prefix="/api")
app.include_router(marketplace.router, prefix="/api")
app.include_router(nodes.router, prefix="/api")
app.include_router(datasets.router, prefix="/api")
app.include_router(marketplace.router, prefix="/api")
app.include_router(ws.router)

# Ensure tables exist (simple bootstrap without Alembic)
if settings.enable_create_all:
    Base.metadata.create_all(bind=engine)

# Middleware
origins = [o.strip() for o in (settings.allowed_origins or "").split(",") if o.strip()] or ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1024)

@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    req_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    start = time.perf_counter()
    ip = request.client.host if request.client else "unknown"
    identity = extract_identity(request.headers.get("x-api-key"), request.headers.get("authorization"))
    response = await call_next(request)
    duration = time.perf_counter() - start
    if response is not None:
        response.headers["X-Request-ID"] = req_id
    _log.info(
        "request",
        req_id=req_id,
        method=request.method,
        path=request.url.path,
        status=response.status_code if response else None,
        ip=ip,
        identity=identity,
        latency_s=round(duration, 6),
    )
    return response

# Reusable Redis client for rate limiting
redis_client = redis.Redis.from_url(settings.redis_url)

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    try:
        # Per-identity (JWT sub or API key) or per-IP
        authz = request.headers.get("authorization")
        sub = get_jwt_subject(authz)
        if sub:
            bucket = f"jwt:{sub}"
        else:
            xkey = request.headers.get("x-api-key")
            if xkey:
                bucket = "api:" + hashlib.sha256(xkey.encode()).hexdigest()[:16]
            else:
                bucket = request.client.host if request.client else "unknown"
        key = f"rl:{bucket}"
        count = redis_client.incr(key)
        if count == 1:
            redis_client.expire(key, 60)
        if count > settings.rate_limit_per_minute:
            return JSONResponse({"detail": "Rate limit exceeded"}, status_code=429)

        # Sensitive GET throttling
        if request.method.upper() == "GET":
            path = request.url.path
            sensitive = (
                (path.startswith("/api/job/") and path.endswith("/model"))
                or path == "/api/provider/"
                or path.startswith("/api/cluster/")
            )
            if sensitive:
                skey = f"srl:{bucket}:{path}"
                scount = redis_client.incr(skey)
                if scount == 1:
                    redis_client.expire(skey, 60)
                if scount > settings.sensitive_gets_per_minute:
                    return JSONResponse({"detail": "Throttled"}, status_code=429)
    except Exception:
        # fail-open on rate limiter errors
        pass
    return await call_next(request)


# Global POST auth enforcement
@app.middleware("http")
async def global_post_auth(request: Request, call_next):
    if request.method.upper() == "POST":
        # Will raise HTTPException if invalid
        authenticate_headers(request.headers.get("x-api-key"), request.headers.get("authorization"))
    return await call_next(request)

# Prometheus metrics
REQUEST_COUNT = Counter("http_requests_total", "Total HTTP requests", ["method", "path", "status"])
REQUEST_LATENCY = Histogram("http_request_duration_seconds", "HTTP request latency in seconds", ["method", "path", "status"])

@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration = time.perf_counter() - start
    method = request.method
    path = request.url.path
    status = str(response.status_code)
    REQUEST_COUNT.labels(method=method, path=path, status=status).inc()
    REQUEST_LATENCY.labels(method=method, path=path, status=status).observe(duration)
    return response

@app.get("/")
def root():
    return {"status": "ok", "service": "quackmesh-orchestrator"}


@app.get("/healthz")
def healthz():
    """Liveness probe: process is up."""
    return {"status": "ok"}


@app.on_event("startup")
def _start_event_listener():
    # Start on-chain event listener (non-fatal if contracts not configured)
    try:
        listener.start()
    except Exception:
        logging.getLogger("quackmesh").debug("Failed to start event listener", exc_info=True)


@app.on_event("shutdown")
def _stop_event_listener():
    try:
        listener.stop()
    except Exception:
        pass


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.post("/auth/token", response_model=TokenResponse)
def auth_token(payload: TokenIssueRequest, x_api_key: str | None = Header(default=None), authorization: str | None = Header(default=None)):
    # Allow with API key or with JWT having scope token:issue
    if authorization:
        authenticate_headers(x_api_key=None, authorization=authorization, required_scopes=["token:issue"])
    else:
        # Enforce API key presence
        if not settings.api_key or x_api_key != settings.api_key:
            return JSONResponse({"detail": "Unauthorized"}, status_code=401)
    token = issue_jwt(payload.sub, payload.scopes)
    return TokenResponse(access_token=token, expires_in=settings.jwt_exp_minutes * 60)


@app.get("/readyz")
def readyz():
    """Readiness probe: checks DB and Redis connectivity."""
    # DB check
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as e:
        return {"status": "error", "db": str(e)}

    # Redis check
    try:
        r = redis.Redis.from_url(settings.redis_url)
        if not r.ping():
            return {"status": "error", "redis": "ping failed"}
    except Exception as e:
        return {"status": "error", "redis": str(e)}

    return {"status": "ok"}
