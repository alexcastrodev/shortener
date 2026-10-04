new_form() { payload "$(call "$1" POST /api/me/forms "{\"title\":\"$2\"}")" | jq -r '.form.id'; }
add_field() { payload "$(call "$1" POST "/api/me/forms/$2/fields" "{\"type\":\"short_text\",\"label\":\"$3\"}")"; }
field_ids() { payload "$(call "$1" GET "/api/me/forms/$2")" | jq -r '.form.fields[].id'; }

FORM_X=$(new_form ownerA "X")
FORM_Y=$(new_form ownerA "Y")
add_field ownerA "$FORM_X" "x-question" >/dev/null
add_field ownerA "$FORM_Y" "y-question" >/dev/null
FIELD_X=$(field_ids ownerA "$FORM_X" | head -1)
FIELD_Y=$(field_ids ownerA "$FORM_Y" | head -1)

cross_parent_field() {
  local fail=0 got
  got=$(code "$(call ownerA PATCH "/api/me/forms/$FORM_Y/fields/$FIELD_X" '{"label":"hijack"}')"); [ "$got" = 404 ] || { echo "patch -> $got"; fail=1; }
  got=$(code "$(call ownerA DELETE "/api/me/forms/$FORM_Y/fields/$FIELD_X")"); [ "$got" = 404 ] || { echo "delete -> $got"; fail=1; }
  got=$(code "$(call ownerA PATCH "/api/me/forms/$FORM_Y/fields/reorder" "{\"ids\":[\"$FIELD_X\"]}")"); [ "$got" = 422 ] || { echo "reorder -> $got"; fail=1; }
  [ "$(field_ids ownerA "$FORM_X")" = "$FIELD_X" ] && [ "$(field_ids ownerA "$FORM_Y")" = "$FIELD_Y" ] || { echo "fields changed"; fail=1; }
  return $fail
}
other_tenant_cannot_touch_fields() {
  local fail=0 got
  got=$(code "$(call ownerB POST "/api/me/forms/$FORM_X/fields" '{"type":"short_text","label":"x"}')"); [ "$got" = 404 ] || { echo "add -> $got"; fail=1; }
  got=$(code "$(call ownerB PATCH "/api/me/forms/$FORM_X/fields/$FIELD_X" '{"label":"x"}')"); [ "$got" = 404 ] || { echo "update -> $got"; fail=1; }
  got=$(code "$(call ownerB DELETE "/api/me/forms/$FORM_X/fields/$FIELD_X")"); [ "$got" = 404 ] || { echo "delete -> $got"; fail=1; }
  got=$(code "$(call ownerB PATCH "/api/me/forms/$FORM_X/fields/reorder" "{\"ids\":[\"$FIELD_X\"]}")"); [ "$got" = 404 ] || { echo "reorder -> $got"; fail=1; }
  got=$(code "$(call ownerB POST "/api/me/forms/$FORM_X/duplicate")"); [ "$got" = 404 ] || { echo "duplicate -> $got"; fail=1; }
  got=$(code "$(call ownerB POST "/api/me/forms/$FORM_X/apply_template" '{"template":"contact"}')"); [ "$got" = 404 ] || { echo "template -> $got"; fail=1; }
  [ "$(field_ids ownerA "$FORM_X")" = "$FIELD_X" ] || { echo "X changed"; fail=1; }
  return $fail
}
parallel_adds_lose_nothing() {
  local form codes created ids total unique
  form=$(new_form ownerA "race-add")
  codes=$(seq 30 | xargs -P30 -I{} curl -s -o /dev/null -w '%{http_code}\n' -X POST -H "CF-Connecting-IP: 198.51.100.{}" \
    -H "Authorization: Bearer $(tok ownerA)" -H 'Content-Type: application/json' -d '{"type":"short_text","label":"q{}"}' "$API/api/me/forms/$form/fields")
  created=$(printf '%s\n' "$codes" | grep -c '^201$' || true)
  ids=$(field_ids ownerA "$form")
  total=$(printf '%s\n' "$ids" | grep -c . || true)
  unique=$(printf '%s\n' "$ids" | sort -u | grep -c . || true)
  [ "$created" = 30 ] && [ "$total" = 30 ] && [ "$unique" = 30 ] || { echo "created=$created stored=$total unique=$unique"; return 1; }
}
reorder_and_add_in_parallel() {
  local form i ids rev codes added bad total unique
  form=$(new_form ownerA "race-mix")
  for i in 1 2 3 4 5; do add_field ownerA "$form" "base$i" >/dev/null; done
  ids=$(field_ids ownerA "$form" | jq -R . | jq -sc .)
  rev=$(printf %s "$ids" | jq -c 'reverse')
  codes=$( {
    seq 10 | xargs -P10 -I{} curl -s -o /dev/null -w 'A%{http_code}\n' -X POST -H "CF-Connecting-IP: 198.51.100.{}" -H "Authorization: Bearer $(tok ownerA)" -H 'Content-Type: application/json' -d '{"type":"short_text","label":"mix{}"}' "$API/api/me/forms/$form/fields" &
    seq 10 | xargs -P10 -I{} curl -s -o /dev/null -w 'R%{http_code}\n' -X PATCH -H "CF-Connecting-IP: 198.51.100.1{}" -H "Authorization: Bearer $(tok ownerA)" -H 'Content-Type: application/json' -d "{\"ids\":$rev}" "$API/api/me/forms/$form/fields/reorder" &
    wait
  } )
  added=$(printf '%s\n' "$codes" | grep -c '^A201$' || true)
  bad=$(printf '%s\n' "$codes" | grep -vcE '^(A201|R200|R422)$' || true)
  ids=$(field_ids ownerA "$form")
  total=$(printf '%s\n' "$ids" | grep -c . || true)
  unique=$(printf '%s\n' "$ids" | sort -u | grep -c . || true)
  [ "$added" = 10 ] && [ "$total" = 15 ] && [ "$unique" = 15 ] && [ "$bad" = 0 ] || { echo "added=$added stored=$total unique=$unique unexpected=$bad"; return 1; }
}
duplicate_has_fresh_identity() {
  local copy
  copy=$(payload "$(call ownerA POST "/api/me/forms/$FORM_X/duplicate")")
  [ "$(printf %s "$copy" | jq -r '.form.published')" = false ] && [ "$(printf %s "$copy" | jq -r '.form.fields[0].id')" != "$FIELD_X" ] \
    && [ "$(printf %s "$copy" | jq -r '.form.public_id')" != "$(payload "$(call ownerA GET "/api/me/forms/$FORM_X")" | jq -r '.form.public_id')" ] || { echo "$copy" | head -c 200; return 1; }
}

t A03 M "a field of one form cannot be changed or reordered through another form" cross_parent_field
t A03b M "another tenant gets 404 on every field, duplicate and template route" other_tenant_cannot_touch_fields
t A13a M "30 parallel field additions: none lost, ids unique" parallel_adds_lose_nothing
t A13b M "adds and reorders in parallel: no field lost, no 5xx" reorder_and_add_in_parallel
t F1b M "a duplicate is unpublished with new public id and field ids" duplicate_has_fresh_identity
