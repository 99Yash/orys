# Architecture

This document captures the current architecture and design decisions for Orys.

## Goals

- Keep a clean monorepo split between apps and shared packages.
- Preserve end-to-end type safety from API routes to frontend client calls.
- Centralize auth and data concerns in reusable workspace packages.
- Keep local setup fast with Bun + Turborepo.

## Core decisions

- Frontend: Next.js App Router in `apps/web`
- Backend: Elysia server in `apps/server`
- API typing: Elysia route exports from `packages/api` with Eden client compatibility
- AI utilities: AI SDK wrappers in `packages/ai`
- Auth: Better Auth in `packages/auth`
- Data: PostgreSQL + Drizzle in `packages/db`
- Env validation: `packages/env`

## Workspace components

- `apps/web`
  - UI routes, layouts, and client/server components
  - Uses `NEXT_PUBLIC_SERVER_URL` for API access
- `apps/server`
  - Bootstraps Elysia HTTP server
  - Mounts the `@orys/api` app and CORS middleware
- `packages/api`
  - API route definitions and app composition
  - Auth endpoints and health checks
- `packages/ai`
  - Shared AI model registry, provider selection, and streaming helpers
- `packages/auth`
  - Better Auth configuration and Drizzle adapter wiring
- `packages/db`
  - Drizzle schema, migration files, and DB client
- `packages/env`
  - Runtime-validated server and client env schemas

## Request flow

1. Browser sends request from `apps/web`.
2. Request is routed to `apps/server`.
3. `apps/server` delegates to `@orys/api` routes.
4. Auth routes call Better Auth handlers from `@orys/auth`.
5. Data access flows through `@orys/db`.
6. AI features should use shared helpers from `@orys/ai`.

## Runtime defaults

- Web app: `3000`
- API server: `3001`

## Environment model

Server-side env (`packages/env/src/server.ts`):

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `CORS_ORIGIN`
- `NODE_ENV`
- `OPENAI_API_KEY` (optional)
- `GOOGLE_GENERATIVE_AI_API_KEY` (optional)

Client-side env (`packages/env/src/client.ts`):

- `NEXT_PUBLIC_SERVER_URL`

## Deployment notes

- `apps/web` and `apps/server` each ship with Dockerfiles.
- Root `docker-compose.yml` can run web + server + postgres locally.
