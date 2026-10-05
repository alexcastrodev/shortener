# Connecting AI apps (MCP)

Kurz exposes shortlinks, bio pages and forms to AI apps through a remote MCP server with OAuth 2.1.

## Connect

1. In the app, add a custom connector with the URL `https://api.kurz.fyi/mcp`.
2. Sign in to Kurz when asked and choose which scopes to allow.
3. Manage or disconnect the app any time in Account, Connected apps.

## What it can do

- Scopes are opt-in per connection: `shortlinks`, `pages` and `forms` as `:read` or `:write` (write includes read), plus `responses:read`.
- Pages and forms are created and edited as drafts only. Publishing, deleting, duplicating and editing live content stay in the dashboard.
- Forms have a layout (`one_at_a_time`, `page` or `steps`) and can group questions with `section` fields. Every form gets a short link on creation, returned by `get_form`.
- A form with responses keeps its questions; only its texts can change.
- `responses:read` is separate from `forms:read`. Text typed by respondents is returned marked as untrusted data, capped in size, and counts toward a daily budget of 2000 records. No IP, user agent, country or device is exposed.
- Every call is logged as metadata only (tool, status, duration, records returned) and purged after 90 days. Each call is cancelled after 5 seconds in the database.

## Operating it

| Variable | Purpose |
|---|---|
| `MCP_ENABLED=true` | Turns on `/mcp`, `/oauth/*` and `/.well-known/*`; otherwise they answer 404 |
| `OAUTH_ISSUER` | Issuer URL (never taken from the Host header) |
| `MCP_REDIRECT_HOSTS` | Hosts allowed as OAuth redirect targets (default `claude.ai,claude.com,chatgpt.com`) |
| `MCP_ALLOWED_ORIGINS` | Extra allowed `Origin` values for `/mcp` |

Cloudflare: skip WAF managed challenges and Bot Fight Mode for `/mcp`, `/oauth/*` and `/.well-known/*` (clients are not browsers). Keep rate limiting on.

Security events (`refresh_reuse`, `code_replay`) are logged as `[oauth] event=... grant=ID` and sent to Sentry as warnings tagged `oauth_event`. Unauthorized MCP requests are logged as `[mcp] event=unauthorized`.
