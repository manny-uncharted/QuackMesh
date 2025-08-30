#!/usr/bin/env bash
set -euo pipefail

# Usage: round_start_flower.sh <JOB_ID> [ROUNDS] [STEPS] [SERVER_HOST] [SERVER_PORT]
# Env: ORCHESTRATOR_API (default http://localhost:8000/api), API_KEY

ORCHESTRATOR_API=${ORCHESTRATOR_API:-http://localhost:8000/api}
API_KEY=${API_KEY:-}

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <JOB_ID> [ROUNDS] [STEPS] [SERVER_HOST] [SERVER_PORT]"
  exit 1
fi

JOB_ID=$1
ROUNDS=${2:-1}
STEPS=${3:-1}
SERVER_HOST=${4:-}
SERVER_PORT=${5:-8089}

hdrs=(-H "Content-Type: application/json")
if [[ -n "$API_KEY" ]]; then
  hdrs+=(-H "X-API-Key: $API_KEY")
fi

# Derive server host from ORCHESTRATOR_API if not provided
if [[ -z "$SERVER_HOST" ]]; then
  # Strip scheme
  base=${ORCHESTRATOR_API#*://}
  # Take host:port before first slash
  SERVER_HOST=${base%%/*}
  # Drop any :port from host (Flower port is provided separately)
  SERVER_HOST=${SERVER_HOST%%:*}
fi

BODY=$(jq -nc --argjson rounds "$ROUNDS" --argjson steps "$STEPS" --arg host "$SERVER_HOST" --argjson port "$SERVER_PORT" '{rounds: $rounds, steps: $steps, server_host: $host, server_port: $port}')

set -x
curl -sS -X POST "$ORCHESTRATOR_API/round/$JOB_ID/start_flower" "${hdrs[@]}" -d "$BODY" | jq .
set +x
