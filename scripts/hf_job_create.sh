#!/usr/bin/env bash
set -euo pipefail

# Create a Hugging Face-backed job via orchestrator
# Usage:
#   HF_MODEL_ID=<repo> HF_TOKEN=<token> [HF_DATASET_ID=<dataset>] [HF_PRIVATE=true|false] \
#   [MODEL_ARCH=hf_text_classification] [REWARD_POOL_DUCK=0] ./scripts/hf_job_create.sh
# Or positional:
#   ./scripts/hf_job_create.sh <huggingface_model_id> [huggingface_dataset_id] <hf_token>

ORCH="${ORCHESTRATOR_API:-http://localhost:8000/api}"
API="${API_KEY:-}"

if [[ -z "${API}" ]]; then
  echo "ERROR: API_KEY is not set" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required" >&2
  exit 1
fi

MODEL_ID="${HF_MODEL_ID:-}"
DATASET_ID="${HF_DATASET_ID:-}"
HF_TOKEN="${HF_TOKEN:-}"
HF_PRIVATE="${HF_PRIVATE:-true}"
MODEL_ARCH="${MODEL_ARCH:-hf_text_classification}"
REWARD="${REWARD_POOL_DUCK:-0}"

# Allow positional overrides
if [[ $# -ge 1 ]]; then MODEL_ID="$1"; fi
if [[ $# -ge 2 ]]; then DATASET_ID="$2"; fi
if [[ $# -ge 3 ]]; then HF_TOKEN="$3"; fi

if [[ -z "$MODEL_ID" || -z "$HF_TOKEN" ]]; then
  echo "Usage: $0 <huggingface_model_id> [huggingface_dataset_id] <hf_token>" >&2
  echo "Env: ORCHESTRATOR_API, API_KEY, HF_PRIVATE=true|false, MODEL_ARCH, REWARD_POOL_DUCK" >&2
  exit 1
fi

case "$HF_PRIVATE" in
  true|false) ;;
  *) echo "ERROR: HF_PRIVATE must be 'true' or 'false'" >&2; exit 1;;
esac

payload=$(jq -nc \
  --arg model_arch "$MODEL_ARCH" \
  --arg model_id "$MODEL_ID" \
  --arg dataset_id "${DATASET_ID:-}" \
  --arg token "$HF_TOKEN" \
  --argjson hf_private "$HF_PRIVATE" \
  --argjson reward "${REWARD}" \
  '{
    model_arch: $model_arch,
    initial_weights: [],
    reward_pool_duck: $reward,
    huggingface_model_id: $model_id,
    huggingface_dataset_id: (if $dataset_id=="" then null else $dataset_id end),
    huggingface_token: $token,
    hf_private: $hf_private
  }')

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

echo "$JOB_ID"
