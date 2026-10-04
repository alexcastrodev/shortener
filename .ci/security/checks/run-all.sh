#!/usr/bin/env bash
# Runs every check in order; exits 1 if any (M) check failed.
. /security/lib.sh
: > "$RESULTS"
for f in /security/checks/[0-9]*.sh; do
  echo "== $(basename "$f")"
  . "$f"
done
exit "$FAILED"
