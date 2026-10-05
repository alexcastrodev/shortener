require_relative "harness"
require_relative "seed"
include Harness

def as(who, verb, path, body = nil, **options)
  http(verb, path, body: body, token: token(who), **options)
end

def anonymous(verb, path, body = nil, **options)
  http(verb, path, body: body, **options)
end

def create_form(who, title, extra = {})
  as(who, :post, "/api/me/forms", { title: title }.merge(extra)).json.fetch("form")
end

def publish(who, form)
  as(who, :post, "/api/me/forms/#{form['id']}/publish")
end

def jwt(header, key, sub: 1)
  b64 = ->(data) { Base64.urlsafe_encode64(data, padding: false) }
  head = b64.call(JSON.generate(header))
  body = b64.call(JSON.generate(sub: sub, jti: "x", iat: Time.now.to_i, exp: Time.now.to_i + 3600))
  signature = key ? b64.call(OpenSSL::HMAC.digest("SHA256", key, "#{head}.#{body}")) : ""
  "#{head}.#{body}.#{signature}"
end

CANARY_IP = "203.0.113.77"
CANARY = "CNRY-harness-feed0001"

check("ISO", "the harness has no route to the Internet") do
  reachable = begin
    Socket.tcp("example.com", 443, connect_timeout: 4) { true }
  rescue StandardError
    false
  end
  expect(!reachable, "Internet reachable")
end

check("P04", "a forged Host is refused, /up answers any Host, the real Host reaches the app") do
  expect_eq(403, anonymous(:get, "/api/public/pages/x", headers: { "Host" => "evil.example" }).status, "forged")
  expect_eq(200, anonymous(:get, "/up", headers: { "Host" => "evil.example" }).status, "/up")
  expect_eq(404, anonymous(:get, "/api/public/pages/nope").status, "real")
end

check("A01", "no credential, garbage bearer, alg none, a foreign key, cookie write without X-Requested-With, deactivated user") do
  expect_eq(401, anonymous(:get, "/api/me/shortlinks").status, "none")
  expect_eq(401, http(:get, "/api/me/shortlinks", token: "garbage").status, "garbage")
  expect_eq(401, http(:get, "/api/me/shortlinks", token: jwt({ alg: "none", typ: "JWT" }, nil)).status, "alg none")
  expect_eq(401, http(:get, "/api/me/shortlinks", token: jwt({ alg: "HS256", typ: "JWT" }, "not-the-key")).status, "foreign key")
  expect_eq(403, anonymous(:post, "/api/me/shortlinks", {}, headers: { "Cookie" => "kurz_session=#{token(:a)}" }).status, "cookie csrf")
  expect_eq(403, as(:deactivated, :get, "/api/me/shortlinks").status, "deactivated")
end

check("A07", "non-admins get 403 on admin member routes whether the id exists or not; admins get 404 for a missing id") do
  ["/api/admin/users/%s/toggle_active", "/api/admin/shortlinks/%s/toggle_safe", "/api/admin/shortlinks/%s/toggle_active", "/api/admin/page_templates/%s/toggle_hidden", "/api/admin/abuse_signals/%s/dismiss"].each do |template|
    [0, TENANTS[:a].id].each do |id|
      expect_eq(403, as(:b, :post, format(template, id)).status, format(template, id))
    end
  end
  expect_eq(404, as(:admin, :post, "/api/admin/shortlinks/0/toggle_safe").status, "admin")
end

MATRIX = File.readlines(File.join(__dir__, "matrix.tsv"), chomp: true).reject { |line| line.empty? || line.start_with?("#") }.map { |line| line.split("\t") }

check("A00", "the production route table equals matrix.tsv, and owner/admin routes refuse anonymous requests") do
  routes = Rails.application.routes.routes.map { |r| [r.verb.presence || "ANY", r.path.spec.to_s.sub("(.:format)", "")] }
  declared = MATRIX.map { |_, verb, path| [verb, path] }
  expect((routes - declared).empty?, "unclassified: #{(routes - declared).first(3).inspect}")
  expect((declared - routes).empty?, "stale: #{(declared - routes).first(3).inspect}")
  MATRIX.select { |klass, *| ["owner", "admin"].include?(klass) }.each do |_, verb, path|
    concrete = path.gsub(/:[a-z_]+/, "1")
    expect_eq(401, anonymous(verb.downcase.to_sym, concrete).status, "#{verb} #{concrete}")
  end
end

check("X01", "Action Mailbox's conductor and ingresses refuse the Internet without a 5xx") do
  expect([403, 404].include?(anonymous(:get, "/rails/conductor/action_mailbox/inbound_emails").status), "conductor")
  ["relay", "postmark", "sendgrid", "mandrill", "mailgun/mime"].each do |ingress|
    status = http(:post, "/rails/action_mailbox/#{ingress}/inbound_emails", raw: "Subject: x", headers: { "Content-Type" => "message/rfc822" }).status
    expect([401, 403, 404].include?(status), "#{ingress} -> #{status}")
  end
end

check("G07", "form tables hold no IP, user agent or referrer; responses have only the allowed columns; nothing form-related is audited") do
  expect_eq(
    ["answers", "browser", "country", "created_at", "form_id", "id", "idempotency_key", "platform", "source"],
    rows("select column_name from information_schema.columns where table_name = 'form_responses' order by 1").flatten
  )
  leaky = rows("select table_name || '.' || column_name from information_schema.columns where table_name like 'form%' and column_name ~* '(^ip|_ip$|ip_address|user_agent|referer|referrer)'")
  expect(leaky.empty?, leaky.inspect)
  expect_eq(1, sql("select count(*) from pg_constraint where conname = 'form_responses_answers_object_max_64kb'").to_i, "64 KB check")
end

check("A16", "30 parallel form creations by one user: exactly 20 created, 10 limited, no 5xx") do
  codes = parallel(30) { as(:b, :post, "/api/me/forms", { title: "burst" }).status }
  expect_eq([20, 10, 0], [codes.count(201), codes.count(429), codes.count { |c| c >= 500 }])
  expect_eq(201, as(:a, :post, "/api/me/forms", { title: "A is unaffected" }).status, "other user")
end

check("A13", "30 parallel field additions lose nothing; additions and reorders in parallel lose nothing") do
  form = create_form(:a, "race")
  parallel(30) { |i| as(:a, :post, "/api/me/forms/#{form['id']}/fields", { type: "short_text", label: "q#{i}" }) }
  ids = as(:a, :get, "/api/me/forms/#{form['id']}").json["form"]["fields"].map { |f| f["id"] }
  expect_eq([30, 30], [ids.size, ids.uniq.size], "adds")

  mixed = create_form(:a, "mix")
  5.times { |i| as(:a, :post, "/api/me/forms/#{mixed['id']}/fields", { type: "short_text", label: "base#{i}" }) }
  base = as(:a, :get, "/api/me/forms/#{mixed['id']}").json["form"]["fields"].map { |f| f["id"] }
  codes = parallel(20) do |i|
    if i.even?
      as(:a, :post, "/api/me/forms/#{mixed['id']}/fields", { type: "short_text", label: "mix#{i}" }).status
    else
      as(:a, :patch, "/api/me/forms/#{mixed['id']}/fields/reorder", { ids: base.reverse }).status
    end
  end
  expect(codes.all? { |c| [201, 200, 422].include?(c) }, "statuses #{codes.tally}")
  final = as(:a, :get, "/api/me/forms/#{mixed['id']}").json["form"]["fields"].map { |f| f["id"] }
  expect_eq([15, 15], [final.size, final.uniq.size], "mixed")
end

check("A02", "another tenant gets 404 on every owner route of a form, its fields and its responses; the data survives") do
  form = create_form(:a, "secret", template: "contact")
  publish(:a, form)
  field = as(:a, :get, "/api/me/forms/#{form['id']}").json["form"]["fields"].first
  base = "/api/me/forms/#{form['id']}"
  [
    [:get, base], [:patch, base, { title: "x" }], [:delete, base], [:post, "#{base}/publish"], [:post, "#{base}/unpublish"],
    [:post, "#{base}/duplicate"], [:post, "#{base}/apply_template", { template: "contact" }],
    [:post, "#{base}/fields", { type: "short_text", label: "x" }], [:patch, "#{base}/fields/#{field['id']}", { label: "x" }],
    [:delete, "#{base}/fields/#{field['id']}"], [:patch, "#{base}/fields/reorder", { ids: [field["id"]] }],
    [:get, "#{base}/responses"], [:get, "#{base}/summary"], [:delete, "#{base}/responses"]
  ].each do |verb, path, body|
    expect_eq(404, as(:b, verb, path, body).status, "#{verb} #{path}")
  end
  expect_eq("secret", as(:a, :get, base).json["form"]["title"], "form survived")
  expect(as(:b, :get, "/api/me/forms").json["form"].none? { |f| f["id"] == form["id"] }, "listed for B")
end

check("A09", "user_id, published, responses_count, public_id and fields are not mass-assignable") do
  created = as(:a, :post, "/api/me/forms", { title: "Sneaky", user_id: TENANTS[:b].id, published: true, responses_count: 99, public_id: "AAAAAAAAAAAA", fields: [{ id: "abcd1234", type: "yes_no", label: "x" }] }).json["form"]
  expect_eq([false, 0, 0], [created["published"], created["responses_count"], created["fields"].size])
  expect(created["public_id"] != "AAAAAAAAAAAA" && created["public_id"].match?(/\A[A-Za-z0-9]{12}\z/), "public_id")
  expect(as(:b, :get, "/api/me/forms").json["form"].none? { |f| f["id"] == created["id"] }, "created under B")
end

PUBLIC = create_form(:a, "Public", template: "contact")
PUBLIC_FIELDS = as(:a, :get, "/api/me/forms/#{PUBLIC['id']}").json["form"]["fields"]
publish(:a, PUBLIC)
DRAFT = create_form(:a, "Draft")

def answers(name = "ok")
  { PUBLIC_FIELDS[0]["id"] => name, PUBLIC_FIELDS[1]["id"] => "cnry@example.com", PUBLIC_FIELDS[2]["id"] => "hello" }
end

def submit(body, ip: Harness.ip, **options)
  anonymous(:post, "/api/public/forms/#{PUBLIC['public_id']}/responses", body, ip: ip, **options)
end

check("A04", "the public form JSON has exactly the whitelisted keys and leaks nothing; missing, draft and SQL-looking ids share one 404") do
  response = anonymous(:get, "/api/public/forms/#{PUBLIC['public_id']}")
  expect_eq(["description", "fields", "thank_you_message", "theme", "title"], response.json["form"].keys.sort)
  ["user_id", "responses_count", "published", "created_at", "updated_at", "public_id", "owner-a@sec.test"].each { |leak| expect(!response.body.include?(leak), "leaked #{leak}") }
  expect(!response.headers.key?("set-cookie"), "Set-Cookie")
  missing = anonymous(:get, "/api/public/forms/ZZZZZZZZZZZZ")
  expect_eq(404, missing.status)
  [DRAFT["public_id"], "x", "1%27%20OR%20%271%27%3D%271"].each do |id|
    other = anonymous(:get, "/api/public/forms/#{id}")
    expect_eq([missing.status, missing.body], [other.status, other.body], id)
  end
  expect(anonymous(:get, "/api/public/forms/#{'a' * 10_000}").status < 500, "10k id")
end

check("A10", "a NUL byte in a public path or body is a 400, never a 5xx") do
  ["/api/public/forms/%00", "/api/public/shortlinks/%00", "/api/public/pages/%00"].each do |path|
    expect_eq(400, anonymous(:get, path).status, path)
  end
  expect_eq(400, anonymous(:post, "/api/public/shortlinks/%00/unlock", { password: "x" }).status, "unlock")
end

check("C03", "with Cloudflare unavailable one IP gets 5 submissions per 10 minutes, then 429; other IPs are free") do
  ip = "192.0.2.50"
  statuses = Array.new(7) { |i| submit({ answers: answers("CNRY-b-#{i}") }, ip: ip).status }
  expect_eq([201] * 5 + [429] * 2, statuses)
  expect_eq(201, submit({ answers: answers("CNRY-c") }).status, "other IP")
end

check("C16", "bodies over 64 KB are refused with 413, with Content-Length and chunked; non-JSON is 415; broken JSON and NUL are 400") do
  big = JSON.generate(answers: { x: "a" * 70_000 })
  expect_eq(413, submit(nil, raw: big).status, "content-length")
  expect_eq(413, submit(nil, raw: big, chunked: true).status, "chunked")
  expect_eq(415, submit(nil, raw: "answers[x]=1", headers: { "Content-Type" => "application/x-www-form-urlencoded" }).status, "urlencoded")
  expect_eq(400, submit(nil, raw: "{not json").status, "broken")
  expect_eq(400, submit({ answers: answers("a\u0000b") }).status, "nul")
  expect(submit(nil, raw: '{"answers":[1,2],"turnstile_token":["a"],"idempotency_key":{"a":1}}').status < 500, "odd shapes")
end

check("C08", "10 parallel requests with one idempotency key store one row; 20 parallel submissions keep responses_count equal to count(*)") do
  before = sql("select count(*) from form_responses where form_id = #{PUBLIC['id']}").to_i
  codes = parallel(10) { submit({ answers: answers("CNRY-d"), idempotency_key: "burst-key-1" }, ip: "198.18.0.#{_1 + 1}").status }
  expect_eq(1, codes.count(201), "created")
  expect_eq(10, codes.count { |c| [200, 201].include?(c) }, "all ok")
  expect_eq(before + 1, sql("select count(*) from form_responses where form_id = #{PUBLIC['id']}").to_i, "rows")
  parallel(20) { submit({ answers: answers("CNRY-e") }, ip: "198.19.0.#{_1 + 1}") }
  expect_eq(sql("select count(*) from form_responses where form_id = #{PUBLIC['id']}").to_i, sql("select responses_count from forms where id = #{PUBLIC['id']}").to_i, "counter")
end

check("C20", "events: 30 parallel views are all counted, a visitor is unique once, the 61st event from one IP is 429") do
  path = "/api/public/forms/#{PUBLIC['public_id']}/events"
  total = -> { sql("select coalesce(sum(views),0) || ',' || coalesce(sum(unique_views),0) || ',' || coalesce(sum(starts),0) from form_daily_stats where form_id = #{PUBLIC['id']}").split(",").map(&:to_i) }
  before = total.call
  codes = parallel(30) { anonymous(:post, path, { event: "view" }, ip: "192.0.2.#{_1 + 100}").status }
  expect_eq(30, codes.count(204), "204s")
  mid = total.call
  expect_eq(30, mid[0] - before[0], "views")
  3.times { anonymous(:post, path, { event: "view" }, ip: "198.51.100.241", headers: { "User-Agent" => "harness-a" }) }
  anonymous(:post, path, { event: "start" }, ip: "198.51.100.241")
  after = total.call
  expect_eq([3, 1, 1], [after[0] - mid[0], after[1] - mid[1], after[2] - mid[2]], "views, uniques, starts")
  60.times { anonymous(:post, path, { event: "view" }, ip: "198.51.100.242") }
  expect_eq(429, anonymous(:post, path, { event: "view" }, ip: "198.51.100.242").status, "61st")
end

check("B04", "Valkey: unique-view keys hold no IP or user agent and expire within 25 h; the visitor IP lives only in short rate-limit keys") do
  anonymous(:post, "/api/public/forms/#{PUBLIC['public_id']}/events", { event: "view" }, ip: CANARY_IP, headers: { "User-Agent" => "CNRY-agent-0001" })
  unique = valkey.scan_each(match: "fv:*").to_a
  expect(!unique.empty?, "no unique-view keys: the scan cannot see them")
  unique.each do |key|
    expect(!key.include?(CANARY_IP) && !key.include?("CNRY"), "visitor data in #{key}")
    expect((1..90_000).cover?(valkey.ttl(key)), "ttl #{valkey.ttl(key)} on #{key}")
  end
  with_ip = valkey.scan_each(match: "*#{CANARY_IP}*").to_a
  expect(!with_ip.empty?, "control failed: no key carries the canary IP")
  with_ip.each do |key|
    expect(key.include?("rate-limit") && (1..86_400).cover?(valkey.ttl(key)), "IP in #{key} (ttl #{valkey.ttl(key)})")
  end
end

check("G04", "the visitor IP is nowhere in the database; answers exist only in form_responses") do
  submit({ answers: answers(CANARY) }, ip: CANARY_IP)
  text = database_text
  expect(text.values.join(" ").match?(/(\d{1,3}\.){3}\d{1,3}/), "control failed: the database holds no IP at all")
  expect(!text.values.join(" ").include?(CANARY_IP), "IP canary in the database")
  holders = text.select { |_, value| value.include?("CNRY-") }.keys
  expect_eq(["form_responses"], holders, "tables with answers")
end

check("F4", "owner responses: exact keys, cursor, summary matches the rows, deleting leaves no trace") do
  base = "/api/me/forms/#{PUBLIC['id']}"
  list = as(:a, :get, "#{base}/responses?limit=2")
  expect_eq(["answers", "browser", "country", "id", "platform", "source", "submitted_at"], list.json["response"].first.keys.sort)
  expect(!list.json["next_before"].nil?, "cursor")
  expect_eq(sql("select count(*) from form_responses where form_id = #{PUBLIC['id']}").to_i, as(:a, :get, "#{base}/summary?days=all").json["funnel"]["completions"], "completions")
  expect(!anonymous(:get, "/api/public/forms/#{PUBLIC['public_id']}").body.include?("CNRY"), "answers in the public read")
  expect_eq(401, anonymous(:get, "#{base}/responses").status, "anonymous")
  expect_eq(204, as(:a, :delete, "#{base}/responses").status, "delete all")
  expect_eq([0, 0], [sql("select count(*) from form_responses where form_id = #{PUBLIC['id']}").to_i, sql("select responses_count from forms where id = #{PUBLIC['id']}").to_i])
  expect(!database_text.values.join(" ").include?("CNRY-"), "deleted answers still in the database")
end

def form_post(path, params, ip: Harness.ip)
  http(:post, path, raw: URI.encode_www_form(params), headers: { "Content-Type" => "application/x-www-form-urlencoded" }, ip: ip)
end

check("E01", "OAuth metadata comes from config (a forged forwarded host is refused), S256 only, no-store, CORS open without credentials") do
  expect_eq(403, anonymous(:get, "/.well-known/oauth-authorization-server", headers: { "X-Forwarded-Host" => "evil.example" }).status, "forged forwarded host")
  response = anonymous(:get, "/.well-known/oauth-authorization-server", headers: { "Origin" => "https://claude.ai" })
  expect_eq(200, response.status)
  expect_eq(["S256"], response.json["code_challenge_methods_supported"])
  expect_eq("https://api.kurz.fyi", response.json["issuer"])
  expect_eq("no-store", response.headers["cache-control"])
  expect_eq("*", response.headers["access-control-allow-origin"])
  expect(!response.headers.key?("access-control-allow-credentials"), "credentials allowed")
  expect_eq("https://api.kurz.fyi/mcp", anonymous(:get, "/.well-known/oauth-protected-resource", headers: { "Host" => "api.kurz.fyi" }).json["resource"])
end

check("E11", "client registration: hostile names stay inert, bad redirect URIs are refused, one IP is limited to 10 an hour") do
  ip = "192.0.2.77"
  ok = anonymous(:post, "/oauth/register", { client_name: "<script>x</script>\u202EClaude", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"] }, ip: ip)
  expect_eq(201, ok.status)
  expect_eq("<script>x</script>Claude", ok.json["client_name"])
  expect_eq(400, anonymous(:post, "/oauth/register", { client_name: "x", redirect_uris: ["https://evil.example/cb"] }, ip: ip).status, "evil redirect")
  8.times { anonymous(:post, "/oauth/register", { client_name: "x", redirect_uris: ["https://claude.ai/cb"] }, ip: ip) }
  expect_eq(429, anonymous(:post, "/oauth/register", { client_name: "x", redirect_uris: ["https://claude.ai/cb"] }, ip: ip).status, "11th")
end

check("E04", "token flow on the real stack: PKCE exchange, code replay revokes, refresh rotation, reuse revokes, only digests stored") do
  client = OauthClient.create!(client_name: "Harness", redirect_uris: ["https://claude.ai/api/mcp/auth_callback"])
  grant = OauthGrant.create!(user: TENANTS[:a], oauth_client: client, scopes: ["forms:read"], resource: "https://api.kurz.fyi/mcp")
  verifier = SecureRandom.urlsafe_base64(48)
  challenge = Base64.urlsafe_encode64(OpenSSL::Digest::SHA256.digest(verifier), padding: false)
  code = OauthAuthorizationCode.issue(grant: grant, code_challenge: challenge, redirect_uri: "https://claude.ai/api/mcp/auth_callback")
  exchange = ->(c, v = verifier) { form_post("/oauth/token", { grant_type: "authorization_code", code: c, redirect_uri: "https://claude.ai/api/mcp/auth_callback", client_id: client.client_id, code_verifier: v }) }

  first = exchange.call(code)
  expect_eq(200, first.status, "exchange")
  expect_eq("no-store", first.headers["cache-control"])
  tokens = first.json
  database = database_text.values.join(" ")
  expect(!database.include?(tokens["access_token"]) && !database.include?(tokens["refresh_token"]) && !database.include?(code), "raw token in the database")

  expect_eq("invalid_grant", exchange.call(code).json["error"], "replay")
  expect(!grant.reload.active?, "grant still active after replay")

  grant.update_columns(revoked_at: nil)
  code2 = OauthAuthorizationCode.issue(grant: grant, code_challenge: challenge, redirect_uri: "https://claude.ai/api/mcp/auth_callback")
  expect_eq("invalid_grant", exchange.call(code2, "wrong" * 12).json["error"], "bad verifier")

  code3 = OauthAuthorizationCode.issue(grant: grant, code_challenge: challenge, redirect_uri: "https://claude.ai/api/mcp/auth_callback")
  pair = exchange.call(code3).json
  refreshed = form_post("/oauth/token", { grant_type: "refresh_token", refresh_token: pair["refresh_token"], client_id: client.client_id })
  expect_eq(200, refreshed.status, "refresh")
  reuse = form_post("/oauth/token", { grant_type: "refresh_token", refresh_token: pair["refresh_token"], client_id: client.client_id })
  expect_eq("invalid_grant", reuse.json["error"], "reuse")
  expect_eq("invalid_grant", form_post("/oauth/token", { grant_type: "refresh_token", refresh_token: refreshed.json["refresh_token"], client_id: client.client_id }).json["error"], "newest after reuse")
  expect_eq(415, http(:post, "/oauth/token", body: { grant_type: "authorization_code" }).status, "json body")
end

File.write("/tmp/harness-failed", Harness.failed? ? "1" : "0")
puts "== #{Harness.results.count { |r| r[2] == 'PASS' }}/#{Harness.results.size} checks passed"
exit(Harness.failed? ? 1 : 0)
