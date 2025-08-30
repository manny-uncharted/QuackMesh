#!/usr/bin/env bash
set -euo pipefail

# Instruct a worker to push aggregated model to Hugging Face Hub
# Usage: ./scripts/push_hf.sh <job_id> [timeout_s=120]

ORCH=${ORCHESTRATOR_API:-http://localhost:8000/api}
API=${API_KEY:-}

if [[ -z "$API" ]]; then echo "ERROR: API_KEY not set" >&2; exit 1; fi
if ! command -v jq >/dev/null 2>&1; then echo "ERROR: jq required" >&2; exit 1; fi

JOB_ID="${1:-}"
TIMEOUT="${2:-120}"

if [[ -z "$JOB_ID" ]]; then
  echo "Usage: $0 <job_id> [timeout_s=120]" >&2
  exit 1
fi

payload=$(jq -nc --argjson timeout "$TIMEOUT" '{timeout_s: $timeout}')

curl -sS -X POST "$ORCH/round/$JOB_ID/push_hf" -H "X-API-Key: $API" -H 'Content-Type: application/json' -d "$payload" | jq .
