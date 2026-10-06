#!/usr/bin/env bash
# Daily backup of Kurz: a Postgres dump and a copy of the SeaweedFS data.
# Everything comes from the environment so the same script runs on pizito or anywhere else.
#
#   BACKUP_DIR        where backups are written                     (required)
#   PG_CONTAINER      name filter of the Postgres container         (required)
#   PG_USER, PG_DB    default postgres / production
#   SEAWEED_DATA      SeaweedFS data directory                      (optional: skipped when empty)
#   KEEP              how many daily copies to keep, default 14
#   REMOTE            rsync target for an off-host copy, e.g. user@host:/backups/kurz (optional)
set -euo pipefail

sha() { if command -v sha256sum >/dev/null; then sha256sum "$@"; else shasum -a 256 "$@"; fi; }

: "${BACKUP_DIR:?set BACKUP_DIR}"
: "${PG_CONTAINER:?set PG_CONTAINER}"
PG_USER="${PG_USER:-postgres}"
PG_DB="${PG_DB:-production}"
KEEP="${KEEP:-14}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"

umask 077
mkdir -p "$BACKUP_DIR/pg" "$BACKUP_DIR/seaweed"

container="$(docker ps --filter "name=$PG_CONTAINER" --format '{{.ID}}' | head -n 1)"
[ -n "$container" ] || { echo "backup: no running container matches '$PG_CONTAINER'" >&2; exit 1; }

dump="$BACKUP_DIR/pg/kurz-$stamp.dump"
docker exec "$container" pg_dump -U "$PG_USER" -Fc "$PG_DB" > "$dump.partial"
mv "$dump.partial" "$dump"
[ -s "$dump" ] || { echo "backup: empty dump" >&2; rm -f "$dump"; exit 1; }
(cd "$BACKUP_DIR/pg" && sha "$(basename "$dump")" > "$(basename "$dump").sha256")
echo "backup: postgres $(du -h "$dump" | cut -f1) -> $dump"

if [ -n "${SEAWEED_DATA:-}" ]; then
  archive="$BACKUP_DIR/seaweed/seaweed-$stamp.tar.gz"
  tar -czf "$archive.partial" -C "$(dirname "$SEAWEED_DATA")" "$(basename "$SEAWEED_DATA")"
  mv "$archive.partial" "$archive"
  (cd "$BACKUP_DIR/seaweed" && sha "$(basename "$archive")" > "$(basename "$archive").sha256")
  echo "backup: seaweedfs $(du -h "$archive" | cut -f1) -> $archive"
fi

for dir in pg seaweed; do
  ls -1t "$BACKUP_DIR/$dir" 2>/dev/null | grep -E '\.(dump|tar\.gz)$' | tail -n +"$((KEEP + 1))" | while read -r old; do
    rm -f "$BACKUP_DIR/$dir/$old" "$BACKUP_DIR/$dir/$old.sha256"
  done
done

if [ -n "${REMOTE:-}" ]; then
  rsync -a --delete "$BACKUP_DIR/" "$REMOTE/"
  echo "backup: copied off-host to $REMOTE"
fi
echo "backup: done $stamp"
