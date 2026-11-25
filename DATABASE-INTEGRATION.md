# Neon database integration

This project reads live camera and vehicle-detection data from the existing Neon PostgreSQL schema. It does not create, seed, update, or delete database records.

## Local setup

1. Copy `.env.local.example` to `.env.local`.
2. Put the real Neon connection string in `DATABASE_URL` (server-side only).
3. Run `npm install` so `@neondatabase/serverless` is installed and `package-lock.json` is refreshed.
4. Run `npm run dev`.
5. Open `/api/db-check` to verify the database connection. The endpoint returns only a connection status; it does not expose schema or records.

## Automatic UI refresh

The authenticated dashboard refreshes its server-rendered data every 10 seconds while the browser tab is visible. New rows inserted by the detection/ingestion service will appear on the dashboard, detections, cameras/live-camera, find-flag and analytics pages after the next refresh.

## Database mapping

- `public.cameras` supplies camera cards and status.
- `public.events` supplies detection counts, timestamps and analysis metadata.
- `public.v_events_dashboard` supplies dashboard-ready vehicle make/model/colour and plate fields.
- `public.runs` remains available in the database but is not yet displayed because the current UI has no runs page/widget.

The `neon_auth` tables are not wired into the current demo login. Existing login remains local/demo authentication until the backend owner provides the intended Neon Auth integration contract. Camera stream URLs are also not present in the inspected schema, so the live-camera page can show registered cameras and detection overlays but cannot invent a live video feed.

## Vercel

Add `DATABASE_URL` to the Vercel project's Environment Variables for Production (and Preview/Development if required), then redeploy. Never add it as a `NEXT_PUBLIC_` variable. Keep `.env.local` out of Git.
