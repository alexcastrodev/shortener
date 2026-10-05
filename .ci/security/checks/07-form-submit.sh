post_as() {
  local ip=$1 path=$2 body=$3; shift 3
  curl -s -w '\n%{http_code}' -X POST -H "CF-Connecting-IP: $ip" -H "X-Forwarded-For: $ip" -H 'Content-Type: application/json' "$@" -d "$body" "$API$path"
}

SUB_FORM=$(payload "$(call ownerA POST /api/me/forms '{"title":"Submit me","template":"contact"}')" | jq -r '.form.id')
SUB_ID=$(payload "$(call ownerA GET "/api/me/forms/$SUB_FORM")" | jq -r '.form.public_id')
call ownerA POST "/api/me/forms/$SUB_FORM/publish" >/dev/null
F_NAME=$(payload "$(call ownerA GET "/api/me/forms/$SUB_FORM")" | jq -r '.form.fields[0].id')
F_MAIL=$(payload "$(call ownerA GET "/api/me/forms/$SUB_FORM")" | jq -r '.form.fields[1].id')
F_MSG=$(payload "$(call ownerA GET "/api/me/forms/$SUB_FORM")" | jq -r '.form.fields[2].id')
SUB_PATH="/api/public/forms/$SUB_ID/responses"
CANARY_IP=203.0.113.77
rows() { sql "select count(*) from form_responses where form_id = $SUB_FORM"; }
good_body() { printf '{"answers":{"%s":"%s","%s":"cnry@example.com","%s":"hello"}}' "$F_NAME" "$1" "$F_MAIL" "$F_MSG"; }

submit_stores_and_answers_ok_only() {
  local got; got=$(post_as 198.51.100.10 "$SUB_PATH" "$(good_body CNRY-A-1-deadbeef)")
  [ "$(code "$got")" = 201 ] && [ "$(payload "$got")" = '{"ok":true}' ] || { echo "$(code "$got") $(payload "$got")"; return 1; }
  [ "$(rows)" = 1 ] || { echo "rows=$(rows)"; return 1; }
}
degraded_mode_limits_one_ip_to_five() {
  local i codes="" other
  for i in 1 2 3 4 5 6 7; do codes="$codes $(code "$(post_as $CANARY_IP "$SUB_PATH" "$(good_body CNRY-B-$i-cafe0001)")")"; done
  [ "$codes" = " 201 201 201 201 201 429 429" ] || { echo "$codes"; return 1; }
  other=$(code "$(post_as 198.51.100.11 "$SUB_PATH" "$(good_body CNRY-C-1-cafe0002)")")
  expect 201 "$other"
}
invalid_answers_answer_422_without_echo() {
  local got body
  got=$(post_as 198.51.100.12 "$SUB_PATH" "{\"answers\":{\"$F_NAME\":\"\",\"$F_MAIL\":\"CNRY-bad-mail\"}}")
  body=$(payload "$got")
  [ "$(code "$got")" = 422 ] || { echo "status $(code "$got")"; return 1; }
  case "$body" in *CNRY*) echo "value echoed"; return 1;; esac
  [ "$(printf %s "$body" | jq -r ".errors.answers[\"$F_NAME\"][0]")" = blank ] || { echo "$body"; return 1; }
}
honeypot_pretends_and_stores_nothing() {
  local before after got
  before=$(rows)
  got=$(post_as 198.51.100.13 "$SUB_PATH" "{\"website\":\"http://spam.example\",\"answers\":{\"$F_NAME\":\"CNRY-spam\"}}")
  after=$(rows)
  [ "$(code "$got")" = 201 ] && [ "$before" = "$after" ] || { echo "$(code "$got") rows $before -> $after"; return 1; }
}
submit_404_is_uniform() {
  local missing id got fail=0
  missing=$(post_as 198.51.100.14 /api/public/forms/ZZZZZZZZZZZZ/responses '{"answers":{}}')
  [ "$(code "$missing")" = 404 ] || { echo "missing -> $(code "$missing")"; return 1; }
  for id in "$DRAFT_ID" "$GONE_ID" x; do
    got=$(post_as 198.51.100.15 "/api/public/forms/$id/responses" '{"answers":{}}')
    [ "$got" = "$missing" ] || { echo "differs for $id: $(code "$got")"; fail=1; }
  done
  return $fail
}
oversized_bodies_are_refused() {
  local big got fail=0
  big=$(python3 -c 'import json; print(json.dumps({"answers": {"x": "a" * 70000}}))')
  got=$(code "$(post_as 198.51.100.16 "$SUB_PATH" "$big")"); [ "$got" = 413 ] || { echo "content-length -> $got"; fail=1; }
  got=$(printf %s "$big" | curl -s -o /dev/null -w '%{http_code}' -X POST -H "CF-Connecting-IP: 198.51.100.17" -H 'Content-Type: application/json' -H 'Transfer-Encoding: chunked' --data-binary @- "$API$SUB_PATH")
  [ "$got" = 413 ] || { echo "chunked -> $got"; fail=1; }
  return $fail
}
wrong_content_types_and_broken_json_never_5xx() {
  local fail=0 got
  got=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "CF-Connecting-IP: 198.51.100.18" -d 'answers[x]=1' "$API$SUB_PATH"); [ "$got" = 415 ] || { echo "urlencoded -> $got"; fail=1; }
  got=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "CF-Connecting-IP: 198.51.100.18" -H 'Content-Type: text/plain' -d '{}' "$API$SUB_PATH"); [ "$got" = 415 ] || { echo "text -> $got"; fail=1; }
  got=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "CF-Connecting-IP: 198.51.100.18" -F 'a=1' "$API$SUB_PATH"); [ "$got" = 415 ] || { echo "multipart -> $got"; fail=1; }
  got=$(code "$(post_as 198.51.100.18 "$SUB_PATH" '{not json')"); [ "$got" = 400 ] || { echo "broken -> $got"; fail=1; }
  got=$(code "$(post_as 198.51.100.18 "$SUB_PATH" "{\"answers\":{\"$F_NAME\":\"a\\u0000b\"}}")"); [ "$got" = 400 ] || { echo "nul -> $got"; fail=1; }
  got=$(code "$(post_as 198.51.100.18 "$SUB_PATH" '{"answers":[1,2],"turnstile_token":["a"],"idempotency_key":{"a":1}}')"); [ "$got" -lt 500 ] || { echo "odd shapes -> $got"; fail=1; }
  return $fail
}
same_key_in_parallel_stores_one_row() {
  local before codes created
  before=$(rows)
  codes=$(seq 10 | xargs -P10 -I{} curl -s -o /dev/null -w '%{http_code}\n' -X POST -H "CF-Connecting-IP: 198.51.100.{}" -H 'Content-Type: application/json' \
    -d "$(good_body CNRY-D-1-feed0003 | sed 's/}}$/},"idempotency_key":"burst-key-1"}/')" "$API$SUB_PATH")
  created=$(printf '%s\n' "$codes" | grep -c '^201$' || true)
  [ "$created" = 1 ] && [ "$(printf '%s\n' "$codes" | grep -cE '^(201|200)$')" = 10 ] && [ "$(( $(rows) - before ))" = 1 ] || { echo "created=$created codes=$(printf '%s ' $codes) rows+$(( $(rows) - before ))"; return 1; }
}
counter_matches_rows_after_parallel_submits() {
  seq 20 | xargs -P20 -I{} curl -s -o /dev/null -X POST -H "CF-Connecting-IP: 192.0.2.{}" -H 'Content-Type: application/json' -d "$(good_body CNRY-E-1-feed0004)" "$API$SUB_PATH"
  [ "$(sql "select responses_count from forms where id = $SUB_FORM")" = "$(rows)" ] || { echo "count $(sql "select responses_count from forms where id = $SUB_FORM") vs rows $(rows)"; return 1; }
}
dump_database() {
  local out
  out=$(PGPASSWORD=postgres pg_dump -h db -U postgres -d production --data-only --inserts 2>&1) || { echo "pg_dump failed: $(printf %s "$out" | head -c 150)"; return 1; }
  printf %s "$out" | grep -q 'INSERT INTO public.users' || { echo "pg_dump produced no user rows"; return 1; }
  printf %s "$out"
}
no_ip_is_persisted() {
  local dump hits
  dump=$(dump_database) || { printf %s "$dump"; return 1; }
  printf %s "$dump" | grep -qE '([0-9]{1,3}\.){3}[0-9]{1,3}' || { echo "control failed: the dump has no IP at all, so this check could not see one"; return 1; }
  hits=$(printf %s "$dump" | grep -cE "203\.0\.113\.77|2001:db8:dead:beef" || true)
  [ "$hits" = 0 ] || { echo "IP canary found $hits time(s) in the database dump"; return 1; }
}
answers_live_only_in_form_responses() {
  local dump tables
  dump=$(dump_database) || { printf %s "$dump"; return 1; }
  tables=$(printf %s "$dump" | awk '/^INSERT INTO/ {t=$3} /CNRY-/ {print t}' | sort -u | tr '\n' ' ')
  [ "$tables" = "public.form_responses " ] || { echo "canary found in: [$tables]"; return 1; }
}

t C01a M "a valid submission stores one row and answers exactly {ok:true}" submit_stores_and_answers_ok_only
t C03a M "with Cloudflare unavailable one IP gets 5 submissions per 10 minutes, then 429; other IPs are free" degraded_mode_limits_one_ip_to_five
t C10a M "invalid answers answer 422 by field id without echoing the value" invalid_answers_answer_422_without_echo
t C09a M "a filled honeypot looks like success but stores nothing" honeypot_pretends_and_stores_nothing
t A06a M "submitting to a missing, draft or deleted form answers the same 404" submit_404_is_uniform
t A11b M "bodies over 64 KB are refused with 413, with Content-Length and chunked" oversized_bodies_are_refused
t C16a M "non-JSON types answer 415, broken JSON and NUL answer 400, odd shapes never 5xx" wrong_content_types_and_broken_json_never_5xx
t C08a M "the same idempotency key in 10 parallel requests stores exactly one row" same_key_in_parallel_stores_one_row
t C07a M "responses_count equals count(*) after 20 parallel submissions" counter_matches_rows_after_parallel_submits
t G04a M "the visitor IP is nowhere in the database dump" no_ip_is_persisted
t B05a M "answers (canary) exist only in form_responses, never in another table" answers_live_only_in_form_responses
