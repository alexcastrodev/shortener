#!/bin/bash
set -euo pipefail

COMPOSE_FILE=".ci/db-stack.yml"
STACK_NAME="shortenerdb"
ENV_PATH="/mnt/ssd/docker/shortener/.env"

set -a
source "$ENV_PATH"
set +a

echo "Deploying stack: $STACK_NAME (force recreate)"
if ! docker stack deploy --with-registry-auth -c "$COMPOSE_FILE" "$STACK_NAME"; then
    echo "Error: Stack deployment failed."
    exit 1
fi

echo "Deployment complete."
exit 0