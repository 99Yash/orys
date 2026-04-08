import { auth } from "@orys/auth";

type Session = Awaited<ReturnType<ReturnType<typeof auth>["api"]["getSession"]>>;

// Layer 1 — per-request dedup
const perRequest = new WeakMap<Request, Promise<Session>>();

// Layer 2 — token cache with 10s TTL
const TOKEN_TTL_MS = 10_000;
const MAX_TOKEN_CACHE_SIZE = 1_000;
const tokenCache = new Map<
  string,
  { session: Session; expiresAt: number }
>();
const tokenInflight = new Map<string, Promise<Session>>();

const sweepTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of tokenCache) {
    if (entry.expiresAt <= now) tokenCache.delete(key);
  }
}, 60_000);
if (typeof sweepTimer === "object" && "unref" in sweepTimer)
  (sweepTimer as NodeJS.Timeout).unref();

const SESSION_COOKIE_NAMES = new Set([
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
  "__Host-better-auth.session_token",
]);

function extractSessionToken(headers: Headers): string | undefined {
  const cookie = headers.get("cookie");
  if (!cookie) return undefined;

  for (const part of cookie.split(";")) {
    const [rawName, ...valueParts] = part.trim().split("=");
    if (!rawName || valueParts.length === 0) continue;

    const name = rawName.trim();
    if (
      !SESSION_COOKIE_NAMES.has(name) &&
      !name.endsWith("better-auth.session_token")
    )
      continue;

    const rawValue = valueParts.join("=").trim();
    if (!rawValue) return undefined;

    try {
      const decoded = decodeURIComponent(rawValue);
      if (
        decoded.startsWith('"') &&
        decoded.endsWith('"') &&
        decoded.length > 1
      ) {
        return decoded.slice(1, -1);
      }
      return decoded;
    } catch {
      return rawValue;
    }
  }

  return undefined;
}

export function getSessionCached(request: Request): Promise<Session> {
  // 1. Per-request dedup
  let promise = perRequest.get(request);
  if (promise) return promise;

  // 2. Token-level cache
  const token = extractSessionToken(request.headers);
  if (token) {
    const cached = tokenCache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
      promise = Promise.resolve(cached.session);
      perRequest.set(request, promise);
      return promise;
    }

    const inflight = tokenInflight.get(token);
    if (inflight) {
      perRequest.set(request, inflight);
      return inflight;
    }
  }

  // 3. DB lookup
  promise = auth()
    .api.getSession({ headers: request.headers })
    .then((session) => {
      if (token) {
        if (tokenCache.size >= MAX_TOKEN_CACHE_SIZE) {
          const oldest = tokenCache.keys().next().value;
          if (oldest) tokenCache.delete(oldest);
        }
        tokenCache.set(token, {
          session,
          expiresAt: Date.now() + TOKEN_TTL_MS,
        });
      }
      return session;
    })
    .finally(() => {
      if (token) tokenInflight.delete(token);
    });

  if (token) tokenInflight.set(token, promise);
  perRequest.set(request, promise);
  return promise;
}
