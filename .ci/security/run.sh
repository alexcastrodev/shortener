#!/usr/bin/env bash
# Local security harness: builds the production API image, starts it on an internal network,
# seeds tenants and runs the checks from inside that network. Output: security/out/results.tsv.
set -euo pipefail
cd "$(dirname "$0")/.."

# Interlocks: refuse to run anywhere that could be production.
case "$(docker context show)" in desktop-linux|default) ;; *) echo "refusing: docker context $(docker context show)"; exit 2;; esac
[ -z "${DOCKER_HOST:-}" ] || { echo "refusing: DOCKER_HOST is set"; exit 2; }
[ "$(hostname -s)" != "pizito" ] || { echo "refusing: this is the production host"; exit 2; }

export SEC_SECRET_KEY_BASE="$(openssl rand -hex 64)"
C="docker compose -f compose.security.yml"
rm -f security/out/results.tsv security/out/tokens.json
trap '$C down -v --remove-orphans >/dev/null 2>&1 || true' EXIT

$C build migrate runner
$C up -d --wait api
[ "$(docker network inspect kurzsec_sec -f '{{.Internal}}')" = true ] || { echo "refusing: network is not internal"; exit 2; }

$C run --rm -T rails bin/rails runner /security/seed.rb | sed -n 's/^TOKENS://p' > security/out/tokens.json
[ -s security/out/tokens.json ] || { echo "seed produced no tokens"; exit 2; }
$C run --rm -T rails bin/rails runner /security/routes.rb | sed -n 's/^ROUTE://p' > security/out/routes.txt
[ -s security/out/routes.txt ] || { echo "route dump is empty"; exit 2; }
rc=0
$C run --rm runner bash /security/checks/run-all.sh || rc=$?

# Global oracle: no request may end in a 5xx, whatever the check was about.
fivexx=$($C logs api 2>&1 | grep -cE 'Completed 5[0-9]{2}' || true)
echo "== oracle: $fivexx request(s) ended in 5xx"
[ "$fivexx" = 0 ] || rc=1
exit "$rc"
