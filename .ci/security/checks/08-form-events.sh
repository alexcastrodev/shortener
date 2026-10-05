EV_PATH="/api/public/forms/$SUB_ID/events"
ev() { post_as "$1" "$EV_PATH" "$2" "${@:3}"; }
rcli() { redis-cli -h cache "$@"; }
totals() { sql "select coalesce(sum(views),0) || ',' || coalesce(sum(unique_views),0) || ',' || coalesce(sum(starts),0) from form_daily_stats where form_id = $SUB_FORM"; }

event_answers_204_with_no_body() {
  local got; got=$(ev 198.51.100.40 '{"event":"view"}')
  [ "$(code "$got")" = 204 ] && [ -z "$(payload "$got")" ] || { echo "$(code "$got") [$(payload "$got")]"; return 1; }
}
unique_views_count_a_visitor_once() {
  local before after
  before=$(totals)
  for _ in 1 2 3; do ev 198.51.100.41 '{"event":"view"}' -H 'User-Agent: harness-a' >/dev/null; done
  ev 198.51.100.42 '{"event":"view"}' -H 'User-Agent: harness-a' >/dev/null
  ev 198.51.100.41 '{"event":"view"}' -H 'User-Agent: harness-b' >/dev/null
  ev 198.51.100.41 '{"event":"start"}' >/dev/null
  after=$(totals)
  python3 - "$before" "$after" <<'P'
import sys
b = [int(x) for x in sys.argv[1].split(",")]
a = [int(x) for x in sys.argv[2].split(",")]
d = [y - x for x, y in zip(b, a)]
print("delta views,unique,starts =", d)
sys.exit(0 if d == [5, 3, 1] else 1)
P
}
parallel_events_lose_nothing() {
  local before codes after
  before=$(totals | cut -d, -f1)
  codes=$(seq 30 | xargs -P30 -I{} curl -s -o /dev/null -w '%{http_code}\n' -X POST -H "CF-Connecting-IP: 192.0.2.{}" -H 'Content-Type: application/json' -d '{"event":"view"}' "$API$EV_PATH")
  after=$(totals | cut -d, -f1)
  [ "$(printf '%s\n' "$codes" | grep -c '^204$')" = 30 ] && [ "$(( after - before ))" = 30 ] || { echo "204s=$(printf '%s\n' "$codes" | grep -c '^204$') views+$(( after - before ))"; return 1; }
}
bad_events_change_nothing() {
  local before fail=0 got
  before=$(totals)
  got=$(code "$(ev 198.51.100.43 '{"event":"purchase"}')"); [ "$got" = 422 ] || { echo "unknown -> $got"; fail=1; }
  got=$(code "$(ev 198.51.100.43 '{"event":["view"]}')"); [ "$got" -lt 500 ] || { echo "array -> $got"; fail=1; }
  got=$(code "$(post_as 198.51.100.43 "/api/public/forms/$DRAFT_ID/events" '{"event":"view"}')"); [ "$got" = 404 ] || { echo "draft -> $got"; fail=1; }
  got=$(code "$(post_as 198.51.100.43 "/api/public/forms/ZZZZZZZZZZZZ/events" '{"event":"view"}')"); [ "$got" = 404 ] || { echo "missing -> $got"; fail=1; }
  got=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'CF-Connecting-IP: 198.51.100.43' -d 'event=view' "$API$EV_PATH"); [ "$got" = 415 ] || { echo "form-encoded -> $got"; fail=1; }
  got=$(code "$(ev 198.51.100.43 "{\"event\":\"view\",\"pad\":\"$(printf 'a%.0s' $(seq 1 2000))\"}")"); [ "$got" = 413 ] || { echo "big -> $got"; fail=1; }
  [ "$(totals)" = "$before" ] || { echo "stats changed: $before -> $(totals)"; fail=1; }
  return $fail
}
sixty_one_events_from_one_ip_are_limited() {
  local i last
  for i in $(seq 1 60); do ev 198.51.100.44 '{"event":"view"}' >/dev/null; done
  last=$(code "$(ev 198.51.100.44 '{"event":"view"}')")
  expect 429 "$last" || return 1
  expect 204 "$(code "$(ev 198.51.100.45 '{"event":"view"}')")"
}
unique_keys_hold_no_visitor_data() {
  local key keys ttl fail=0
  ev 203.0.113.77 '{"event":"view"}' -H 'User-Agent: CNRY-agent-0001' >/dev/null
  keys=$(rcli --scan --pattern 'fv:*')
  [ -n "$keys" ] || { echo "no unique-view keys found: the scan could not see them"; return 1; }
  for key in $keys; do
    case "$key" in *203.0.113.77*|*CNRY*) echo "visitor data in key $key"; fail=1;; esac
    ttl=$(rcli ttl "$key")
    [ "$ttl" -gt 0 ] && [ "$ttl" -le 90000 ] || { echo "bad ttl $ttl on $key"; fail=1; }
  done
  return $fail
}
ip_only_lives_in_short_rate_limit_keys() {
  local key ttl fail=0 total=0
  for key in $(rcli --scan --pattern '*203.0.113.77*'); do
    total=$((total + 1))
    case "$key" in *rate-limit*) ;; *) echo "IP in non rate-limit key: $key"; fail=1;; esac
    ttl=$(rcli ttl "$key")
    [ "$ttl" -gt 0 ] && [ "$ttl" -le 86400 ] || { echo "ttl $ttl on $key"; fail=1; }
  done
  [ "$total" -gt 0 ] || { echo "control failed: no rate-limit key carries the canary IP"; return 1; }
  return $fail
}

t C20a M "an event answers 204 with an empty body" event_answers_204_with_no_body
t C20b M "unique views count a visitor once per day (IP+UA), starts count separately" unique_views_count_a_visitor_once
t C20c M "30 parallel events: every view is counted" parallel_events_lose_nothing
t C20d M "unknown events, draft/missing forms and wrong types change nothing and never 5xx" bad_events_change_nothing
t C20e M "60 events a minute from one IP, the 61st is 429, other IPs unaffected" sixty_one_events_from_one_ip_are_limited
t B04a M "unique-view keys in Valkey hold no IP or user agent and expire within 25 h" unique_keys_hold_no_visitor_data
t B04b M "the visitor IP is only in rate-limit keys that expire within a day" ip_only_lives_in_short_rate_limit_keys
