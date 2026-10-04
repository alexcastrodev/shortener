# Helpers shared by the checks. Runs inside the runner container.
API="${API:-http://api.kurz.fyi}"
RESULTS=/out/results.tsv
FAILED=0

tok() { jq -r ".$1.token" /out/tokens.json; }
uid() { jq -r ".$1.id" /out/tokens.json; }

# status METHOD PATH [curl args...] -> HTTP status. Every request comes from its own client IP
# (documentation range), like Cloudflare's CF-Connecting-IP in production.
status() {
  local method=$1 path=$2; shift 2
  curl -s -o /dev/null -w '%{http_code}' -X "$method" -H "CF-Connecting-IP: 198.51.100.$((RANDOM % 250 + 1))" "$@" "$API$path"
}

# expect WANT GOT
expect() { [ "$1" = "$2" ] || { echo "want $1, got $2"; return 1; }; }

# t ID PRIO "description" command...   PRIO: M blocks, N is nice to have.
t() {
  local id=$1 prio=$2 desc=$3; shift 3
  local out rc=0
  out=$("$@" 2>&1) || rc=$?
  local verdict=PASS
  if [ "$rc" -ne 0 ]; then verdict=FAIL; [ "$prio" = M ] && FAILED=1; fi
  printf '%s\t%s\t%s\t%s\t%s\n' "$id" "$prio" "$verdict" "$desc" "$(printf %s "$out" | head -c 200 | tr '\n\t' '  ')" >> "$RESULTS"
  printf '%-8s %-2s %-5s %s %s\n' "$id" "$prio" "$verdict" "$desc" "$([ "$rc" -ne 0 ] && printf '(%s)' "$(printf %s "$out" | head -c 120 | tr '\n' ' ')")"
}
