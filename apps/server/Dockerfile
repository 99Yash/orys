FROM oven/bun:1.3.2-alpine AS base

# --- Install dependencies ---
FROM base AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/server/package.json ./apps/server/
COPY packages/config/package.json ./packages/config/
COPY packages/env/package.json ./packages/env/
COPY packages/db/package.json ./packages/db/
COPY packages/auth/package.json ./packages/auth/
COPY packages/api/package.json ./packages/api/

RUN bun install

# --- Build ---
FROM base AS build
WORKDIR /app

COPY --from=deps /app ./
COPY apps/server ./apps/server
COPY packages ./packages

# --- Run ---
FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 app && \
    adduser --system --uid 1001 app

COPY --from=build --chown=app:app /app ./

USER app

EXPOSE 3001

CMD ["bun", "run", "apps/server/src/index.ts"]
