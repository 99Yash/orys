# CLAUDE.md

This file provides guidance to coding agents when working in this repository.

## Project overview

Orys is a Bun + Turborepo monorepo with:

- `apps/web`: Next.js App Router frontend
- `apps/server`: Elysia backend
- `packages/api`: API route composition and exported app types
- `packages/ai`: shared AI SDK helpers (models/providers/stream wrappers)
- `packages/auth`: Better Auth configuration
- `packages/db`: Drizzle schema/migrations and DB client
- `packages/env`: Runtime env validation

## Core commands

```bash
bun run dev
bun run dev:web
bun run dev:server
bun run check-types
bun run build
bun run db:push
bun run db:generate
bun run db:migrate
bun run db:studio
```

## Architecture notes

1. `apps/server/src/index.ts` mounts the Elysia app exported from `@orys/api`.
2. Auth routes live under `@orys/api` and delegate to `@orys/auth`.
3. `@orys/auth` uses Drizzle adapter + schema from `@orys/db`.
4. Frontend should consume API through `NEXT_PUBLIC_SERVER_URL`.

## Coding conventions

- Prefer shared code in `packages/*` over duplicating logic in `apps/*`.
- Use `@orys/*` imports for workspace packages.
- Avoid deep relative imports across package boundaries.
- Guard browser-only APIs (`window`, `localStorage`, `document`) in code that
  may run during SSR.
- Prefer env access via `@orys/env` instead of ad-hoc `process.env` reads.

## Environment variables

- `NEXT_PUBLIC_SERVER_URL`
- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `CORS_ORIGIN`
- `NODE_ENV`
- `OPENAI_API_KEY` (optional)
- `GOOGLE_GENERATIVE_AI_API_KEY` (optional)

## Database workflow

- Fast iteration: `bun run db:push`
- Migration-first workflow: `bun run db:generate` then `bun run db:migrate`
