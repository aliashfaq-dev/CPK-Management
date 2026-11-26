# CPK Karachi — Vehicle Tracking & Detection System

Frontend dashboard and control plane for the Community Policing Karachi (CPK) vehicle detection pipeline (Python FastAPI detector + PostgreSQL + S3-compatible object storage).

## Architecture highlights

- **Database (`pg` Pool + `LISTEN/NOTIFY`):** Connects to Neon in cloud development or local Docker PostgreSQL 16 on-premise solely by changing `DATABASE_URL` (`sslmode=require` enables TLS; plain local URLs run without TLS). All queries are parameterized and aggregated in SQL.
- **Realtime SSE (`/api/live/events`):** A singleton `pg.Client` (`DATABASE_URL_DIRECT`, falling back to `DATABASE_URL`) listens on `events_changed` and fans out inserts, stage-2 make/model/colour updates, and watchlist/confidence alerts over Server-Sent Events with `Last-Event-ID` catch-up.
- **Server authentication:** `app_users` with `bcryptjs` password hashes, `jose` HS256 `httpOnly` `SameSite=Strict` session cookies (8-hour expiry), `admin` and `viewer` roles, CSRF `Origin` checks on mutating routes, login rate limiting, and defense-in-depth guards in both `src/middleware.ts` and every route handler.
- **Private S3 snapshots (`/api/images/[eventId]/[kind]`):** Issues 5-minute presigned S3 GET redirects (`forcePathStyle: true` for Neon Object Storage or local MinIO) so storage keys and endpoints never appear in client HTML.
- **Pipeline control & annotated MJPEG (`/api/pipeline/*`, `/api/live/frames/[streamId]`):** Proxies stream start/stop/restart/create/delete to the local FastAPI detector (`X-API-KEY`) and converts `/ws/frames/{streamId}` binary JPEG frames into backpressure-safe MJPEG for `<img>`.
- **Gemini filter assistant (`/api/assistant`):** Converts English and Roman Urdu questions into Zod-validated structured filter JSON; Gemini never receives database rows or writes SQL.

## Prerequisites & deployment requirement

> **Important (long-lived Node server required):** `/api/live/events` (Postgres `LISTEN/NOTIFY` SSE), `/api/live/pipeline-events`, and `/api/live/frames/[streamId]` (WebSocket-to-MJPEG bridge) require a persistent Node.js process (`npm run build && npm start`). Serverless platforms such as Vercel terminate long-lived connections and background listeners, so live streaming routes will not work there. Run Next.js as a standard Node process on the same machine or LAN as the pipeline.

## Setup & run procedure

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   Copy `.env.local.example` to `.env.local` and fill in the server variables (never prefix any secret with `NEXT_PUBLIC_`):

   - `DATABASE_URL` — PostgreSQL URL (add `?sslmode=require` for Neon; omit for local Docker Postgres).
   - `DATABASE_URL_DIRECT` — Direct (non-pooled) PostgreSQL URL required by `LISTEN/NOTIFY` on Neon (leave blank on local Postgres to reuse `DATABASE_URL`).
   - `SESSION_SECRET` — At least 32 random characters (`openssl rand -base64 48`).
   - `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` — Creates the initial `admin` user when `app_users` is empty.
   - `PIPELINE_URL` / `PIPELINE_TOKEN` — FastAPI detection service (e.g. `http://127.0.0.1:8000`). Point the pipeline's `VIDEO_DIR` at this repo's `public/videos` directory.
   - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_ENDPOINT_URL_S3`, `S3_BUCKET` — S3-compatible bucket for vehicle and plate crops.
   - `GEMINI_API_KEY`, `GEMINI_MODEL` — Optional model override (defaults to `gemini-2.5-flash`) for the search assistant.

3. **(Optional) Start local PostgreSQL via Docker**

   ```bash
   docker compose -f docker-compose.db.yml up -d
   ```

4. **Apply frontend SQL views, tables, indexes, and notify trigger**

   ```bash
   npm run db:migrate
   ```

5. **Build and start the production Node server**

   ```bash
   npm run build && npm start
   ```

   Open `http://localhost:3000`. For development with hot reload, use `npm run dev`. To test pipeline controls and MJPEG frames without the Python detector, run `npm run mock:pipeline` in another terminal.

## Verification commands

```bash
npm run typecheck          # TypeScript strict check
npm run lint               # ESLint
npm run test:constraints   # Security & no-individual-delete verification
npm run build              # Production build
```

## Current scope notes

- Stage-2 vehicle `make`, `model`, and `colour` are populated asynchronously by a separate analysis pipeline into `events.analysis` JSONB; the UI displays `"Not analysed yet"` until that update arrives over SSE.
- Picture and video attachments in the assistant chatbox and Find Flag upload box are previewed locally in the browser; visual similarity / OCR search on uploaded files is not connected.
