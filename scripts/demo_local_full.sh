#!/usr/bin/env bash
set -euo pipefail

# QuackMesh: One-command local demo
# - Starts Hardhat local chain
# - Deploys MockDuckToken + core contracts
# - Starts orchestrator (db, redis, server)
# - Starts two local workers
# - Creates frontend .env.local
# Requirements: node+npm, python3+pip, docker, jq

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
CONTRACTS_DIR="$ROOT_DIR/contracts"
FRONTEND_DIR="$ROOT_DIR/frontend"
SCRIPTS_DIR="$ROOT_DIR/scripts"
DEPLOYMENTS_JSON="$CONTRACTS_DIR/deployments/duckchain.json"
HARDHAT_LOG="/tmp/quackmesh_hardhat.log"
WORKER1_LOG="/tmp/qm_worker_9001.log"
WORKER2_LOG="/tmp/qm_worker_9002.log"

need_bin() {
  command -v "$1" >/dev/null 2>&1 || { echo "Error: $1 is required"; exit 1; }
}

# Check tools
need_bin jq
need_bin nc
need_bin docker
need_bin npm
need_bin node
need_bin python3
need_bin pip3

# 1) Start local chain if not running
if ! nc -z localhost 8545 2>/dev/null; then
  echo "[1/7] Starting Hardhat node..."
  (
    cd "$CONTRACTS_DIR"
    npm install
    # Run in background
    npx hardhat node >"$HARDHAT_LOG" 2>&1 &
  )
  # Wait for port
  for i in {1..30}; do
    if nc -z localhost 8545 2>/dev/null; then break; fi
    sleep 1
  done
  if ! nc -z localhost 8545 2>/dev/null; then
    echo "Hardhat did not start. See $HARDHAT_LOG"; exit 1
  fi
else
  echo "[1/7] Hardhat already running on 8545"
fi

# 2) Deploy DUCK + contracts
echo "[2/7] Deploying contracts (MockDUCK + core)..."
(
  cd "$CONTRACTS_DIR"
  npx hardhat run scripts/deploy_all_local.ts --network localhost
)

if [ ! -f "$DEPLOYMENTS_JSON" ]; then
  echo "Missing $DEPLOYMENTS_JSON"; exit 1
fi

DUCK_TOKEN_ADDRESS=$(jq -r .DUCK "$DEPLOYMENTS_JSON")
COMPUTE_MARKETPLACE_ADDRESS=$(jq -r .ComputeMarketplace "$DEPLOYMENTS_JSON")
TRAINING_POOL_ADDRESS=$(jq -r .TrainingPool "$DEPLOYMENTS_JSON")
INFERENCE_POOL_ADDRESS=$(jq -r .InferencePool "$DEPLOYMENTS_JSON")

# 3) Start orchestrator stack
export WEB3_PROVIDER_URL=${WEB3_PROVIDER_URL:-http://localhost:8545}
export DUCKCHAIN_CHAIN_ID=${DUCKCHAIN_CHAIN_ID:-1337}
export DUCK_TOKEN_ADDRESS
export COMPUTE_MARKETPLACE_ADDRESS
export TRAINING_POOL_ADDRESS
export INFERENCE_POOL_ADDRESS
export API_KEY=${API_KEY:-admin-test-abc123}
export ENABLE_CREATE_ALL=${ENABLE_CREATE_ALL:-1}
export AUTO_ASSIGN_ON_EVENT=${AUTO_ASSIGN_ON_EVENT:-1}
export AUTO_ASSIGN_SIZE=${AUTO_ASSIGN_SIZE:-2}
export AUTO_START_ROUND_ON_EVENT=${AUTO_START_ROUND_ON_EVENT:-1}
export AUTO_ROUND_STEPS=${AUTO_ROUND_STEPS:-1}

echo "[3/7] Starting db, redis, server via docker compose..."
(
  cd "$ROOT_DIR"
  docker compose up -d db redis server
)

# Wait server health
echo "[4/7] Waiting for server health..."
for i in {1..30}; do
  if curl -sf http://localhost:8000/readyz >/dev/null; then break; fi
  sleep 2
done
if ! curl -sf http://localhost:8000/readyz >/dev/null; then
  echo "Server not healthy at :8000/readyz"; exit 1
fi

# 4) Frontend env
echo "[5/7] Writing frontend .env.local..."
cat >"$FRONTEND_DIR/.env.local" <<EOF
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
NEXT_PUBLIC_DUCK_TOKEN_ADDRESS=$DUCK_TOKEN_ADDRESS
NEXT_PUBLIC_COMPUTE_MARKETPLACE_ADDRESS=$COMPUTE_MARKETPLACE_ADDRESS
NEXT_PUBLIC_TRAINING_POOL_ADDRESS=$TRAINING_POOL_ADDRESS
NEXT_PUBLIC_RPC_URL=http://localhost:8545
EOF
# Optionally include WalletConnect project id if provided
if [ -n "${NEXT_PUBLIC_WC_PROJECT_ID:-}" ]; then
  echo "NEXT_PUBLIC_WC_PROJECT_ID=$NEXT_PUBLIC_WC_PROJECT_ID" >>"$FRONTEND_DIR/.env.local"
fi

# 5) Workers
echo "[6/7] Installing client deps and starting two workers..."
(
  cd "$ROOT_DIR"
  pip3 install -r client/requirements.txt
  export ORCHESTRATOR_API=http://localhost:8000/api
  export PYTHONPATH="$ROOT_DIR/client:${PYTHONPATH:-}"
  # Start in background
  python3 -m quackmesh_client worker --host 127.0.0.1 --port 9001 >"$WORKER1_LOG" 2>&1 &
  python3 -m quackmesh_client worker --host 127.0.0.1 --port 9002 >"$WORKER2_LOG" 2>&1 &
)

# 6) Final hints
echo "[7/7] All set!"
echo
echo "Contracts: $DEPLOYMENTS_JSON"
echo "- DUCK:                 $DUCK_TOKEN_ADDRESS"
echo "- ComputeMarketplace:   $COMPUTE_MARKETPLACE_ADDRESS"
echo "- TrainingPool:         $TRAINING_POOL_ADDRESS"
echo "- InferencePool:        $INFERENCE_POOL_ADDRESS"
echo
echo "Server API:    http://localhost:8000/api"
echo "Flower server: http://localhost:8089"
echo "Workers:       logs at $WORKER1_LOG and $WORKER2_LOG"
echo
echo "Frontend:"
echo "  cd $FRONTEND_DIR && npm install && npm run dev"
echo "  Open http://localhost:3000 (Onboarding -> Marketplace -> Rent -> Job page)"
echo
# Optional: provide a quick smoke-flow hint
echo "Optional smoke test:"
echo "  export API_KEY=admin-test-abc123 ORCHESTRATOR_API=http://localhost:8000/api"
echo "  bash scripts/smoke_flower_flow.sh"
