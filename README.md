# Vehicle Tracking & Detection System

A responsive dashboard for vehicle tracking and detection, built with Next.js (App Router), TypeScript, Tailwind CSS, Recharts, and Font Awesome. All data is dummy data and no backend is required.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Other commands:

```bash
npm run typecheck   # TypeScript check
npm run lint        # ESLint
npm run build       # production build
npm run start       # serve the production build
```

## Assistant chatbox

The dashboard, Detections, and Find Flag pages each have a large chat-style search box. It currently parses questions (English or Roman Urdu) against the sample data in `src/lib/assistant.ts`. It is not an AI model; swap in Claude or Gemini there via a server route.

## Pages

| Route          | What it does                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `/`            | Stat cards, 24-hour activity chart, recent detections, camera status, type distribution        |
| `/detections`  | Searchable, filterable, sortable, paginated table with CSV export and a detail drawer          |
| `/find-flag`   | Search by plate, type, camera, time range, or image preview; results, timeline, camera info    |
| `/analytics`   | Trends, hourly and weekly activity, confidence, camera performance, with date range filters    |
| `/live-camera` | Grid and single-camera views, status filter, fullscreen, detection overlay, recent detections  |
| `/settings`    | General, detection, camera, notification, and profile settings (saved to localStorage)         |

## What is not implemented

- Image-based vehicle recognition (uploads are only previewed and return sample matches)
- Live video streaming (camera feeds are placeholders)
- Authentication and a real API (see `src/lib/data-service.ts` for the swap point)

## Theming

All colors are CSS variables in `src/styles/tokens.css`. Edit them to retheme the app. See `AGENTS.md` for the full project conventions.
