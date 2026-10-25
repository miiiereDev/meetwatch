# MeetWatch

Monitors the status of online students in Google Meet sessions: who is online, who left, who
never joined, who was late — per class session, with live updates and attendance exports.

> Work in progress. Full documentation (architecture, demo script) lands with the final polish
> milestone. Until then: `pnpm install && pnpm dev` starts the API (http://localhost:4000) and
> the web dashboard (http://localhost:5173) with the built-in simulator.

## Stack

- Monorepo: pnpm workspace, TypeScript strict
- `apps/api` — Fastify + SQLite (better-sqlite3) + SSE
- `apps/web` — Vite + React + Tailwind CSS + TanStack Query
- Providers: `simulator` (default, zero credentials) | `google` (Meet REST API v2) | `csv`
  (attendance report import)

## Scripts

| Command          | What it does                   |
| ---------------- | ------------------------------ |
| `pnpm install`   | Install all workspace packages |
| `pnpm dev`       | Run API + web in watch mode    |
| `pnpm build`     | Production build of both apps  |
| `pnpm test`      | Run all Vitest suites          |
| `pnpm typecheck` | TypeScript project checks      |
| `pnpm lint`      | ESLint                         |
| `pnpm format`    | Prettier write                 |
| `pnpm quality`   | typecheck + lint + test        |

See `docs/GOOGLE_SETUP.md` for connecting the real Google Meet provider.
