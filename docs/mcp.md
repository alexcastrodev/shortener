# Connecting AI apps (MCP)

Kurz exposes shortlinks, bio pages and forms to AI apps through a remote MCP server with OAuth 2.1.

## Connect

1. In the app, add a custom connector with the URL `https://api.kurz.fyi/mcp`.
2. Sign in to Kurz when asked and choose which scopes to allow.
3. Manage or disconnect the app any time in Account, Connected apps.

## What it can do

- Scopes are opt-in per connection: `shortlinks`, `pages` and `forms` as `:read` or `:write` (write includes read), `forms:publish` and `pages:publish`, plus `responses:read`, and `appointments:read` or `appointments:write` (write includes read) when appointments are enabled for the account. With `appointments:read` the app can read the booking setup, preview availability, generate time lists (a pure calculation), and list, open and read the agenda of appointments; names and emails are returned marked as untrusted and count toward the same daily budget of records as responses. It can also list the owner's bell notifications (`appointments:read`; ids and counts only) and, with `appointments:write`, mark one as read. With `appointments:write` it can also set up the booking of a form draft (services, rules, days off, and filling a service's times from working hours) and, with `appointments:read`, see which upcoming bookings a draft would leave out; a published form can only be changed in the dashboard, and with the booking setup scopes alone nothing can change or message a booking.
- `appointments:manage` (off by default, personal data, not available with publishing) adds five tools that act on bookings and email the client in the owner's name: `approve_appointment`, `decline_appointment`, `cancel_appointment` (this session, this and the later ones, or all), `reschedule_appointment` and `remind_appointment`. They are not implied by `appointments:write`. Each one takes the appointment id again as `confirm` (to be passed only after the owner agreed in the conversation), refuses another owner's appointment as not found, cleans and caps any message (500 characters), returns no names or emails, and shares a limit of 30 actions an hour and 100 a day (each tool also has 20 an hour). Visitor text stays marked untrusted, so an instruction hidden in a name or note is data, not a command.
- Pages and forms are created and edited as drafts. A live page or form accepts only theme and color changes; to edit anything else, unpublish it first (needs the publish scope) or use the dashboard. Deleting and duplicating stay in the dashboard.
- Publishing and unpublishing need `forms:publish` or `pages:publish`, off by default, and a connection can never hold a publish scope together with `responses:read` or an appointments scope: text typed by respondents is untrusted and must not be able to steer what goes online.
- Forms have a layout (`one_at_a_time`, `page` or `steps`) and can group questions with `section` fields. Every form gets a short link on creation, returned by `get_form`.
- `account:full` ("Full access") is a single opt-in scope, off by default and replacing every other permission: it adds update and delete for short links, deleting pages and forms, duplicating forms, applying templates, deleting responses, reading responses together with publishing, and lifts the draft-only and no-edits-after-responses limits. Deleting tools need the exact short code, slug or title repeated as `confirm`, are marked destructive so clients ask first, and are limited to 10 an hour. Account deletion, passwords and connected apps are not available through the MCP.
- Without full access, a form with responses keeps its questions; only its texts can change.
- `responses:read` is separate from `forms:read`. Text typed by respondents is returned marked as untrusted data, capped in size, and counts toward a daily budget of 2000 records. No IP, user agent, country or device is exposed.
- Every call is logged as metadata only (tool, status, duration, records returned) and purged after 90 days. Each call is cancelled after 5 seconds in the database.

## Operating it

| Variable | Purpose |
|---|---|
| `MCP_ENABLED=true` | Turns on `/mcp`, `/oauth/*` and `/.well-known/*`; otherwise they answer 404 |
| `OAUTH_ISSUER` | Issuer URL (never taken from the Host header) |
| `MCP_REDIRECT_HOSTS` | Hosts allowed as OAuth redirect targets (default `claude.ai,claude.com,chatgpt.com`); the Kurz app callback `fyi.kurz.app://oauth/callback` is always allowed |
| `MCP_ALLOWED_ORIGINS` | Extra allowed `Origin` values for `/mcp` |

Cloudflare: skip WAF managed challenges and Bot Fight Mode for `/mcp`, `/oauth/*` and `/.well-known/*` (clients are not browsers). Keep rate limiting on.

Security events (`refresh_reuse`, `code_replay`) are logged as `[oauth] event=... grant=ID` and sent to Sentry as warnings tagged `oauth_event`. Unauthorized MCP requests are logged as `[mcp] event=unauthorized`.
