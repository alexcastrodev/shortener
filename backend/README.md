# Backend

Rails API (Ruby 4.0.7, Postgres, Valkey). No views: the frontend is a separate app.

## What runs

| Process | Command | Does |
|---|---|---|
| web | `bin/rails server` | the API, `/mcp` and `/oauth/*` |
| jobs | `bin/jobs` | Solid Queue: cleanups, notifications, reminders, appointment expiry |
| workers | `rake workers:run` | Sneakers consumers of the RabbitMQ click events (`app/workers`) |
| imgproc | `bundle exec puma -b tcp://127.0.0.1:8080 imgproc/config.ru` | sandboxed image converter for form covers and avatars |

`Procfile.dev` lists web, worker and jobs.

## Where things live

- `app/controllers/api/{public,me,admin}`: routes are in `config/routes.rb`.
- `app/contracts`: input validation.
- `app/services`: the business logic (`forms`, `booking`, `appointments`, `pages`, `notifications`, `mcp`, `oauth`, ...).
- `app/serializers`, `app/policies`, `app/jobs`, `app/mailers`.

## Tests, lint, security

Run them in containers, never on the host (see `CLAUDE.md` at the root): image built from `Dockerfile.backend`, `backend` mounted at `/rails`, `RAILS_ENV=test`, a throwaway `postgres:17` and `valkey/valkey:8.1.4`, then:

```
bin/rails db:create db:schema:load
bundle exec rspec
bundle exec rubocop
bundle exec brakeman --no-pager --quiet
```

## Docs

- [Appointments](../docs/appointments.md)
- [MCP server](../docs/mcp.md)
- [Postgres roles](../docs/postgres-roles.md)
- [i18n](../docs/i18n.md)
