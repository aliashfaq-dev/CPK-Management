# AGENTS.md — Vehicle Tracking & Detection System

Instructions for AI coding agents working in this repository. Read this before changing code.

## Project summary

A Next.js 15 dashboard and control frontend for the Community Policing Karachi (CPK) vehicle tracking and detection pipeline (Python FastAPI service + PostgreSQL + S3-compatible object storage).

- **Vehicle types:** Strictly the 6 pipeline classes: `car`, `rickshaw`, `htv`, `van`, `pickup`, `bike` (display labels in `VEHICLE_TYPE_LABELS` in `src/lib/constants.ts`). Never reintroduce `"other"` or regex guessing from make/model.
- **Stage-2 analysis:** Vehicle `make`, `model`, and `colour` come from `events.analysis` JSONB (`v_events_dashboard`) written asynchronously by a separate stage-2 service. Render `null` cleanly (`"Not analysed yet"`).
- **AI-only search:** All search goes through `AssistantChat` -> `POST /api/assistant` (Gemini structured filter extraction in `src/lib/ai-search-core.ts` & `src/lib/assistant-search.ts`). Never reintroduce manual text search inputs, manual filter forms, fake image-upload match previews, or keyword/rule-based search fallbacks.
- **Cached WebP snapshots:** `/api/images/[eventId]/[kind]?w=160|320|640|0` fetches S3 objects on the server, resizes/encodes WebP via `sharp`, and caches immutable files in `CACHE_DIR` (default `.cache/images`, capped at `IMAGE_CACHE_MAX_MB`, default `2048` MB) with a 5,000-entry key LRU and SSE warm-up. Never expose S3 keys or presigned URLs to the browser.

## Tech stack

- Next.js 15 (App Router, long-lived Node runtime) with React 19
- TypeScript (`strict`)
- PostgreSQL via `pg` (`Pool` in `src/lib/db.ts`, `LISTEN/NOTIFY` singleton `Client` in `src/lib/live.ts`)
- S3 object fetch via `@aws-sdk/client-s3` + WebP resize cache via `sharp` (`src/lib/image-cache.ts`)
- Auth via `jose` (HS256 `httpOnly` `SameSite=Strict` cookies) + `bcryptjs`, validated with `zod`
- Tailwind CSS v4 (`src/app/globals.css`, tokens in `src/styles/tokens.css`)
- Recharts for charts; Font Awesome (`@fortawesome/react-fontawesome` + `free-solid-svg-icons`) for **all** icons

## Commands

```bash
npm install                # install dependencies
npm run db:migrate         # apply sql/frontend.sql to DATABASE_URL_DIRECT / DATABASE_URL
npm run cache:warm         # pre-warm WebP thumbnails for the latest 200 events
npm run dev                # dev server at http://localhost:3000
npm run mock:pipeline      # optional mock FastAPI REST + WS pipeline on 127.0.0.1:8000
npm run typecheck          # tsc --noEmit
npm run lint               # next lint
npm test                   # run offline golden AI-search & SQL safety tests
npm run test:ai-live       # optional live Gemini filter extraction smoke test
npm run test:constraints   # verify security & deletion constraints
npm run bench:images       # benchmark cold/warm /api/images TTFB
npm run build              # production build
npm start                  # production Node server (required for SSE, MJPEG & disk cache)
```

Before finishing any task: run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`, and fix every error.

## Security & architecture rules

- **No secrets on the client:** Never use `NEXT_PUBLIC_` for any key, URL, or token. Never commit `.env*` files (only `.env.local.example` with empty values). Never log connection strings, tokens, API keys, or RTSP credentials.
- **Parameterized SQL only:** Every query goes through `query(text, params)` in `src/lib/db.ts` / `src/lib/data-service.ts`. Never interpolate user or LLM strings into SQL; column and sort names must come from strict allowlists.
- **Defense-in-depth auth:** `src/middleware.ts` checks session cookies at the edge, AND every API route handler calls `authorize(request, { admin })` from `src/lib/auth-server.ts` (which also enforces same-origin `Origin` headers on mutating methods).
- **No individual event deletion:** Detection rows (`events`) can never be deleted individually from any UI or API. Only `POST /api/admin/empty-database` (admin-only, `"DELETE"` confirmation, audited) may `TRUNCATE` `events` and `runs`.
- **Dummy data isolation:** `src/data/mock-data.ts` is reserved strictly for offline tests; never import it into pages, components, or `src/lib/*`.
- **UI & styling conventions:** Flat enterprise UI (1px borders, `rounded-md`/`rounded-lg`, theme tokens from `src/styles/tokens.css` — no gradients, box shadows, glow effects, glassmorphism, or hardcoded hex colors outside `constants.ts` chart palettes). Font Awesome icons only.
