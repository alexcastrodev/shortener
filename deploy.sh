#!/bin/bash
set -euo pipefail

# Stack name -> compose file. The database stack (deploy-db.sh) is deployed by hand.
STACKS=(
  "shortener:.ci/stack.yml"
  "shortenerfe:.ci/fe-stack.yml"
)
ENV_PATH="/mnt/ssd/@docker/shortener/.env"

set -a
source "$ENV_PATH"
set +a

for entry in "${STACKS[@]}"; do
  STACK_NAME="${entry%%:*}"
  COMPOSE_FILE="${entry#*:}"

  echo "Pulling latest images for $STACK_NAME..."
  if ! docker compose -f "$COMPOSE_FILE" pull; then
    echo "Error: Image pull failed."
    exit 1
  fi

  echo "Deploying stack: $STACK_NAME (rolling update)"
  if ! docker stack deploy --prune --with-registry-auth -c "$COMPOSE_FILE" "$STACK_NAME"; then
    echo "Error: Stack deployment failed."
    exit 1
  fi
done

echo "Deployment complete."
exit 0
