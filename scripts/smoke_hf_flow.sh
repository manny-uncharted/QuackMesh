#!/usr/bin/env bash
set -euo pipefail

# End-to-end smoke test for HF-backed training and push flow
# Requires: running orchestrator, one running worker, jq
# Env:
#   API_KEY (required)
#   ORCHESTRATOR_API (default http://localhost:8000/api)
#   HF_MODEL_ID (required) e.g. <user>/distilbert-base-uncased-quackmesh-demo
#   HF_TOKEN (required)
#   HF_DATASET_ID (optional, e.g. imdb)
#   WORKER_ENDPOINT (default 127.0.0.1:9001)

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORCH=${ORCHESTRATOR_API:-http://localhost:8000/api}
API=${API_KEY:-}
MODEL_ID="${HF_MODEL_ID:-}"
DATASET_ID="${HF_DATASET_ID:-}"
HF_TOKEN="${HF_TOKEN:-}"
ENDPOINT="${WORKER_ENDPOINT:-127.0.0.1:9001}"

if [[ -z "$API" ]]; then echo "ERROR: API_KEY not set" >&2; exit 1; fi
if ! command -v jq >/dev/null 2>&1; then echo "ERROR: jq required" >&2; exit 1; fi

if [[ -z "$MODEL_ID" || -z "$HF_TOKEN" ]]; then
  echo "Usage: HF_MODEL_ID=<repo> HF_TOKEN=<token> [HF_DATASET_ID=imdb] [WORKER_ENDPOINT=127.0.0.1:9001] $0" >&2
  exit 1
fi

echo "[1/5] Creating HF job..."
JOB_ID=$("$DIR/hf_job_create.sh" "$MODEL_ID" "${DATASET_ID:-}" "$HF_TOKEN")
echo "JOB_ID=$JOB_ID"

echo "[2/5] Registering provider + assigning cluster (endpoint=$ENDPOINT)..."
"$DIR/register_and_assign.sh" "$JOB_ID" "$ENDPOINT"

echo "[3/5] Starting training round..."
"$DIR/round_start.sh" "$JOB_ID" 1 60

sleep 1

echo "[4/5] Pushing aggregated model to Hugging Face Hub..."
"$DIR/push_hf.sh" "$JOB_ID" 180

echo "[5/5] Fetching aggregated model..."
curl -sS "$ORCH/job/$JOB_ID/model" | jq .

echo "Done. Check worker logs for hf.* and push_hf.* markers."
