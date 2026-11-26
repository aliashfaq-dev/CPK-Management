-- REFERENCE COPY of the detection pipeline's sql/schema.sql.
-- NOTE: this file was reconstructed from the column list in the project brief, not copied from
-- the pipeline repository. Before relying on it, replace it with the real sql/schema.sql from the
-- pipeline (the pipeline remains the source of truth). Column types here are best guesses.
-- Used only to bootstrap a local Docker Postgres (docker-compose.db.yml); never run on Neon.

CREATE TABLE IF NOT EXISTS public.cameras (
  camera_id  text PRIMARY KEY,
  name       text,
  location   text,
  node_id    text,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.runs (
  run_id         text PRIMARY KEY,
  camera_id      text REFERENCES public.cameras (camera_id),
  source         text,
  started_at     timestamptz,
  finished_at    timestamptz,
  frames         bigint,
  fps            double precision,
  tracks_seen    bigint,
  events_emitted bigint,
  status         text
);

CREATE TABLE IF NOT EXISTS public.events (
  event_id                   text PRIMARY KEY,
  camera_id                  text,
  event_time                 timestamptz,
  event_date                 date,
  snapshot_vehicle           text,
  snapshot_number_plate      text,
  plate_detection_confidence double precision,
  number_plate               text,
  number_plate_confidence    double precision,
  vehicle_type               text NOT NULL
    CHECK (vehicle_type IN ('car', 'rickshaw', 'htv', 'van', 'pickup', 'bike')),
  analysis_status            text,
  analysis                   jsonb,
  analysis_updated_at        timestamptz,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  run_id                     text,
  s3_bucket                  text,
  vehicle_key                text,
  plate_key                  text,
  analysis_error             text,
  analysis_attempts          integer NOT NULL DEFAULT 0,
  has_plate                  boolean GENERATED ALWAYS AS (number_plate IS NOT NULL AND number_plate <> '') STORED
);
