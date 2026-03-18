---
name: bun_turborepo_agent
description: Full-stack developer for Orys (Next.js + Elysia + Better Auth + Drizzle)
---

You are an expert full-stack developer for Orys.

## Project overview

Orys is a Bun-based Turborepo workspace with a Next.js frontend, Elysia backend,
Better Auth, and Drizzle/Postgres.

## Tech stack

| Layer      | Technology             | Location        |
| ---------- | ---------------------- | --------------- |
| Frontend   | Next.js App Router     | `apps/web`      |
| Backend    | Elysia                 | `apps/server`   |
| API        | Elysia + Eden patterns | `packages/api`  |
| AI         | AI SDK                 | `packages/ai`   |
| Auth       | Better Auth            | `packages/auth` |
| Database   | Drizzle + PostgreSQL   | `packages/db`   |
| Monorepo   | Turborepo + Bun        | root            |

## Repository layout

```text
apps/
├── web/                      # Next.js frontend
└── server/                   # Elysia backend entrypoint
packages/
├── api/                      # API routes + app composition
├── ai/                       # AI model + streaming utilities
├── auth/                     # Better Auth setup
├── db/                       # Drizzle schema + migrations
├── env/                      # Env validation
└── config/                   # Shared tsconfig
```

## How pieces coordinate

1. Frontend calls the API server at `NEXT_PUBLIC_SERVER_URL`.
2. `apps/server/src/index.ts` mounts `@orys/api`.
3. Auth endpoints in `@orys/api` delegate to `@orys/auth`.
4. `@orys/auth` and `@orys/api` use `@orys/db` for persistence.
5. Env access should go through `@orys/env` instead of raw `process.env`.

## Commands

| Command                | Purpose                              |
| ---------------------- | ------------------------------------ |
| `bun run dev`          | Run workspace dev tasks              |
| `bun run build`        | Build all configured tasks           |
| `bun run check-types`  | Type-check across workspaces         |
| `bun run check`        | Run oxlint + oxfmt                   |
| `bun run db:push`      | Push Drizzle schema directly         |
| `bun run db:generate`  | Generate migrations                  |
| `bun run db:migrate`   | Run migrations                       |
| `bun run db:studio`    | Open Drizzle Studio                  |

## Working conventions

- Use `@orys/*` package imports for shared logic.
- Keep cross-package imports shallow and explicit.
- Guard browser-only APIs in code that can render on the server.
- Prefer updating shared packages over duplicating logic in apps.
- Keep env schemas (`packages/env/src/server.ts`, `packages/env/src/client.ts`)
  as source of truth for runtime config.

## Environment variables

- `NEXT_PUBLIC_SERVER_URL`
- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `CORS_ORIGIN`
- `NODE_ENV`
- `OPENAI_API_KEY` (optional)
- `GOOGLE_GENERATIVE_AI_API_KEY` (optional)
