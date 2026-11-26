-- Frontend-owned objects. Idempotent: safe to run repeatedly (npm run db:migrate).
-- It never ALTERs or DROPs the pipeline's tables (cameras, runs, events); the only change
-- to `events` is the AFTER INSERT/UPDATE notify trigger and the read indexes below.
-- Works on Neon and on a local Docker Postgres (PG 13+ has gen_random_uuid built in;
-- on older servers pgcrypto is created as a fallback).

DO $$
BEGIN
  PERFORM gen_random_uuid();
EXCEPTION WHEN undefined_function THEN
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
END
$$;

-- ---------------------------------------------------------------------------
-- Dashboard view over events. make/model/colour come from the stage-2 `analysis`
-- JSONB and are NULL until that pipeline has written it.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  view_sql constant text := $view$
    SELECT
      e.event_id,
      e.event_time,
      e.camera_id,
      e.number_plate,
      e.number_plate_confidence,
      e.plate_detection_confidence,
      e.vehicle_type,
      e.has_plate,
      e.plate_key,
      e.vehicle_key,
      e.s3_bucket,
      e.run_id,
      e.analysis_status,
      e.analysis ->> 'make' AS make,
      e.analysis ->> 'model' AS model,
      COALESCE(e.analysis ->> 'colour', e.analysis ->> 'color') AS colour
    FROM public.events e
  $view$;
BEGIN
  BEGIN
    EXECUTE 'CREATE OR REPLACE VIEW public.v_events_dashboard AS ' || view_sql;
  EXCEPTION WHEN invalid_table_definition THEN
    -- An older version of this view has a different column list; views cannot change
    -- columns in place, so recreate it (the view is frontend-owned, nothing depends on it).
    EXECUTE 'DROP VIEW IF EXISTS public.v_events_dashboard';
    EXECUTE 'CREATE VIEW public.v_events_dashboard AS ' || view_sql;
  END;
END
$$;

-- ---------------------------------------------------------------------------
-- App tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  name          text NOT NULL,
  role          text NOT NULL CHECK (role IN ('admin', 'viewer')),
  password_hash text NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- plate_norm is uppercase A-Z0-9 only (enforced by the CHECK; the app normalises before insert).
CREATE TABLE IF NOT EXISTS public.watchlist (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_norm text NOT NULL UNIQUE CHECK (plate_norm ~ '^[A-Z0-9]+$'),
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_settings (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);

-- ---------------------------------------------------------------------------
-- Realtime: notify the app on every events INSERT/UPDATE. The payload stays tiny;
-- the app re-reads the row from v_events_dashboard.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_events_changed() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify(
    'events_changed',
    json_build_object('event_id', NEW.event_id, 'op', lower(TG_OP))::text
  );
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS trg_events_changed ON public.events;
CREATE TRIGGER trg_events_changed
  AFTER INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.notify_events_changed();

-- ---------------------------------------------------------------------------
-- Indexes for the dashboard queries
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_events_event_time ON public.events (event_time DESC);
CREATE INDEX IF NOT EXISTS idx_events_vehicle_type ON public.events (vehicle_type);
CREATE INDEX IF NOT EXISTS idx_events_number_plate ON public.events (number_plate);
CREATE INDEX IF NOT EXISTS idx_events_camera_time ON public.events (camera_id, event_time DESC);
