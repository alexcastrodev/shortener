pub() { curl -s -w '\n%{http_code}' -H "CF-Connecting-IP: 198.51.100.$((RANDOM % 250 + 1))" "$API$1"; }

PUB_FORM=$(payload "$(call ownerA POST /api/me/forms '{"title":"Public one","description":"d","template":"contact"}')" | jq -r '.form.id')
PUB_ID=$(payload "$(call ownerA GET "/api/me/forms/$PUB_FORM")" | jq -r '.form.public_id')
call ownerA POST "/api/me/forms/$PUB_FORM/publish" >/dev/null
DRAFT_ID=$(payload "$(call ownerA POST /api/me/forms '{"title":"Draft"}')" | jq -r '.form.public_id')
GONE_FORM=$(payload "$(call ownerA POST /api/me/forms '{"title":"Gone","template":"contact"}')" | jq -r '.form.id')
GONE_ID=$(payload "$(call ownerA GET "/api/me/forms/$GONE_FORM")" | jq -r '.form.public_id')
call ownerA POST "/api/me/forms/$GONE_FORM/publish" >/dev/null
call ownerA DELETE "/api/me/forms/$GONE_FORM" >/dev/null

public_keys_are_whitelisted() {
  local body keys
  body=$(payload "$(pub "/api/public/forms/$PUB_ID")")
  keys=$(printf %s "$body" | jq -c '.form | keys')
  [ "$keys" = '["description","fields","thank_you_message","theme","title"]' ] || { echo "$keys"; return 1; }
  for leak in user_id responses_count published created_at updated_at public_id "owner-a@sec.test"; do
    case "$body" in *"$leak"*) echo "leaked: $leak"; return 1;; esac
  done
}
public_field_keys_are_whitelisted() {
  local extra
  extra=$(payload "$(pub "/api/public/forms/$PUB_ID")" | jq -r '[.form.fields[] | keys[]] | unique - ["id","type","label","help","required","choices","max_choices","scale","min","max"] | join(",")')
  [ -z "$extra" ] || { echo "extra keys: $extra"; return 1; }
}
not_found_is_uniform() {
  local missing id got big fail=0
  missing=$(pub /api/public/forms/ZZZZZZZZZZZZ)
  [ "$(code "$missing")" = 404 ] || { echo "missing -> $(code "$missing")"; return 1; }
  big=$(printf 'a%.0s' $(seq 1 10000))
  for id in "$DRAFT_ID" "$GONE_ID" x "$big" "1%27%20OR%20%271%27%3D%271" "..%2f..%2fetc"; do
    got=$(pub "/api/public/forms/$id")
    if [ "$id" = "..%2f..%2fetc" ]; then
      [ "$(code "$got")" = 404 ] || { echo "path id -> $(code "$got")"; fail=1; }
    elif [ "$id" = "$big" ]; then
      case "$(code "$got")" in 400|404|414) ;; *) echo "10k id -> $(code "$got")"; fail=1;; esac
    elif [ "$got" != "$missing" ]; then
      echo "differs for ${id:0:20}: $(code "$got")"; fail=1
    fi
  done
  return $fail
}
nul_bytes_never_reach_the_database() {
  local fail=0 path got
  for path in /api/public/forms/%00 /api/public/forms/ab%00cd /api/public/shortlinks/%00 /api/public/pages/%00; do
    got=$(code "$(pub "$path")")
    [ "$got" = 400 ] || { echo "$path -> $got"; fail=1; }
  done
  got=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{"password":"x"}' "$API/api/public/shortlinks/%00/unlock")
  [ "$got" = 400 ] || { echo "unlock -> $got"; fail=1; }
  return $fail
}
unpublish_takes_effect_at_once() {
  expect 200 "$(code "$(pub "/api/public/forms/$PUB_ID")")" || return 1
  call ownerA POST "/api/me/forms/$PUB_FORM/unpublish" >/dev/null
  expect 404 "$(code "$(pub "/api/public/forms/$PUB_ID")")" || return 1
  call ownerA POST "/api/me/forms/$PUB_FORM/publish" >/dev/null
  expect 200 "$(code "$(pub "/api/public/forms/$PUB_ID")")"
}
public_read_sets_no_cookie() {
  local headers; headers=$(curl -s -D - -o /dev/null "$API/api/public/forms/$PUB_ID")
  case "$(printf %s "$headers" | tr 'A-Z' 'a-z')" in *set-cookie*) echo "Set-Cookie present"; return 1;; esac
}

t A04b M "public form JSON has exactly the whitelisted keys and leaks nothing" public_keys_are_whitelisted
t A04c M "public field objects only carry whitelisted keys" public_field_keys_are_whitelisted
t A05 M "missing, draft, deleted and SQL-looking ids answer the same 404; a 10k-char id is refused without a 5xx" not_found_is_uniform
t A10a M "a NUL byte in a public path or query is a 400, never a 5xx (forms, pages, shortlinks, unlock)" nul_bytes_never_reach_the_database
t A14a M "unpublishing hides the form at once and republishing brings it back" unpublish_takes_effect_at_once
t F05a M "the public form read sets no cookie" public_read_sets_no_cookie
