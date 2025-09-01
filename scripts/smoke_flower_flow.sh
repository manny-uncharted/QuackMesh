#!/usr/bin/env bash
set -euo pipefail

# End-to-end smoke test for Flower-based federated training (MNIST/fake)
# Requires: running orchestrator, one running worker, jq
# Env:
#   API_KEY (required)
#   ORCHESTRATOR_API (default http://localhost:8000/api)
#   WORKER_ENDPOINT (default 127.0.0.1:9001)
#   ROUNDS (default 1)
#   STEPS (default 10)
#   MODEL_ARCH (default mnist_mlp; informational only)

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORCH=${ORCHESTRATOR_API:-https://8000-01k42mwc8wv62x7je6az5zqksp.cloudspaces.litng.ai/api}
API=${API_KEY:-}
ENDPOINT="${WORKER_ENDPOINT:-127.0.0.1:9001}"
ROUNDS="${ROUNDS:-1}"
STEPS="${STEPS:-10}"
MODEL_ARCH="${MODEL_ARCH:-mnist_mlp}"

if [[ -z "$API" ]]; then echo "ERROR: API_KEY not set" >&2; exit 1; fi
if ! command -v jq >/dev/null 2>&1; then echo "ERROR: jq required" >&2; exit 1; fi

# 1) Create a non-HF job (so workers train MNIST/fake via Flower)
payload=$(jq -nc \
  --arg model_arch "$MODEL_ARCH" \
  --argjson reward 0 \
  '{
    model_arch: $model_arch,
    initial_weights: [],
    reward_pool_duck: $reward,
    huggingface_model_id: null,
    huggingface_dataset_id: null,
    huggingface_token: null,
    hf_private: true
  }')

echo "[1/4] Creating Flower MNIST job..."
resp=$(curl -sS -X POST "$ORCH/job/" -H "X-API-Key: $API" -H 'Content-Type: application/json' -d "$payload")
if ! echo "$resp" | jq . >/dev/null 2>&1; then
  echo "Server response (non-JSON): $resp" >&2
  exit 1
fi
JOB_ID=$(echo "$resp" | jq -r '.job_id')
if [[ "$JOB_ID" == "null" || -z "$JOB_ID" ]]; then
  echo "Failed to create job: $resp" >&2
  exit 1
fi
echo "JOB_ID=$JOB_ID"

# 2) Register provider and assign to cluster
echo "[2/4] Registering provider + assigning cluster (endpoint=$ENDPOINT)..."
"$DIR/register_and_assign.sh" "$JOB_ID" "$ENDPOINT"

# 3) Start Flower round(s)
echo "[3/4] Starting Flower round(s): rounds=$ROUNDS steps=$STEPS ..."
"$DIR/round_start_flower.sh" "$JOB_ID" "$ROUNDS" "$STEPS"

# 4) Fetch aggregated model (poll until non-empty or timeout)
echo "[4/4] Waiting for aggregated model..."
WAIT_S="${WAIT_S:-40}"
deadline=$((WAIT_S + $(date +%s)))
attempt=0
final=""
while true; do
  attempt=$((attempt + 1))
  resp=$(curl -sS "$ORCH/job/$JOB_ID/model" || true)
  if echo "$resp" | jq . >/dev/null 2>&1; then
    n=$(echo "$resp" | jq '.weights | length')
    echo "attempt=$attempt weights_len=$n"
    if [ "$n" -gt 0 ]; then
      final="$resp"
      break
    fi
  else
    echo "Model endpoint returned non-JSON: $resp" >&2
  fi
  now=$(date +%s)
  if [ "$now" -ge "$deadline" ]; then
    echo "Timed out waiting for non-empty aggregated weights after ${WAIT_S}s" >&2
    final="$resp"
    break
  fi
  sleep 2
done
echo "$final" | jq .

echo "Done. Check orchestrator logs for round.flower.* and worker logs for flower.client.* markers."
