#!/usr/bin/env bash
set -euo pipefail

# Register a provider endpoint and assign it to a job's cluster.
# Usage: ./scripts/register_and_assign.sh <job_id> <endpoint host:port> [machine_id=1] [provider_address=0xLocal]

ORCH=${ORCHESTRATOR_API:-http://localhost:8000/api}
API=${API_KEY:-}

if [[ -z "${API}" ]]; then echo "ERROR: API_KEY not set" >&2; exit 1; fi
if ! command -v jq >/dev/null 2>&1; then echo "ERROR: jq required" >&2; exit 1; fi

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <job_id> <endpoint host:port> [machine_id=1] [provider_address=0xLocal]" >&2
  exit 1
fi

JOB_ID="$1"
ENDPOINT="$2"
MACHINE_ID="${3:-1}"
PROVIDER_ADDR="${4:-0xLocal}"
SPECS_JSON=${SPECS_JSON:-'{}'}

reg=$(jq -nc \
  --argjson machine_id "$MACHINE_ID" \
  --arg provider "$PROVIDER_ADDR" \
  --arg specs "$SPECS_JSON" \
  --arg endpoint "$ENDPOINT" \
  '{machine_id: $machine_id, provider_address: $provider, specs: $specs, endpoint: $endpoint}')

curl -sS -X POST "$ORCH/provider/register" -H "X-API-Key: $API" -H 'Content-Type: application/json' -d "$reg" | jq .

assign=$(jq -nc --argjson job_id "$JOB_ID" --argjson mid "$MACHINE_ID" '{job_id: $job_id, machine_ids: [$mid]}')

curl -sS -X POST "$ORCH/cluster/assign" -H "X-API-Key: $API" -H 'Content-Type: application/json' -d "$assign" | jq .
