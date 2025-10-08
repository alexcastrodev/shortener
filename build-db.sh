#!/bin/bash
set -euo pipefail

COMPOSE_FILE=".ci/db-stack.yml"
STACK_NAME="shortener"

echo "Deploying stack: $STACK_NAME (force recreate)"
if ! docker stack deploy --with-registry-auth -c "$COMPOSE_FILE" "$STACK_NAME"; then
    echo "Error: Stack deployment failed."
    exit 1
fi

echo "Deployment complete."
exit 0