# A00: every route the production image serves must be classified in matrix.tsv, and every
# owner/admin route must refuse a request without credentials. A new route fails until classified.

route_set_matches() {
  python3 - <<'P'
import sys
routes = {tuple(l.split()[:2]) for l in open("/out/routes.txt") if l.strip()}
matrix = {tuple(l.rstrip("\n").split("\t")[1:3]) for l in open("/security/matrix.tsv") if l.strip() and not l.startswith("#")}
new, stale = sorted(routes - matrix), sorted(matrix - routes)
for r in new: print("unclassified:", *r)
for r in stale: print("stale:", *r)
sys.exit(1 if new or stale else 0)
P
}

# Replaces :param and *glob segments with a value so the route can be requested.
protected_routes_refuse_anonymous() {
  local fail=0 cls verb path concrete got
  while IFS=$'\t' read -r cls verb path _; do
    case "$cls" in owner|admin) ;; *) continue;; esac
    concrete=$(printf %s "$path" | sed -E 's#:[a-z_]+#1#g; s#\*[a-z_]+#x#g')
    got=$(status "$verb" "$concrete")
    [ "$got" = 401 ] || { echo "$verb $concrete -> $got"; fail=1; }
  done < <(grep -v '^#' /security/matrix.tsv)
  return $fail
}

t A00a M "route table equals matrix.tsv (no unclassified or stale route)" route_set_matches
t A00b M "owner/admin routes answer 401 without credentials" protected_routes_refuse_anonymous

# Framework routes the app never uses must not answer to the Internet.
conductor_not_served() {
  local got; got=$(status GET /rails/conductor/action_mailbox/inbound_emails)
  case "$got" in 403|404) ;; *) echo "conductor -> $got"; return 1;; esac
}
mailbox_ingress_refuses_anonymous() {
  local fail=0 ep got
  for ep in relay postmark sendgrid mandrill mailgun/mime; do
    got=$(status POST "/rails/action_mailbox/$ep/inbound_emails" -H 'Content-Type: message/rfc822' --data-binary 'Subject: x')
    case "$got" in 401|403|404) ;; *) echo "$ep -> $got"; fail=1;; esac
  done
  return $fail
}
t X01 M "Action Mailbox conductor refuses the Internet (403/404)" conductor_not_served
t X02 M "Action Mailbox ingresses refuse anonymous mail without a 5xx" mailbox_ingress_refuses_anonymous
