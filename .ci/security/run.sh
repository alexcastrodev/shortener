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
set +e
$C run --rm -T rails bin/rails runner /security/suite.rb 2>&1 | tee security/out/results.txt
rc=${PIPESTATUS[0]}
set -e

if [ "${ZAP:-0}" = 1 ]; then
  mkdir -p security/out/zap
  for target in / /.well-known/oauth-authorization-server /.well-known/oauth-protected-resource/mcp; do
    name=$(echo "$target" | tr -c 'a-z0-9' '_')
    docker run --rm --network kurzsec_sec -v "$PWD/security/out/zap:/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:stable \
      zap-baseline.py -t "http://api.kurz.fyi$target" -r "zap$name.html" -J "zap$name.json" -I -m 1 || true
  done
fi

# Sandbox oracle (D12): the image decoder has no secrets, no route to the database or the Internet, a read-only filesystem and no root.
sandbox_fail=0
leaked=$($C exec -T imgproc env | grep -cE 'SECRET|POSTGRES|REDIS|S3_|SENTRY|MASTER_KEY' || true)
[ "$leaked" = 0 ] || { echo "== sandbox: $leaked secret-looking variable(s) in imgproc"; sandbox_fail=1; }
for target in db:5432 cache:6379 1.1.1.1:443; do
  $C exec -T imgproc ruby -rsocket -e "host, port = '$target'.split(':'); begin; Socket.tcp(host, port.to_i, connect_timeout: 2) { exit 1 }; rescue StandardError; exit 0; end" || { echo "== sandbox: imgproc reached $target"; sandbox_fail=1; }
done
$C exec -T imgproc sh -c 'touch /rails/should-not-exist 2>/dev/null' && { echo "== sandbox: filesystem is writable"; sandbox_fail=1; }
[ "$($C exec -T imgproc id -u)" != 0 ] || { echo "== sandbox: imgproc runs as root"; sandbox_fail=1; }
echo "== oracle: sandbox isolation $([ "$sandbox_fail" = 0 ] && echo ok || echo FAILED)"
[ "$sandbox_fail" = 0 ] || rc=1

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
