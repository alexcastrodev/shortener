# Postgres roles in production

The app runs as a role with data access only; migrations run as the owner role. Merging the code changes nothing: until `MIGRATE_POSTGRES_USER` is set, `deploy.sh` migrates with the same credentials the app uses.

## One-time setup

Connect to the Kurz database as the current superuser (`$POSTGRES_USER` in the stack `.env`) and run, with your own password:

```sql
CREATE ROLE kurz_app LOGIN PASSWORD '<long random>' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT CONNECT ON DATABASE <database> TO kurz_app;
GRANT USAGE ON SCHEMA public TO kurz_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kurz_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kurz_app;
ALTER DEFAULT PRIVILEGES FOR ROLE <owner> IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kurz_app;
ALTER DEFAULT PRIVILEGES FOR ROLE <owner> IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO kurz_app;
```

`<owner>` is the role that owns the tables (the current superuser), so tables created by future migrations are readable and writable by `kurz_app` automatically.

## Switching

In `/mnt/ssd/@docker/shortener/.env`:

```
MIGRATE_POSTGRES_USER=<current superuser>
MIGRATE_POSTGRES_PASSWORD=<its password>
POSTGRES_USER=kurz_app
POSTGRES_PASSWORD=<the new password>
```

Then deploy. `deploy.sh` runs `db:prepare` with the `MIGRATE_*` credentials; web, jobs and workers use `kurz_app`. Check `docker service logs shortener_web` for permission errors after the rollout.

## Rollback

Put the old values back in `POSTGRES_USER` and `POSTGRES_PASSWORD`, remove the `MIGRATE_*` lines and deploy.

## Verified in CI

The security harness creates the same role, runs the production image and the whole suite as `kurz_app`, and check P16 proves it cannot create, alter or drop tables, create roles, read host files or run programs.
