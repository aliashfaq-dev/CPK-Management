# AGENTS.md — Vehicle Tracking & Detection System

Instructions for AI coding agents working in this repository. Read this before changing code.

## Project summary

A frontend dashboard for an AI-powered vehicle tracking and detection platform. All data is dummy data today. Real AI recognition, live video streaming, and authentication are **not** implemented; never imply otherwise in the UI or copy.

## Tech stack

- Next.js 15 (App Router) with React 19
- TypeScript (strict)
- Tailwind CSS v4 (CSS-first config in `src/app/globals.css`, tokens in `src/styles/tokens.css`)
- Recharts for charts
- Font Awesome (`@fortawesome/react-fontawesome` + `free-solid-svg-icons`) for **all** icons

## Commands

```bash
npm install          # install dependencies
npm run dev          # dev server at http://localhost:3000
npm run typecheck    # tsc --noEmit
npm run lint         # next lint
npm run build        # production build (run before finishing any task)
```

Before finishing a task: run `npm run typecheck`, `npm run lint`, and `npm run build`, and fix every error.

## Folder structure

```
src/
├── app/                 Routes (App Router). Pages are thin server components.
│   ├── layout.tsx       Root layout; loads user + notifications, wraps DashboardLayout
│   ├── page.tsx         /            Dashboard
│   ├── detections/      /detections
│   ├── find-flag/       /find-flag
│   ├── analytics/       /analytics
│   ├── live-camera/     /live-camera
│   └── settings/        /settings
├── components/
│   ├── layout/          Sidebar, Header, MobileNavigation, DashboardLayout
│   ├── ui/              Generic, reusable primitives (Button, Input, Modal, Tabs…)
│   ├── dashboard/ detections/ find-flag/ analytics/ live-camera/ settings/
│   │                    Feature components, grouped by route
├── data/                mock-data.ts (dummy data), navigation.ts (nav config)
├── hooks/               useEscape, useClickOutside, useLocalStorage
├── lib/                 utils.ts, constants.ts, data-service.ts
├── styles/              tokens.css (theme variables)
└── types/index.ts       All shared TypeScript interfaces
```

## Architecture rules

- **Pages are server components.** They fetch data through `src/lib/data-service.ts` and pass it as props to a client "View" component (e.g. `DetectionsView`).
- **Never import `src/data/mock-data.ts` from components or pages.** Go through `data-service.ts`. Every function there is async and typed so it can be replaced by `fetch()` calls without touching UI code.
- Add `"use client"` only to components that use state, effects, browser APIs, or event handlers passed from a parent. Keep it as deep in the tree as practical.
- Keep large datasets out of components. New dummy data goes in `src/data/mock-data.ts`; new shapes go in `src/types/index.ts`.
- Mock data must be deterministic (no `Math.random()` at module level, no `Date.now()` during render) to avoid hydration mismatches. Use `BASE_TIME` and the seeded RNG already in `mock-data.ts`. Format dates in UTC via `formatDateTime`.

## TypeScript rules

- `strict` is on. Do not use `any`; use `unknown` and narrow, or define a type.
- Shared types live in `src/types/index.ts`. Component props are declared as an `interface` next to the component.
- Prefer union types (`"online" | "offline" | "warning"`) over free strings.
- Use the `@/` alias for imports from `src`.

## Component conventions

- One component per file, PascalCase file and export name, named exports (pages and layouts use default exports as Next.js requires).
- Reuse before creating. Check `src/components/ui` first. If two features need the same markup, extract it into `ui/`.
- Components receive data via props; they do not fetch data themselves, except view components that call `data-service` for client-side range changes (see `AnalyticsView`).
- Every interactive element must be keyboard accessible and have an accessible name (`aria-label` for icon-only buttons). Use semantic HTML: `table`, `th scope`, `nav`, `dl`, `ol`, `button`.
- Provide loading (`LoadingState`), empty (`EmptyState`), and error states for any data-driven view.

## Tailwind CSS conventions

- Use utility classes in JSX. Use the theme tokens (`bg-surface`, `bg-canvas`, `text-fg`, `text-muted`, `border-line`, `bg-accent`, `text-success-strong`, …) — **never hardcode hex colors** in components. Theme changes happen in `src/styles/tokens.css`.
- Chart colors come from `CHART_COLORS` / `VEHICLE_TYPE_COLORS` in `src/lib/constants.ts`.
- Merge conditional classes with `cn()` from `src/lib/utils.ts`.
- Mobile first: write base styles for small screens, then add `sm:`, `md:`, `lg:`, `xl:` modifiers.
- Standard spacing rhythm: `gap-4` between cards, `p-5` inside cards, `px-4 py-3` for table cells.

## UI design rules

- Clean, flat, minimal, enterprise look: thin 1px borders, subtle separators, `rounded-md` / `rounded-lg` only.
- **No gradients. No box shadows. No glow effects. No glassmorphism.** Use borders and background tones for hierarchy instead.
- One accent color (blue). Use success / warning / danger only to communicate status.
- Keep animation minimal: color and width transitions only. No entrance animations.
- Copy: sentence case, plain verbs, specific button labels ("Save camera", not "Submit"). Empty states explain what to do next.

## Icon usage

- Font Awesome only. Import icon definitions from `@fortawesome/free-solid-svg-icons` and render with `FontAwesomeIcon`.
- Do not add Lucide, Heroicons, or any other icon library.
- Vehicle type icons are mapped in `VEHICLE_TYPE_ICONS`; navigation icons live in `src/data/navigation.ts`.

## Routing conventions

- Each route is a folder in `src/app` with a `page.tsx` that exports `metadata` with a short `title`.
- Add new navigation entries only in `src/data/navigation.ts`; the Sidebar, MobileNavigation, and Header title/breadcrumbs read from it.
- In Next.js 15, `searchParams` and `params` are Promises — `await` them.

## Responsive requirements

- Desktop: collapsible sidebar, multi-column cards and charts.
- Tablet: sidebar stays available; grids collapse to two columns.
- Mobile (< 768px): sidebar becomes a drawer (`MobileNavigation`), single-column layout, no page-level horizontal overflow. Wide tables scroll inside an `overflow-x-auto` wrapper.
- Check every new screen at roughly 375px, 768px, 1280px, and 1536px wide.

## Data handling

- Settings persist to `localStorage` through `useLocalStorage` (keys prefixed `vts:`). Always handle the pre-hydration state.
- Uploaded images are previewed with `URL.createObjectURL`; revoke the URL when replaced or removed.
- Do not claim AI image recognition or live streaming works. Placeholders must say they are placeholders.

## Branding and theme (CPK Karachi)

- Brand: Community Policing Karachi (CPK). Logo at `public/images/cpk-logo.jpeg`, rendered in `SidebarBrand`.
- Palette: navy (`--accent`), red (`--danger`, used for primary calls to action like "New flag entry" and "Search"), and white surfaces. Change it only in `src/styles/tokens.css`.
- Status colors (success, warning) stay reserved for status.

## Assistant chatbox

- `src/components/ui/AssistantChat.tsx` is the large chat-style search box. It appears on `/`, `/detections`, and `/find-flag`. Reuse it; do not duplicate it.
- `src/lib/assistant.ts` is a rule-based parser over the dummy data (English and Roman Urdu). It is **not** an AI model. To connect Claude or Gemini, replace the body of `askAssistant` with a call to a server route and keep the `AssistantReply` shape. Never put API keys in client code.
