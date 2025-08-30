#!/usr/bin/env bash
set -euo pipefail

# Build and push images to Amazon ECR
# Prereqs:
# - AWS CLI v2 installed and configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION)
# - Logged in to ECR via aws ecr get-login-password
# - jq installed
#
# Usage:
#   AWS_ACCOUNT_ID=123456789012 AWS_REGION=us-east-1 ./scripts/aws/ecr_build_push.sh <version>
#   Example: ./scripts/aws/ecr_build_push.sh v0.1.0

VERSION=${1:-latest}
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID:?must set AWS_ACCOUNT_ID}
ECR_SERVER="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

REPOS=("quackmesh-server" "quackmesh-client")

for repo in "${REPOS[@]}"; do
  if ! aws ecr describe-repositories --repository-names "$repo" --region "$AWS_REGION" >/dev/null 2>&1; then
    echo "Creating ECR repo: $repo"
    aws ecr create-repository --repository-name "$repo" --region "$AWS_REGION" >/dev/null
  fi
  echo "Logging in to ECR..."
  aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_SERVER"

done

# Server image
SERVER_IMG="$ECR_SERVER/quackmesh-server:$VERSION"
Dockerfile_server=server/Dockerfile

echo "Building server image: $SERVER_IMG"
docker build -f "$Dockerfile_server" -t "$SERVER_IMG" .

echo "Pushing server image: $SERVER_IMG"
docker push "$SERVER_IMG"

# Client (worker) image
CLIENT_IMG="$ECR_SERVER/quackmesh-client:$VERSION"
Dockerfile_client=client/Dockerfile

echo "Building client image: $CLIENT_IMG"
docker build -f "$Dockerfile_client" -t "$CLIENT_IMG" .

echo "Pushing client image: $CLIENT_IMG"
docker push "$CLIENT_IMG"

echo "Done. Images:"
echo "- $SERVER_IMG"
echo "- $CLIENT_IMG"
