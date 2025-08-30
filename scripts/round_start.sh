#!/usr/bin/env bash
set -euo pipefail

# Trigger a training round for a job
# Usage: ./scripts/round_start.sh <job_id> [steps=1] [timeout_s=20]

ORCH=${ORCHESTRATOR_API:-http://localhost:8000/api}
API=${API_KEY:-}

if [[ -z "$API" ]]; then echo "ERROR: API_KEY not set" >&2; exit 1; fi
if ! command -v jq >/dev/null 2>&1; then echo "ERROR: jq required" >&2; exit 1; fi

JOB_ID="${1:-}"
STEPS="${2:-1}"
TIMEOUT="${3:-20}"

if [[ -z "$JOB_ID" ]]; then
  echo "Usage: $0 <job_id> [steps=1] [timeout_s=20]" >&2
  exit 1
fi

payload=$(jq -nc --argjson steps "$STEPS" --argjson timeout "$TIMEOUT" '{steps: $steps, timeout_s: $timeout}')

curl -sS -X POST "$ORCH/round/$JOB_ID/start" -H "X-API-Key: $API" -H 'Content-Type: application/json' -d "$payload" | jq .
