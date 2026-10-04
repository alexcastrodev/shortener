call() {
  local who=$1 method=$2 path=$3 body=${4:-}
  curl -s -w '\n%{http_code}' -X "$method" -H "CF-Connecting-IP: 198.51.100.$((RANDOM % 250 + 1))" \
    -H "Authorization: Bearer $(tok "$who")" -H 'Content-Type: application/json' ${body:+-d "$body"} "$API$path"
}
code() { printf %s "$1" | tail -n1; }
payload() { printf %s "$1" | sed '$d'; }

FORM_A=$(payload "$(call ownerA POST /api/me/forms '{"title":"A secret form"}')" | jq -r '.form.id // .id')

bola_owner_routes() {
  local fail=0 spec verb suffix a b
  for spec in "GET:" "PATCH:" "DELETE:" "POST:/publish" "POST:/unpublish"; do
    verb=${spec%%:*}; suffix=${spec#*:}
    a=$(call ownerB "$verb" "/api/me/forms/$FORM_A$suffix" '{"title":"hijack"}')
    b=$(call ownerB "$verb" "/api/me/forms/0$suffix" '{"title":"hijack"}')
    [ "$a" = "$b" ] && [ "$(code "$a")" = 404 ] || { echo "$verb $suffix: $(code "$a") vs $(code "$b")"; fail=1; }
  done
  return $fail
}
owner_form_untouched() {
  local got; got=$(call ownerA GET "/api/me/forms/$FORM_A")
  [ "$(code "$got")" = 200 ] && [ "$(payload "$got" | jq -r '.form.title')" = "A secret form" ] || { echo "form changed or gone"; return 1; }
}
listing_isolated() {
  local ids; ids=$(payload "$(call ownerB GET /api/me/forms)" | jq -r '.form[].id')
  case " $ids " in *" $FORM_A "*) echo "B sees A's form"; return 1;; esac
}
mass_assignment_ignored() {
  local created id got
  created=$(call ownerA POST /api/me/forms "{\"title\":\"Sneaky\",\"user_id\":$(uid ownerB),\"published\":true,\"responses_count\":99,\"public_id\":\"AAAAAAAAAAAA\",\"fields\":[{\"id\":\"abcd1234\",\"type\":\"yes_no\",\"label\":\"x\"}]}")
  [ "$(code "$created")" = 201 ] || { echo "create -> $(code "$created")"; return 1; }
  got=$(payload "$created" | jq -c '.form | {published, responses_count, fields, public_id}')
  [ "$got" != "" ] && [ "$(printf %s "$got" | jq -r '.published')" = false ] && [ "$(printf %s "$got" | jq -r '.responses_count')" = 0 ] \
    && [ "$(printf %s "$got" | jq -r '.fields | length')" = 0 ] && [ "$(printf %s "$got" | jq -r '.public_id')" != AAAAAAAAAAAA ] || { echo "$got"; return 1; }
  id=$(payload "$created" | jq -r '.form.id')
  case " $(payload "$(call ownerB GET /api/me/forms)" | jq -r '.form[].id') " in *" $id "*) echo "created under B"; return 1;; esac
}
public_id_shape() {
  payload "$(call ownerA POST /api/me/forms '{"title":"shape"}')" | jq -e '.form.public_id | test("^[A-Za-z0-9]{12}$")' >/dev/null
}
daily_quota_under_parallel_requests() {
  local codes created limited other
  codes=$(seq 30 | xargs -P30 -I{} curl -s -o /dev/null -w '%{http_code}\n' -X POST -H "CF-Connecting-IP: 198.51.100.{}" \
    -H "Authorization: Bearer $(tok ownerB)" -H 'Content-Type: application/json' -d '{"title":"burst"}' "$API/api/me/forms")
  created=$(printf '%s\n' "$codes" | grep -c '^201$' || true)
  limited=$(printf '%s\n' "$codes" | grep -c '^429$' || true)
  other=$(printf '%s\n' "$codes" | grep -vcE '^(201|429)$' || true)
  [ "$created" = 20 ] && [ "$limited" = 10 ] && [ "$other" = 0 ] || { echo "created=$created limited=$limited other=$other"; return 1; }
}
quota_message_and_isolation() {
  local over; over=$(call ownerB POST /api/me/forms '{"title":"21st"}')
  [ "$(code "$over")" = 429 ] && [ "$(payload "$over" | jq -r '.error')" = forms_daily_limit ] || { echo "$(code "$over") $(payload "$over")"; return 1; }
  expect 201 "$(code "$(call ownerA POST /api/me/forms '{"title":"A is unaffected"}')")"
}
publish_needs_questions() {
  local empty; empty=$(payload "$(call ownerA POST /api/me/forms '{"title":"empty"}')" | jq -r '.form.id')
  expect 422 "$(code "$(call ownerA POST "/api/me/forms/$empty/publish")")"
}

t A02 M "owner routes answer another tenant's form like a missing one" bola_owner_routes
t A02b M "the owner's form is untouched after B's attempts" owner_form_untouched
t A02c M "B's listing never includes A's forms" listing_isolated
t A09 M "user_id, published, responses_count, public_id and fields are not mass-assignable" mass_assignment_ignored
t A04 M "public_id is 12 random alphanumerics" public_id_shape
t A16 M "30 parallel creations by one user: exactly 20 created, 10 limited, no 5xx" daily_quota_under_parallel_requests
t A16b M "21st creation answers 429 forms_daily_limit and other users are unaffected" quota_message_and_isolation
t F1a M "a form without questions cannot be published" publish_needs_questions
