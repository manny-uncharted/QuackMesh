#!/usr/bin/env bash
set -euo pipefail

# Deploy (register and update service) for server or client using ECS Fargate
# Prereqs:
# - AWS CLI v2 installed and configured
# - jq and envsubst (gettext) installed
#
# Usage (env-driven):
#   export AWS_ACCOUNT_ID=123456789012
#   export AWS_REGION=us-east-1
#   export CLUSTER=quackmesh
#   export SERVER_SERVICE=quackmesh-server
#   export CLIENT_SERVICE=quackmesh-client
#   export EXECUTION_ROLE_ARN=arn:aws:iam::123456789012:role/ecsTaskExecutionRole
#   export TASK_ROLE_ARN=arn:aws:iam::123456789012:role/ecsTaskRole
#   VERSION=v0.1.0 scripts/aws/ecs_deploy.sh server
#   VERSION=v0.1.0 scripts/aws/ecs_deploy.sh client
#
# Required env vars differ per component, see templates in scripts/aws/taskdef-*.json

: "${AWS_ACCOUNT_ID:?set AWS_ACCOUNT_ID}"
: "${AWS_REGION:?set AWS_REGION}"
: "${EXECUTION_ROLE_ARN:?set EXECUTION_ROLE_ARN}"
: "${TASK_ROLE_ARN:?set TASK_ROLE_ARN}"
: "${VERSION:?set VERSION (image tag)}"

COMPONENT=${1:?first arg must be 'server' or 'client'}
if [[ "$COMPONENT" != "server" && "$COMPONENT" != "client" ]]; then
  echo "Invalid component: $COMPONENT" >&2
  exit 1
fi

# Select service by component
if [[ "$COMPONENT" == "server" ]]; then
  SERVICE=${SERVER_SERVICE:?set SERVER_SERVICE}
  # Provide safe defaults for server template variables if not set
  export ENABLE_CREATE_ALL=${ENABLE_CREATE_ALL:-0}
  export HF_TOKEN_ENC_KEY=${HF_TOKEN_ENC_KEY:-}
  export DUCK_TOKEN_ADDRESS=${DUCK_TOKEN_ADDRESS:-0x0000000000000000000000000000000000000000}
  export COMPUTE_MARKETPLACE_ADDRESS=${COMPUTE_MARKETPLACE_ADDRESS:-0x0000000000000000000000000000000000000000}
  export TRAINING_POOL_ADDRESS=${TRAINING_POOL_ADDRESS:-0x0000000000000000000000000000000000000000}
  export INFERENCE_POOL_ADDRESS=${INFERENCE_POOL_ADDRESS:-0x0000000000000000000000000000000000000000}
else
  SERVICE=${CLIENT_SERVICE:?set CLIENT_SERVICE}
fi

ECR_SERVER="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
IMAGE_URI="$ECR_SERVER/quackmesh-$COMPONENT:$VERSION"
export AWS_REGION IMAGE_URI EXECUTION_ROLE_ARN TASK_ROLE_ARN

TEMPLATE="scripts/aws/taskdef-$COMPONENT.json"
RENDERED="/tmp/taskdef-$COMPONENT-rendered.json"

# Render template with envsubst
if ! command -v envsubst >/dev/null; then
  echo "envsubst not found; install gettext-base" >&2
  exit 1
fi

# Ensure all required variables resolve; envsubst will blank missing vars
envsubst < "$TEMPLATE" > "$RENDERED"

# Validate basic JSON
jq . >/dev/null < "$RENDERED"

echo "Registering task definition for $COMPONENT ..."
TD_REG=$(aws ecs register-task-definition --cli-input-json file://"$RENDERED")
TD_ARN=$(jq -r '.taskDefinition.taskDefinitionArn' <<<"$TD_REG")

echo "Updating service $SERVICE on cluster ${CLUSTER:?set CLUSTER} to $TD_ARN ..."
aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "$SERVICE" \
  --task-definition "$TD_ARN" \
  --force-new-deployment >/dev/null

echo "Deployed $COMPONENT using task definition: $TD_ARN"
