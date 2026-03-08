FROM node:22-alpine AS base

# --- Install bun for dependency resolution ---
FROM base AS deps
RUN apk add --no-cache bash && npm install -g bun@1.3.2
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/
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
COPY apps/web ./apps/web
COPY packages ./packages

ENV NEXT_TELEMETRY_DISABLED=1

RUN cd apps/web && npx next build

# --- Run ---
FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 app && \
    adduser --system --uid 1001 app

COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build --chown=app:app /app/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /app/apps/web/.next/static ./apps/web/.next/static

USER app

ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
