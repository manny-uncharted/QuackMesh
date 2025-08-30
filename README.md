# QuackMesh

Federated learning with on-chain incentives (DuckChain) and AWS.

Monorepo:
- `server/`: FastAPI orchestrator.
- `contracts/`: DuckChain smart contracts (Hardhat).
- `client/`: Python client (contributor/provider).
- `scripts/`: Utility scripts.

## Quickstart (Local)
1. Copy env: `cp .env.example .env` (optional for compose env vars)
2. Start stack:
```bash
docker compose up -d --build
```
3. Create a sample job:
```bash
python3 scripts/seed_db.py
```
4. Run a contributor:
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r client/requirements.txt
python -m quackmesh_client.contributor --job-id 1
```

API endpoints:
- `POST /api/job`
- `GET /api/job/{jobId}/model`
- `POST /api/job/{jobId}/update`
- `GET /api/cluster/{jobId}`

## Contracts (DuckChain)
```bash
cd contracts
npm i
cp .env.example .env # set DUCKCHAIN RPC + key + token addr
npm run build
npm run test
npm run deploy
```
ABIs are emitted to `contracts/abi/`, and addresses to `contracts/deployments/duckchain.json`.
Mount `contracts/abi` into the server (already configured in `docker-compose.yml`).

### Environment variables and ABI/address wiring
- Contracts/web3
  - `WEB3_PROVIDER_URL` (e.g. http://localhost:8545)
  - `DUCKCHAIN_CHAIN_ID` (e.g. 1337)
  - `DUCK_TOKEN_ADDRESS`, `COMPUTE_MARKETPLACE_ADDRESS`, `TRAINING_POOL_ADDRESS`, `INFERENCE_POOL_ADDRESS`
  - `CONTRACTS_ABI_DIR` (default `/app/contracts_abi`; compose mounts `./contracts/abi` there)
- Auth and limits
  - `API_KEY` for orchestrator auth; workers send it on callbacks
  - `RATE_LIMIT_PER_MINUTE`, `SENSITIVE_GETS_PER_MINUTE`
- DB/Cache
  - `DATABASE_URL` (see compose for default to Postgres service)
  - `REDIS_URL`

### Worker provisioning & training
- Workers must know how to reach the orchestrator. Set `ORCHESTRATOR_API` when starting workers (or via provisioning env):
  - `ORCHESTRATOR_API=http://<orchestrator-host>:8000/api`
- The worker exposes:
  - `GET /health` -> `{ "status": "ok" }`
  - `POST /task/train` with `{ "job_id": <int>, "steps": <int> }`
- Provisioning via orchestrator (`POST /api/cluster/provision`) will:
  - SSH to hosts, run the worker container, poll `/health`, and persist only healthy nodes.
  - Inject `API_KEY` automatically if set on the server, unless provided in `env`.

### Troubleshooting training hangs
- If `/round/{job_id}/start` fails or appears to hang:
  - Verify worker health from orchestrator host: `curl http://<worker-host>:<port>/health`
  - Test training directly on a worker:
    ```bash
    curl -sS -X POST http://<worker-host>:<port>/task/train \
      -H 'Content-Type: application/json' \
      -d '{"job_id": <JOB_ID>, "steps": 1}'
    ```
  - Ensure `ORCHESTRATOR_API` is reachable from the worker container and points to the orchestrator.
  - Ensure `API_KEY` matches the orchestrator.
  - Check worker logs (e.g., docker logs) and orchestrator logs for `/job/{id}/model` and `/job/{id}/update` requests.

## AWS
- Orchestrator: provision Ubuntu 22.04 EC2 (t3.large+). Install Docker + docker-compose. Clone repo and `docker compose up -d`.
- Database: RDS Postgres (t3.micro+). Set `DATABASE_URL` accordingly.
- Redis: ElastiCache (optional) or container.
- SageMaker: optional for heavy central ML tasks.

## Cluster Manager
- `server/app/services/cluster_manager.py` exposes stubs to provision and SSH onto rented nodes.
- Integrate with `ComputeMarketplace.sol` to rent N machines and populate `GET /api/cluster/{jobId}`.

## Notes
- ML: PyTorch/Flower can be integrated in `client/` as needed. Current client simulates local updates for scaffolding.
- Security: never commit real keys. Use `.env`.
- Next.js demo dashboard (optional) can be added under `frontend/` later.

## Demo Flow
- Deploy contracts to DuckChain testnet.
- List providers (provider mode, calls `listMachine`).
- Create training job (API / contracts).
- Run contributors; orchestrator aggregates (FedAvg) and updates global model.
- Distribute DUCK rewards via `TrainingPool`.

## Hugging Face Integration (PoC)
QuackMesh can orchestrate jobs that fine-tune models and optionally use datasets from the Hugging Face Hub. Tokens are encrypted at rest in the orchestrator DB and decrypted by workers in memory.

### Requirements
- Server: set `HF_TOKEN_ENC_KEY` (Fernet key) in env.
- Worker: install client deps (`client/requirements.txt` includes `transformers`, `huggingface_hub`, `datasets`, `cryptography`). Set `HF_TOKEN_DEC_KEY` to the same Fernet key value.
- Use a Hugging Face repo you own (e.g., `your-username/your-model`), or create a new one. Your HF token must have write access.

### Generate a Fernet key (demo)
```bash
python3 - <<'PY'
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
PY
```
Export on server and workers:
```bash
export HF_TOKEN_ENC_KEY='<paste_fernet_key>'
# Workers can also use HF_TOKEN_DEC_KEY (falls back to HF_TOKEN_ENC_KEY if unset)
export HF_TOKEN_DEC_KEY="$HF_TOKEN_ENC_KEY"
```

`docker-compose.yml` exposes `HF_TOKEN_ENC_KEY` to the server container.

### Create an HF job (with optional dataset)
```bash
export API_KEY=admin-test-abc123
export ORCHESTRATOR_API=http://localhost:8000/api

JOB_ID=$(curl -s -X POST "$ORCHESTRATOR_API/job/" \
  -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d '{
    "model_arch":"hf_text_classification",
    "reward_pool_duck": 0,
    "huggingface_model_id":"<your-username>/distilbert-base-uncased-quackmesh-demo",
    "huggingface_dataset_id":"imdb",
    "huggingface_token":"<hf_user_token>",
    "hf_private": true
  }' | jq -r .job_id)
echo "Job ID: $JOB_ID"
```

Workers fetch `GET /api/job/{job_id}/hf_meta` to retrieve HF metadata and a base64-encoded encrypted token. If `huggingface_dataset_id` is provided, the worker loads a tiny slice (e.g., `train[:1%]`) for a quick local fine-tune.

### Start a worker (host example)
```bash
pip install -r client/requirements.txt
export ORCHESTRATOR_API=http://localhost:8000/api
export HF_TOKEN_DEC_KEY="$HF_TOKEN_ENC_KEY"
python -m quackmesh_client worker --host 127.0.0.1 --port 9001
```

### Trigger training (tiny local fine-tune)
```bash
curl -s -X POST http://127.0.0.1:9001/task/train \
  -H 'Content-Type: application/json' \
  -d "{\"job_id\": $JOB_ID, \"steps\": 1}"
```

Workers now submit model weights back to the orchestrator for FedAvg.

### Push aggregated model to Hugging Face
After aggregation, ask a worker to push the global model to the HF Hub:
```bash
curl -s -X POST http://127.0.0.1:9001/task/push_hf \
  -H 'Content-Type: application/json' \
  -d "{\"job_id\": $JOB_ID}"
```

### Notes
- Use a repo you own or have write access to, e.g. `<your-username>/<repo>`.
- Server stores encrypted HF tokens in DB; workers decrypt in-memory using `HF_TOKEN_DEC_KEY`.
- For non-HF jobs, workers fall back to MNIST/FakeData FedAvg flow.
- Ensure server and workers share the same Fernet key value.
- Private datasets and models are supported when the token has the right scopes; the worker passes the token to `transformers` and `datasets`.
