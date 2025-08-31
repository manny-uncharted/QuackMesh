# QuackMesh Local Demo (One-Command)

This guide brings up a complete local demo:
- Hardhat blockchain + deployed contracts (Mock DUCK + core)
- Orchestrator backend (DB, Redis, API, Flower)
- Two local workers
- Next.js frontend with onboarding and marketplace

## Prereqs
- Node.js LTS + npm
- Python 3.11 + pip
- Docker + Docker Compose
- jq, nc

## Quick Start
From repo root:
```bash
# Make the script executable (first time)
chmod +x scripts/demo_local_full.sh

# Run the end-to-end setup
scripts/demo_local_full.sh
```

Script does:
1) Starts Hardhat on :8545 if not already running
2) Deploys `MockDuckToken` and core contracts, mints DUCK to a few accounts
3) Writes `contracts/deployments/duckchain.json` and ABIs to `contracts/abi/`
4) Starts `db`, `redis`, `server` via Docker Compose
5) Waits for `http://localhost:8000/readyz`
6) Writes `frontend/.env.local` with contract addresses and RPC URL
7) Installs client deps and starts two workers on 9001/9002

Outputs:
- Contracts: `contracts/deployments/duckchain.json`
- Server API: `http://localhost:8000/api`
- Flower: `http://localhost:8089`
- Worker logs: `/tmp/qm_worker_9001.log`, `/tmp/qm_worker_9002.log`

## Frontend
In a terminal:
```bash
cd frontend
npm install
npm run dev
```
Open: http://localhost:3000

Flow:
- On first visit, onboarding redirects to `/onboarding`
- "Contribute a Dataset" → `/datasets` (legacy `/contribute/dataset` redirects)
- "Setup a Compute Node" → `/register-node` (legacy `/node/setup` redirects)
- Go to `/marketplace` → choose a node → "Rent Now"
- Enter HF model/dataset or compute mode → submit → redirected to job dashboard

## Federated Training (Flower) quick test
```bash
export API_KEY=admin-test-abc123
export ORCHESTRATOR_API=http://localhost:8000/api
bash scripts/smoke_flower_flow.sh
```
Shows job creation, assignment, round start, and fetching model weights.

## Hugging Face (optional)
Follow `docs/LOCAL_TESTING.md` section 6 for HF token encryption and job creation.

Set a Fernet key and bring server up with it:
```bash
python3 - <<'PY'
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
PY

export HF_TOKEN_ENC_KEY='<fernet_key>'
docker compose up -d server
```

Create an HF-backed job (use your own HF repo/dataset and token):
```bash
export API_KEY=admin-test-abc123
export ORCHESTRATOR_API=http://localhost:8000/api
curl -s -X POST "$ORCHESTRATOR_API/job/" \
  -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d '{
    "model_arch":"hf_text_classification",
    "reward_pool_duck": 0,
    "huggingface_model_id":"<you>/distilbert-base-uncased-quackmesh-demo",
    "huggingface_dataset_id":"imdb",
    "huggingface_token":"<hf_user_token>",
    "hf_private": true
  }' | jq .
```

## Token Economy
- The scripted deploy mints DUCK to the first few Hardhat accounts
- Use Hardhat console to mint extra during demo:
```js
// contracts/ $ npx hardhat console --network localhost
const [a0] = await ethers.getSigners();
const DUCK = require('./deployments/duckchain.json').DUCK
const Duck = await ethers.getContractFactory('MockDuckToken')
const token = Duck.attach(DUCK)
await token.mint(a0.address, ethers.parseUnits('1000', 18))
```

## Troubleshooting
- If Hardhat isn’t on 8545, rerun `scripts/demo_local_full.sh`
- If server healthcheck fails, `docker compose logs -f server`
- Workers: tail `/tmp/qm_worker_9001.log`
- Contracts not found: ensure `contracts/deployments/duckchain.json` and `contracts/abi/` exist

## Cleanup
```bash
# Stop docker stack
docker compose down

# Kill workers (find python processes)
pkill -f 'quackmesh_client worker' || true

# Optional: remove DB volume
docker volume rm quackmesh_pgdata || true
```
