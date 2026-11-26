# PostgreSQL Integration (Neon & Local Docker)

This dashboard works identically against **Neon PostgreSQL** and **local Docker PostgreSQL 16** using the standard `pg` driver (`src/lib/db.ts` and `src/lib/live.ts`). Switching environments only requires updating `DATABASE_URL` (and `DATABASE_URL_DIRECT` on Neon).

## Connection URLs & TLS

- **Neon:** Set `DATABASE_URL` to the pooled connection string (`?sslmode=require`) and `DATABASE_URL_DIRECT` to the direct (non-pooler) connection string (`?sslmode=require`). `LISTEN/NOTIFY` (`src/lib/live.ts`) requires `DATABASE_URL_DIRECT` because PgBouncer pooled endpoints on Neon do not support `LISTEN`.
- **Local Docker Postgres (`docker-compose.db.yml`):** Set `DATABASE_URL=postgres://cpk:cpk_local_password@127.0.0.1:5432/cpk` (no `sslmode`, so TLS is disabled automatically) and leave `DATABASE_URL_DIRECT` blank.

## Schema ownership

- **Pipeline-owned tables** (never altered or dropped by the frontend; reference copy in `sql/pipeline-schema.sql`): `public.cameras`, `public.runs`, `public.events`.
- **Frontend-owned objects** (`sql/frontend.sql`, applied idempotently via `npm run db:migrate`):
  - `public.v_events_dashboard` — projects `events` columns and extracts stage-2 `make`, `model`, and `colour` from `analysis` JSONB.
  - `public.app_users` — `admin` and `viewer` accounts with `bcryptjs` password hashes.
  - `public.watchlist` — normalized uppercase alphanumeric (`A-Z0-9`) plates for high-severity alerts.
  - `public.app_settings` — JSONB key-value store for alert rules and `empty_database_audit` history.
  - `trg_events_changed` — `AFTER INSERT OR UPDATE` trigger calling `pg_notify('events_changed', ...)`.

## Realtime updates & hosting

New detections and stage-2 `analysis` updates stream immediately over `/api/live/events` (SSE) — the legacy 10-second polling refresh has been removed. Deploy on a long-lived Node process (`npm run build && npm start`), not on serverless functions.
