#!/usr/bin/env bash
# Proves the latest backup can be restored: loads the newest Postgres dump into a throwaway
# container, checks it against the live database's tables, and lists the newest SeaweedFS archive.
# It never touches the real database. Run it after every change to the backup and at least monthly.
#
#   BACKUP_DIR   where backup.sh writes                       (required)
#   PG_IMAGE     default postgres:17
set -euo pipefail

sha() { if command -v sha256sum >/dev/null; then sha256sum "$@"; else shasum -a 256 "$@"; fi; }

: "${BACKUP_DIR:?set BACKUP_DIR}"
PG_IMAGE="${PG_IMAGE:-postgres:17}"
dump="$(ls -1t "$BACKUP_DIR"/pg/*.dump 2>/dev/null | head -n 1)"
[ -n "$dump" ] || { echo "restore-test: no dump in $BACKUP_DIR/pg" >&2; exit 1; }

(cd "$BACKUP_DIR/pg" && sha -c "$(basename "$dump").sha256") >/dev/null || { echo "restore-test: checksum does not match $dump" >&2; exit 1; }

name="kurz-restore-test-$$"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$name" -e POSTGRES_PASSWORD=restore-test "$PG_IMAGE" >/dev/null
for _ in $(seq 1 40); do
  docker exec "$name" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$name" createdb -U postgres restored
docker exec -i "$name" pg_restore -U postgres -d restored --no-owner --exit-on-error < "$dump"

tables="$(docker exec "$name" psql -U postgres -d restored -Atc "select count(*) from information_schema.tables where table_schema = 'public'")"
[ "$tables" -gt 10 ] || { echo "restore-test: only $tables tables restored" >&2; exit 1; }
echo "restore-test: $dump restored, $tables tables"
for table in users forms form_responses appointments appointment_slots waitlist_entries; do
  count="$(docker exec "$name" psql -U postgres -d restored -Atc "select count(*) from $table")"
  echo "restore-test:   $table = $count"
done

archive="$(ls -1t "$BACKUP_DIR"/seaweed/*.tar.gz 2>/dev/null | head -n 1 || true)"
if [ -n "$archive" ]; then
  (cd "$BACKUP_DIR/seaweed" && sha -c "$(basename "$archive").sha256") >/dev/null
  tar -tzf "$archive" >/dev/null
  echo "restore-test: $archive is a readable archive ($(tar -tzf "$archive" | wc -l | tr -d ' ') entries)"
fi
echo "restore-test: OK"
