#!/bin/bash
set -euo pipefail

COMPOSE_FILE=".ci/stack.yml"
STACK_NAME="shortener"
ENV_PATH="/mnt/ssd/docker/shortener/.env"

set -a
source "$ENV_PATH"
set +a

echo "Building Docker image: shortener:latest"
if ! docker build -t shortener:latest -f .ci/Dockerfile .; then
    echo "Error: Docker build failed."
    exit 1
fi

echo "Building Docker image: Edge"
if ! docker build -t shortener-edge -f .ci/Dockerfile.deno .; then
    echo "Error: Docker build failed."
    exit 1
fi

echo "Building Docker image: Frontend"
if ! docker build -t shortener-frontend -f .ci/Dockerfile.frontend .; then
    echo "Error: Docker build failed."
    exit 1
fi

echo "Removing existing stack: $STACK_NAME"
if docker stack rm "$STACK_NAME"; then
    echo "Waiting for stack to be removed..."
    sleep 10
else
    echo "Warning: Stack removal failed or stack did not exist."
fi

echo "Deploying stack: $STACK_NAME (force recreate)"
if ! docker stack deploy --with-registry-auth -c "$COMPOSE_FILE" "$STACK_NAME"; then
    echo "Error: Stack deployment failed."
    exit 1
fi

echo "Deployment complete."
exit 0