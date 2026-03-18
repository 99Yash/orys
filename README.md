# Orys

Orys is a full-stack monorepo scaffold for building web products with a typed API,
auth, and PostgreSQL-backed persistence.

## Tech stack

- Next.js 16 App Router (`apps/web`)
- Elysia + Eden (`apps/server`, `packages/api`)
- AI SDK package (`packages/ai`)
- Better Auth (`packages/auth`)
- Drizzle ORM + PostgreSQL (`packages/db`)
- Turborepo + Bun workspaces

## Local development

1. Install dependencies:

   ```bash
   bun install
   ```

2. Configure environment files:

   ```bash
   cp apps/server/.env.example apps/server/.env
   cp apps/web/.env.example apps/web/.env
   ```

3. Update env values (`DATABASE_URL`, `BETTER_AUTH_SECRET`, etc.).
4. Push schema to your local database:

   ```bash
   bun run db:push
   ```

5. Start the monorepo:

   ```bash
   bun run dev
   ```

- Web app: http://localhost:3000
- API server: http://localhost:3001

See `SETUP.md` for a more detailed walkthrough.

## Scripts

- `bun run dev` - Start all dev tasks
- `bun run dev:web` - Start only the web app
- `bun run dev:server` - Start only the API server
- `bun run build` - Build the workspace
- `bun run check-types` - Type-check all workspaces
- `bun run check` - Run oxlint + oxfmt
- `bun run db:push` - Push schema directly
- `bun run db:generate` - Generate migrations
- `bun run db:migrate` - Run migrations
- `bun run db:studio` - Open Drizzle Studio

## Project structure

```text
orys/
├── apps/
│   ├── web/         # Next.js frontend
│   └── server/      # Elysia backend
├── packages/
│   ├── api/         # Elysia routes + Eden types
│   ├── ai/          # AI SDK helpers and model utilities
│   ├── auth/        # Better Auth configuration
│   ├── db/          # Drizzle schema + database utilities
│   ├── env/         # Environment validation
│   └── config/      # Shared TypeScript config
└── turbo.json
```

## Docker (optional)

This repo includes a `docker-compose.yml` and app-level Dockerfiles for running
Postgres, the API server, and the web app in containers.
