#!/bin/bash
set -euo pipefail

# Stack name -> compose file. The database stack (deploy-db.sh) is deployed by hand.
STACKS=(
  "shortener:.ci/stack.yml"
  "shortenerfe:.ci/fe-stack.yml"
)
ENV_PATH="/mnt/ssd/@docker/shortener/.env"
DEPLOY_TIMEOUT="${DEPLOY_TIMEOUT:-15m}"

set -a
source "$ENV_PATH"
set +a

# Same variables the web service gets in .ci/stack.yml (the app boots fully for
# db:prepare). Passed by name from the sourced .env: --env-file would keep quotes.
MIGRATE_ENV=(
  POSTGRES_HOST POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB
  RABBITMQ_HOST RABBITMQ_DEFAULT_USER RABBITMQ_DEFAULT_PASS RABBITMQ_PORT
  REDIS_URL RAILS_MASTER_KEY EDGE_API GMAIL_USERNAME GMAIL_APP_PASSWORD FRONTEND_URL
  SENTRY_DSN S3_ENDPOINT S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY S3_BUCKET S3_FORMS_BUCKET
)

rolled_back() {
  local stack=$1 since=$2 service state started failed=1
  for service in $(docker stack services --format '{{.Name}}' "$stack"); do
    read -r state started <<<"$(docker service inspect --format '{{if .UpdateStatus}}{{.UpdateStatus.State}} {{.UpdateStatus.StartedAt.Unix}}{{end}}' "$service")"
    case "$state" in
      rollback_* | paused)
        if [ "${started:-0}" -ge "$since" ]; then
          echo "Error: $service could not be updated ($state); it runs the previous release."
          failed=0
        fi
        ;;
    esac
  done
  return "$failed"
}

migrate() {
  local args=(--rm --network proxy_net -e RAILS_ENV=production)
  for name in "${MIGRATE_ENV[@]}"; do
    args+=(-e "$name")
  done
  if [ -n "${MIGRATE_POSTGRES_USER:-}" ]; then
    args+=(-e "POSTGRES_USER=$MIGRATE_POSTGRES_USER" -e "POSTGRES_PASSWORD=${MIGRATE_POSTGRES_PASSWORD:?MIGRATE_POSTGRES_PASSWORD is required with MIGRATE_POSTGRES_USER}")
  fi

  echo "Running database migrations..."
  if ! docker run "${args[@]}" pizito:5001/shortener:latest ./bin/rails db:prepare; then
    echo "Error: Database migration failed; nothing was deployed."
    exit 1
  fi
}

for entry in "${STACKS[@]}"; do
  STACK_NAME="${entry%%:*}"
  COMPOSE_FILE="${entry#*:}"

  echo "Pulling latest images for $STACK_NAME..."
  if ! docker compose -f "$COMPOSE_FILE" pull; then
    echo "Error: Image pull failed."
    exit 1
  fi

  # Migrations run once, here, before any new container starts. Every backend service
  # used to run db:prepare on boot, and the losers of that race crashed with
  # ActiveRecord::ConcurrentMigrationError (see bin/docker-entrypoint). A failing
  # migration now stops the deploy before new code meets an old schema.
  if [ "$STACK_NAME" = "shortener" ]; then
    migrate
  fi

  echo "Deploying stack: $STACK_NAME (rolling update, new tasks start before old ones stop)"
  deploy_started=$(date +%s)
  if ! timeout "$DEPLOY_TIMEOUT" docker stack deploy --detach=false --prune --with-registry-auth -c "$COMPOSE_FILE" "$STACK_NAME"; then
    echo "Error: $STACK_NAME did not converge (a failed update rolls back to the previous release)."
    docker stack ps --no-trunc --filter desired-state=shutdown "$STACK_NAME" | head -15 || true
    exit 1
  fi
  if rolled_back "$STACK_NAME" "$deploy_started"; then
    exit 1
  fi
done

echo "Deployment complete."
exit 0
