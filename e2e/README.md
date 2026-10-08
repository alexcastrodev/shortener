# End-to-end tests

Playwright against the real stack: Rails in the `e2e` environment, Postgres, Valkey, Mailpit and the built frontend. Nothing is mocked. Rails delivers every e-mail over SMTP to Mailpit and the tests read the mailbox through its HTTP API, open the links they find and carry on from there.

Accounts are created by `support/seed.rb` and signed in by injecting the `kurz_session` cookie, so only the sign-in test goes through the login form.

## Run in CI

The `e2e` job in `.github/workflows/ci.yml` starts Postgres, Valkey and Mailpit as services, builds the frontend, seeds the accounts and lets Playwright start Rails (3000) and the frontend (3001) with `E2E_START_SERVERS=1`.

## Run locally

With Postgres, Valkey and Mailpit up (SMTP 1025, HTTP 8025) and the backend dependencies installed:

```
export RAILS_ENV=e2e SECRET_KEY_BASE=$(openssl rand -hex 64) E2E_SMTP_HOST=localhost
cd backend && bin/rails db:create db:schema:load && bin/rails runner ../e2e/support/seed.rb
cd ../frontend && VITE_BASE_URL=http://localhost:3000 VITE_TURNSTILE_SITE_KEY= npm run build
cd ../e2e && npm ci && npx playwright install chromium
E2E_START_SERVERS=1 npx playwright test
```

Point the tests at servers that are already running with `E2E_API_URL`, `E2E_APP_URL`, `E2E_REDIS_URL` and `MAILPIT_URL`.

Every test starts with an empty cache and an empty mailbox, and deletes the forms it created: the public form limits submissions per address and an account can create only 20 forms a day.
