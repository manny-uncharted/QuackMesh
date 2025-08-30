#!/usr/bin/env bash
set -euo pipefail

# Simple end-to-end demo using local workers and orchestrator HTTP API.
# Prereqs:
# - Orchestrator running at http://localhost:8000
# - Python client deps installed (or client Docker image built)
# - API_KEY available (matches orchestrator)
# - jq installed (for pretty output)

ORCH=${ORCHESTRATOR_API:-http://localhost:8000/api}
API=${API_KEY:-admin-test-abc123}

# Start two local workers (9001, 9002)
export ORCHESTRATOR_API="$ORCH"
export API_KEY="$API"
# Make the client package importable when running from repo root
export PYTHONPATH="$(pwd)/client:${PYTHONPATH:-}"

echo "Starting workers on ports 9001 and 9002..."
python -m quackmesh_client worker --host 127.0.0.1 --port 9001 >/tmp/qm_worker_9001.log 2>&1 &
W1=$!
python -m quackmesh_client worker --host 127.0.0.1 --port 9002 >/tmp/qm_worker_9002.log 2>&1 &
W2=$!
trap 'kill $W1 $W2 2>/dev/null || true' EXIT
sleep 1

# Register providers (machine_id 1,2)
echo "Registering provider machines..."
curl -sS -X POST "$ORCH/provider/register" -H "X-API-Key: $API" -H 'Content-Type: application/json' \
  -d '{"machine_id":1, "provider_address":"0xProvider1", "specs":"{}", "endpoint":"127.0.0.1:9001"}' | jq .
curl -sS -X POST "$ORCH/provider/register" -H "X-API-Key: $API" -H 'Content-Type: application/json' \
  -d '{"machine_id":2, "provider_address":"0xProvider2", "specs":"{}", "endpoint":"127.0.0.1:9002"}' | jq .

# Create job via orchestrator API
echo "Creating job..."
JOB_ID=$(curl -sS -X POST "$ORCH/job/" -H "X-API-Key: $API" -H 'Content-Type: application/json' \
  -d '{"model_arch":"demo","initial_weights":[],"reward_pool_duck":0}' | jq -r .job_id)
echo "Job ID: $JOB_ID"

# Assign cluster
echo "Assigning cluster..."
curl -sS -X POST "$ORCH/cluster/assign" -H "X-API-Key: $API" -H 'Content-Type: application/json' \
  -d "{\"job_id\":$JOB_ID, \"machine_ids\":[1,2]}" | jq .

# Start a training round
echo "Starting training round..."
curl -sS -X POST "$ORCH/round/$JOB_ID/start" -H "X-API-Key: $API" -H 'Content-Type: application/json' \
  -d '{"steps":1,"timeout_s":20}' | jq .

# Fetch model
sleep 1
echo "Fetching model..."
curl -sS "$ORCH/job/$JOB_ID/model" | jq .

echo "Done. Check /tmp/qm_worker_900{1,2}.log for worker logs."
