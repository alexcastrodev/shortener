# End-to-end tests

Playwright against the real stack: Rails in the test environment, Postgres, Valkey and the built frontend. Nothing is mocked; emails are queued but never sent.

Accounts are created by `support/seed.rb` and signed in by injecting the `kurz_session` cookie, so no test goes through the login form.

## Run in CI

The `e2e` job in `.github/workflows/ci.yml` builds the frontend, seeds the accounts and lets Playwright start Rails (3000) and the frontend (3001) with `E2E_START_SERVERS=1`.

## Run locally

With Postgres and Valkey up and the backend dependencies installed:

```
cd backend && RAILS_ENV=test bin/rails db:create db:schema:load && RAILS_ENV=test bin/rails runner ../e2e/support/seed.rb
cd ../frontend && VITE_BASE_URL=http://localhost:3000 VITE_TURNSTILE_SITE_KEY= npm run build
cd ../e2e && npm ci && npx playwright install chromium
E2E_START_SERVERS=1 npx playwright test
```

Point the tests at servers that are already running with `E2E_API_URL`, `E2E_APP_URL` and `E2E_REDIS_URL`.

Every test starts with an empty cache, because the public form limits submissions per address.
