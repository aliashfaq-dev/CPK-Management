-- Reference copy of the detection pipeline's PostgreSQL schema (`cameras`, `runs`, `events`),
-- aligned with the live database column types. Used only to bootstrap local Docker Postgres
-- (`docker-compose.db.yml`); `sql/frontend.sql` never alters or drops these tables.

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
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  frames         integer,
  fps            real,
  tracks_seen    integer,
  events_emitted integer,
  status         text NOT NULL DEFAULT 'running'
);

CREATE TABLE IF NOT EXISTS public.events (
  event_id                   text PRIMARY KEY,
  camera_id                  text NOT NULL,
  event_time                 timestamptz NOT NULL DEFAULT now(),
  event_date                 date NOT NULL DEFAULT CURRENT_DATE,
  snapshot_vehicle           text NOT NULL DEFAULT '',
  snapshot_number_plate      text,
  plate_detection_confidence real,
  number_plate               text,
  number_plate_confidence    real,
  vehicle_type               text NOT NULL
    CHECK (vehicle_type IN ('car', 'rickshaw', 'htv', 'van', 'pickup', 'bike')),
  analysis_status            text NOT NULL DEFAULT 'pending',
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
