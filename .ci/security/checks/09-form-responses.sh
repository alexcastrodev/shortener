RS_BASE="/api/me/forms/$SUB_FORM"
count_rows() { sql "select count(*) from form_responses where form_id = $SUB_FORM"; }
seed_some() { for i in 1 2 3; do post_as "198.51.100.$((60 + i))" "$SUB_PATH" "$(good_body CNRY-R-$i-feed0005)" >/dev/null; done; }
seed_some

owner_lists_with_exact_keys() {
  local got keys
  got=$(call ownerA GET "$RS_BASE/responses?limit=2")
  [ "$(code "$got")" = 200 ] || { echo "status $(code "$got")"; return 1; }
  keys=$(payload "$got" | jq -c '.response[0] | keys')
  [ "$keys" = '["answers","browser","country","id","platform","source","submitted_at"]' ] || { echo "$keys"; return 1; }
  [ "$(payload "$got" | jq '.response | length')" = 2 ] && [ "$(payload "$got" | jq -r '.next_before')" != null ]
}
other_tenant_cannot_read_or_delete_responses() {
  local rid fail=0 got
  rid=$(payload "$(call ownerA GET "$RS_BASE/responses?limit=1")" | jq -r '.response[0].id')
  for spec in "GET:$RS_BASE/responses" "GET:$RS_BASE/summary" "GET:$RS_BASE/responses/$rid" "DELETE:$RS_BASE/responses/$rid" "DELETE:$RS_BASE/responses"; do
    got=$(code "$(call ownerB "${spec%%:*}" "${spec#*:}")")
    [ "$got" = 404 ] || { echo "$spec -> $got"; fail=1; }
  done
  [ "$(count_rows)" -gt 0 ] || { echo "rows were deleted"; fail=1; }
  return $fail
}
anonymous_cannot_read_responses() {
  expect 401 "$(status GET "$RS_BASE/responses")" && expect 401 "$(status GET "$RS_BASE/summary")"
}
responses_never_in_public_read() {
  case "$(payload "$(pub "/api/public/forms/$SUB_ID")")" in *CNRY*) echo "answer in public JSON"; return 1;; esac
}
summary_matches_rows_and_has_no_ip() {
  local got total
  got=$(call ownerA GET "$RS_BASE/summary?days=all")
  [ "$(code "$got")" = 200 ] || { echo "status $(code "$got")"; return 1; }
  total=$(payload "$got" | jq '.funnel.completions')
  [ "$total" = "$(count_rows)" ] || { echo "completions $total vs rows $(count_rows)"; return 1; }
  case "$(payload "$got")" in *198.51.100*|*203.0.113*) echo "IP in summary"; return 1;; esac
}
delete_one_updates_counter() {
  local rid before
  before=$(count_rows)
  rid=$(payload "$(call ownerA GET "$RS_BASE/responses?limit=1")" | jq -r '.response[0].id')
  expect 204 "$(code "$(call ownerA DELETE "$RS_BASE/responses/$rid")")" || return 1
  [ "$(count_rows)" = "$((before - 1))" ] && [ "$(sql "select responses_count from forms where id = $SUB_FORM")" = "$(count_rows)" ]
}
delete_all_leaves_no_trace() {
  expect 204 "$(code "$(call ownerA DELETE "$RS_BASE/responses")")" || return 1
  [ "$(count_rows)" = 0 ] && [ "$(sql "select responses_count from forms where id = $SUB_FORM")" = 0 ] || { echo "rows=$(count_rows)"; return 1; }
  local dump; dump=$(dump_database) || { printf %s "$dump"; return 1; }
  case "$dump" in *CNRY-R-*) echo "deleted answers still in the database"; return 1;; esac
}

t A02d M "owner lists responses with exactly the documented keys and a cursor" owner_lists_with_exact_keys
t A02e M "another tenant gets 404 on list, summary, show and both deletes; rows survive" other_tenant_cannot_read_or_delete_responses
t A02f M "anonymous list and summary answer 401" anonymous_cannot_read_responses
t A04d M "the public form read never contains answers" responses_never_in_public_read
t F4a M "summary completions equal the rows and carry no IP" summary_matches_rows_and_has_no_ip
t G06a M "deleting one response updates the counter" delete_one_updates_counter
t G06b M "deleting all responses leaves no trace in the database dump" delete_all_leaves_no_trace
