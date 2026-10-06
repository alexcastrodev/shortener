# Backups and restore

What is backed up, how, and how to prove it works. The scripts are in `ops/backup/` and read everything
from environment variables, so nothing here is specific to one host.

## What

| Data | Where it lives | Backed up as |
|---|---|---|
| Postgres (users, pages, forms, responses, appointments, waiting lists, notifications) | the `shortenerdb` stack | `pg_dump -Fc` (custom format, restorable table by table) |
| Uploaded files (avatars, form images, covers) | SeaweedFS data directory | a `tar.gz` of the directory |
| Secrets (`/mnt/ssd/@docker/shortener/.env`, VAPID keys, SeaweedFS `s3.json`) | on the host | **not** by these scripts: keep a copy in a password manager. A dump is useless without them |

Valkey (cache and rate limits) is not backed up: it can be rebuilt.

## Taking a backup

```bash
BACKUP_DIR=/mnt/ssd/@backups/kurz \
PG_CONTAINER=shortenerdb_db \
PG_DB=production PG_USER=postgres \
SEAWEED_DATA=/mnt/ssd/@docker/seaweedfs/data \
KEEP=14 \
REMOTE=user@other-host:/backups/kurz \
  ops/backup/backup.sh
```

- Each run writes `pg/kurz-<UTC stamp>.dump` and `seaweed/seaweed-<UTC stamp>.tar.gz` with a `.sha256` next to each.
- Files are written as `.partial` and renamed, so an interrupted run never leaves a file that looks complete.
- Only the newest `KEEP` copies of each kind are kept.
- `REMOTE` is optional; it copies the whole backup directory off the host with `rsync`. **A backup that lives only on the machine it protects is not a backup**: set it, or copy the directory elsewhere another way.
- Schedule it daily, for example with cron on the host: `17 3 * * * /path/to/ops/backup/backup.sh >> /var/log/kurz-backup.log 2>&1` with the variables above exported in the crontab or an env file.

SeaweedFS note: the archive is taken while the service runs. Files are written once and not changed, so this is
normally fine, but the newest volume may be caught mid-write. If you need an exact copy, scale the service to zero for the
minute the `tar` takes (`docker service scale bucket_seaweedfs=0`, then back to `1`).

## Proving it restores

```bash
BACKUP_DIR=/mnt/ssd/@backups/kurz ops/backup/restore-test.sh
```

It checks the checksum, loads the newest dump into a throwaway Postgres container (never the real database),
prints the row counts of the main tables, and confirms the newest SeaweedFS archive is readable. It exits
non-zero on any problem. Run it after the first backup, after any change to the scripts, and at least once a month.
A backup that has never been restored is a guess.

## Restoring for real

1. Stop writes: scale the API and workers to zero (`docker service scale shortener_api=0 ...`).
2. Postgres: create an empty database and restore into it.
   ```bash
   docker exec <db container> createdb -U postgres production_restored
   docker exec -i <db container> pg_restore -U postgres -d production_restored --no-owner < kurz-<stamp>.dump
   ```
   Check the counts, then swap it in: rename the old database, rename the restored one to `production`, and re-run `.ci/security/roles.sql` so the `kurz_app` role has its privileges.
3. SeaweedFS: stop the service, move the old data directory aside, extract the archive in its place, start the service.
4. Secrets: put the `.env`, the VAPID keys and `s3.json` back.
5. Scale the API and workers back up and check `/up`, a login, a public form and an appointment page.

## Before opening to everyone

- [ ] `backup.sh` runs from cron with `REMOTE` set, and the first copy is visible on the other host.
- [ ] `restore-test.sh` passed on a copy that came from the other host.
- [ ] Someone other than the person who wrote this has read the restore steps and knows where the secrets copy is.
