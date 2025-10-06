#!/bin/bash
set -euo pipefail

IMAGE_NAME="shortener:latest"
DOCKERFILE=".ci/Dockerfile"
COMPOSE_FILE=".ci/stack.yml"
STACK_NAME="shortener"

echo "Building Docker image: $IMAGE_NAME"
if ! docker build -t "$IMAGE_NAME" -f "$DOCKERFILE" .; then
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