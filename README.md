# CPK Karachi — Vehicle Tracking & Detection System

Frontend dashboard and control plane for the Community Policing Karachi (CPK) vehicle detection pipeline (Python FastAPI detector + PostgreSQL + S3-compatible object storage).

## Architecture highlights

- **Database (`pg` Pool + `LISTEN/NOTIFY`):** Connects to Neon or local Docker PostgreSQL 16 solely by changing `DATABASE_URL` (`sslmode=require` enables TLS; plain local URLs run without TLS). All queries are parameterized and aggregated in SQL.
- **Realtime SSE (`/api/live/events`):** Singleton `pg.Client` (`DATABASE_URL_DIRECT` / `DATABASE_URL_UNPOOLED` / `DATABASE_URL`) listens on `events_changed` and fans out inserts, stage-2 make/model/colour updates, and watchlist/confidence alerts over SSE with `Last-Event-ID` catch-up.
- **Fast local WebP image cache (`/api/images/[eventId]/[kind]?w=160|320|640|0`):** Server fetches snapshots from S3 once (`keepAlive`, 5s connect/socket timeouts, in-flight deduplication), resizes and encodes to WebP via `sharp`, and caches immutable `.webp` files on disk (`CACHE_DIR`, default `.cache/images`, capped by `IMAGE_CACHE_MAX_MB`, default `2048` MB). Includes a 5,000-entry key LRU, `ETag` / `304`, `Server-Timing` metrics, automatic SSE warm-up on new detections, and `npm run cache:warm` for pre-warming the latest 200 events.
- **AI-only search (`POST /api/assistant`):** All manual search inputs and forms have been removed in favour of a single Gemini AI search box on every workspace page. Gemini (`GEMINI_MODEL`, default `gemini-2.5-flash`, `temperature: 0`, 15s timeout, 1 retry) receives `Asia/Karachi` (`UTC+05:00`) local time, English + Roman Urdu vocabulary, camera enums, and up to 3 previous turns of filter JSON (never raw DB rows), returning structured filter JSON (`search`, `count`, `group_by_camera`, `group_by_type`, `timeline_of_plate`, `top_plates`, `summary`, plus OCR-tolerant fuzzy plates using `O/0, I/1, S/5, B/8` folding and optional `pg_trgm` `similarity()`). Results are cached (5m per normalized question, 30s per filter JSON) and rendered with read-only applied-filter chips.
- **Server authentication:** `app_users` with `bcryptjs` password hashes, `jose` HS256 `httpOnly` `SameSite=Strict` cookies (8-hour expiry), `admin` and `viewer` roles, CSRF `Origin` checks, rate limiting, and guards in both `src/middleware.ts` and every route handler.
- **Pipeline control & annotated MJPEG (`/api/pipeline/*`, `/api/live/frames/[streamId]`):** Proxies stream controls (`X-API-KEY`) and bridges `/ws/frames/{streamId}` binary JPEGs to backpressure-safe MJPEG.

## Prerequisites & deployment requirement

> **Important (long-lived Node server required):** `/api/live/events`, `/api/live/pipeline-events`, `/api/live/frames/[streamId]`, and the local `.cache/images` WebP disk cache require a persistent Node.js process (`npm run build && npm start`) with writable local storage. Serverless platforms such as Vercel terminate long-lived SSE/MJPEG connections and have ephemeral filesystems.

## Setup & run procedure

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   Copy `.env.local.example` to `.env.local` and fill in the server variables (never prefix any secret with `NEXT_PUBLIC_`):

   - `DATABASE_URL` / `DATABASE_URL_DIRECT` — PostgreSQL URLs (`?sslmode=require` on Neon; direct URL for `LISTEN/NOTIFY`).
   - `SESSION_SECRET`, `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD` — Session signing secret (>= 32 chars) and initial admin bootstrap.
   - `PIPELINE_URL`, `PIPELINE_TOKEN` — FastAPI detection service (point `VIDEO_DIR` at `public/videos`).
   - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_ENDPOINT_URL_S3`, `S3_BUCKET` — S3-compatible snapshot storage.
   - `CACHE_DIR`, `IMAGE_CACHE_MAX_MB` — Resized WebP cache directory (default `.cache/images`) and LRU disk cap in MB (default `2048`).
   - `GEMINI_API_KEY`, `GEMINI_MODEL` — Gemini API key and flash model (default `gemini-2.5-flash`) for AI search.

3. **Apply frontend SQL (`v_events_dashboard`, `pg_trgm`, tables, indexes, trigger)**

   ```bash
   npm run db:migrate
   ```

4. **(Optional) Pre-warm the latest 200 event thumbnails**

   ```bash
   npm run cache:warm
   ```

5. **Build and start the production Node server**

   ```bash
   npm run build && npm start
   ```

## Verification & benchmark commands

```bash
npm run typecheck          # TypeScript strict check
npm run lint               # ESLint
npm test                   # 35+ offline golden AI-search & SQL safety tests
npm run test:constraints   # Security & no-individual-delete verification
npm run test:ai-live       # Optional 10-question live Gemini smoke test (requires GEMINI_API_KEY)
npm run bench:images       # Cold/warm TTFB & 50-thumbnail burst benchmark
npm run build              # Production build
```
