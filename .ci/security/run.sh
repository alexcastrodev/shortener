#!/usr/bin/env bash
# Local security harness: builds the production API image, starts it on an internal network and
# runs security/suite.rb (Ruby) inside it. Output: security/out/results.txt.
set -euo pipefail
cd "$(dirname "$0")/.."

# Interlocks: refuse to run anywhere that could be production.
case "$(docker context show)" in desktop-linux|default) ;; *) echo "refusing: docker context $(docker context show)"; exit 2;; esac
[ -z "${DOCKER_HOST:-}" ] || { echo "refusing: DOCKER_HOST is set"; exit 2; }
[ "$(hostname -s)" != "pizito" ] || { echo "refusing: this is the production host"; exit 2; }

export SEC_SECRET_KEY_BASE="$(openssl rand -hex 64)"
C="docker compose -f compose.security.yml"
rm -f security/out/results.txt
trap '$C down -v --remove-orphans >/dev/null 2>&1 || true' EXIT

$C build migrate
$C up -d --wait api
[ "$(docker network inspect kurzsec_sec -f '{{.Internal}}')" = true ] || { echo "refusing: network is not internal"; exit 2; }

rc=0
$C run --rm -T rails bin/rails runner /security/suite.rb 2>&1 | tee security/out/results.txt
rc=${PIPESTATUS[0]}

if [ "${ZAP:-0}" = 1 ]; then
  mkdir -p security/out/zap
  for target in / /.well-known/oauth-authorization-server /.well-known/oauth-protected-resource/mcp; do
    name=$(echo "$target" | tr -c 'a-z0-9' '_')
    docker run --rm --network kurzsec_sec -v "$PWD/security/out/zap:/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:stable \
      zap-baseline.py -t "http://api.kurz.fyi$target" -r "zap$name.html" -J "zap$name.json" -I -m 1 || true
  done
fi

# Global oracle: no request may end in a 5xx, whatever the check was about.
fivexx=$($C logs api 2>&1 | grep -cE 'Completed 5[0-9]{2}' || true)
echo "== oracle: $fivexx request(s) ended in 5xx"
[ "$fivexx" = 0 ] || rc=1

# Canary oracle: an answer typed by a respondent must never reach the API logs.
leaks=$($C logs api 2>&1 | grep -c 'CNRY-' || true)
echo "== oracle: $leaks log line(s) carry a respondent canary"
[ "$leaks" = 0 ] || $C logs api 2>&1 | grep 'CNRY-' | head -3 | cut -c1-400
[ "$leaks" = 0 ] || rc=1

ips=$($C logs api 2>&1 | grep -cE '203\.0\.113\.77|2001:db8:dead:beef' || true)
echo "== oracle: $ips log line(s) carry the visitor IP canary"
[ "$ips" = 0 ] || $C logs api 2>&1 | grep -E '203\.0\.113\.77|2001:db8:dead:beef' | head -3 | cut -c1-400
[ "$ips" = 0 ] || rc=1
exit "$rc"
