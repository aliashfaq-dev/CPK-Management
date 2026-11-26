# AGENTS.md — Vehicle Tracking & Detection System

Instructions for AI coding agents working in this repository. Read this before changing code.

## Project summary

A Next.js 15 dashboard and control frontend for the Community Policing Karachi (CPK) vehicle tracking and detection pipeline (Python FastAPI service + PostgreSQL + S3-compatible object storage).

- **Vehicle types:** Strictly the 6 pipeline classes: `car`, `rickshaw`, `htv`, `van`, `pickup`, `bike` (display labels in `VEHICLE_TYPE_LABELS` in `src/lib/constants.ts`). Never reintroduce `"other"` or regex guessing from make/model.
- **Stage-2 analysis:** Vehicle `make`, `model`, and `colour` come from `events.analysis` JSONB (`v_events_dashboard`) written asynchronously by a separate stage-2 service. Render `null` cleanly (`"Not analysed yet"`).
- **Uploaded chat/search media:** Image/video uploads in `AssistantChat` and `FindFlagView` are browser-only previews (`URL.createObjectURL`); never claim uploaded image recognition is active.

## Tech stack

- Next.js 15 (App Router, long-lived Node runtime) with React 19
- TypeScript (`strict`)
- PostgreSQL via `pg` (`Pool` in `src/lib/db.ts`, `LISTEN/NOTIFY` singleton `Client` in `src/lib/live.ts`)
- S3 presigned redirects via `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (`forcePathStyle: true`)
- Auth via `jose` (HS256 `httpOnly` `SameSite=Strict` cookies) + `bcryptjs`, validated with `zod`
- Tailwind CSS v4 (`src/app/globals.css`, tokens in `src/styles/tokens.css`)
- Recharts for charts; Font Awesome (`@fortawesome/react-fontawesome` + `free-solid-svg-icons`) for **all** icons

## Commands

```bash
npm install                # install dependencies
npm run db:migrate         # apply sql/frontend.sql to DATABASE_URL_DIRECT / DATABASE_URL
npm run dev                # dev server at http://localhost:3000
npm run mock:pipeline      # optional mock FastAPI REST + WS pipeline on 127.0.0.1:8000
npm run typecheck          # tsc --noEmit
npm run lint               # next lint
npm run test:constraints   # verify security & deletion constraints
npm run build              # production build
npm start                  # production Node server (required for SSE & MJPEG)
```

Before finishing any task: run `npm run typecheck`, `npm run lint`, and `npm run build`, and fix every error.

## Security & architecture rules

- **No secrets on the client:** Never use `NEXT_PUBLIC_` for any key, URL, or token. Never commit `.env*` files (only `.env.local.example` with empty values). Never log connection strings, tokens, API keys, or RTSP credentials.
- **Parameterized SQL only:** Every query goes through `query(text, params)` in `src/lib/db.ts` / `src/lib/data-service.ts`. Never interpolate user or LLM strings into SQL. All counts, analytics, distributions, and pagination run in SQL (`GROUP BY` / `COUNT(*)`), never by loading full tables into memory.
- **Defense-in-depth auth:** `src/middleware.ts` checks session cookies at the edge, AND every API route handler calls `authorize(request, { admin })` from `src/lib/auth-server.ts` (which also enforces same-origin `Origin` headers on mutating methods).
- **No individual event deletion:** Detection rows (`events`) can never be deleted individually from any UI or API. Only `POST /api/admin/empty-database` (admin-only, `"DELETE"` confirmation, audited) may `TRUNCATE` `events` and `runs`.
- **Dummy data isolation:** `src/data/mock-data.ts` is reserved strictly for offline tests; never import it into pages, components, or `src/lib/*`.
- **UI & styling conventions:** Flat enterprise UI (1px borders, `rounded-md`/`rounded-lg`, theme tokens from `src/styles/tokens.css` — no gradients, box shadows, glow effects, glassmorphism, or hardcoded hex colors outside `constants.ts` chart palettes). Font Awesome icons only.
