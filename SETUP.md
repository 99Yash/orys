# Orys setup guide

This guide covers local setup for the Orys monorepo.

## 1. Install dependencies

```bash
bun install
```

## 2. Configure environment files

### Server (`apps/server/.env`)

```bash
cp apps/server/.env.example apps/server/.env
```

Required values:

- `DATABASE_URL`: PostgreSQL connection string
- `BETTER_AUTH_SECRET`: at least 32 chars
- `BETTER_AUTH_URL`: backend URL (example: `http://localhost:3001`)
- `CORS_ORIGIN`: frontend URL (example: `http://localhost:3000`)
- `NODE_ENV`: usually `development`

Optional AI provider keys (for `@orys/ai`):

- `OPENAI_API_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`

### Web (`apps/web/.env`)

```bash
cp apps/web/.env.example apps/web/.env
```

Required values:

- `NEXT_PUBLIC_SERVER_URL`: API URL (example: `http://localhost:3001`)

## 3. Start Postgres

You can run your own local Postgres instance, or use Docker Compose:

```bash
docker compose up -d db
```

The root `.env.example` includes `POSTGRES_*` values used by Compose.

## 4. Initialize the database

For a fresh setup:

```bash
bun run db:push
```

For migration-first workflow:

```bash
bun run db:generate
bun run db:migrate
```

## 5. Run locally

```bash
bun run dev
```

- Web app: http://localhost:3000
- API server: http://localhost:3001

## 6. Verify

```bash
bun run check-types
bun run build
```
