# Host header (P04), authentication (A01) and admin authorization (A07) against the real image.

forged_host() { expect 403 "$(status GET /api/public/pages/x -H 'Host: evil.example')"; }
forged_host_up() { expect 200 "$(status GET /up -H 'Host: evil.example')"; }
real_host() { expect 404 "$(status GET /api/public/pages/does-not-exist)"; }

no_credential() { expect 401 "$(status GET /api/me/shortlinks)"; }
garbage_bearer() { expect 401 "$(status GET /api/me/shortlinks -H 'Authorization: Bearer garbage')"; }

# jwt HEADER_JSON KEY_OR_EMPTY -> token for user 1 expiring in an hour
jwt() {
  python3 - "$1" "$2" <<'P'
import base64, hashlib, hmac, json, sys, time
b = lambda d: base64.urlsafe_b64encode(d).rstrip(b"=")
head = b(sys.argv[1].encode())
body = b(json.dumps({"sub": 1, "jti": "x", "iat": int(time.time()), "exp": int(time.time()) + 3600}).encode())
sig = b(hmac.new(sys.argv[2].encode(), head + b"." + body, hashlib.sha256).digest()) if sys.argv[2] else b""
print((head + b"." + body + b"." + sig).decode())
P
}
alg_none() { expect 401 "$(status GET /api/me/shortlinks -H "Authorization: Bearer $(jwt '{"alg":"none","typ":"JWT"}' '')")"; }
wrong_key() { expect 401 "$(status GET /api/me/shortlinks -H "Authorization: Bearer $(jwt '{"alg":"HS256","typ":"JWT"}' 'not-the-key')")"; }

cookie_write_without_xhr() {
  expect 403 "$(status POST /api/me/shortlinks -H "Cookie: kurz_session=$(tok ownerA)" -H 'Content-Type: application/json' -d '{}')"
}
deactivated_user() { expect 403 "$(status GET /api/me/shortlinks -H "Authorization: Bearer $(tok ownerD)")"; }

# A non-admin gets the same 403 whether the id exists or not.
ADMIN_MEMBER_PATHS=(
  "/api/admin/users/%s/toggle_active"
  "/api/admin/shortlinks/%s/toggle_safe"
  "/api/admin/shortlinks/%s/toggle_active"
  "/api/admin/page_templates/%s/toggle_hidden"
  "/api/admin/abuse_signals/%s/dismiss"
)
admin_bfla() {
  local fail=0 p path
  for p in "${ADMIN_MEMBER_PATHS[@]}"; do
    for id in 0 "$(uid ownerA)"; do
      path=$(printf "$p" "$id")
      got=$(status POST "$path" -H "Authorization: Bearer $(tok ownerB)")
      [ "$got" = 403 ] || { echo "$path -> $got"; fail=1; }
    done
  done
  return $fail
}
admin_missing_is_404() { expect 404 "$(status POST /api/admin/shortlinks/0/toggle_safe -H "Authorization: Bearer $(tok admin)")"; }
admin_can_list() { expect 200 "$(status GET /api/admin/users -H "Authorization: Bearer $(tok admin)")"; }

t P04a M "forged Host is rejected" forged_host
t P04b M "/up answers any Host" forged_host_up
t P04c M "real Host reaches the app" real_host
t A01a M "no credential -> 401" no_credential
t A01b M "garbage bearer -> 401" garbage_bearer
t A01c M "JWT alg none -> 401" alg_none
t A01d M "JWT signed with another key -> 401" wrong_key
t A01e M "cookie write without X-Requested-With -> 403" cookie_write_without_xhr
t A01f M "deactivated user -> 403" deactivated_user
t A07a M "non-admin gets 403 on admin member routes, id existing or not" admin_bfla
t A07b M "admin gets 404 for a missing id" admin_missing_is_404
t A07c M "admin can list users" admin_can_list

# The harness must be isolated: nothing here may reach the Internet.
egress_blocked() { ! curl -s -m 4 -o /dev/null https://example.com || { echo "Internet reachable"; return 1; }; }
t ISO M "runner has no Internet" egress_blocked
