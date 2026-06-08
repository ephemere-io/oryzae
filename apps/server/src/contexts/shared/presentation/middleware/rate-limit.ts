import { createHash } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { Context, MiddlewareHandler, Next } from 'hono';

type RateLimitTier = 'fermentation' | 'auth_strict' | 'auth_lenient' | 'general';
type IdentifierMode = 'ip' | 'user_or_ip' | 'token_or_ip';

const TIER_CONFIG: Record<RateLimitTier, { requests: number; windowMs: number }> = {
  fermentation: { requests: 5, windowMs: 60_000 },
  auth_strict: { requests: 20, windowMs: 60_000 },
  auth_lenient: { requests: 120, windowMs: 60_000 },
  general: { requests: 60, windowMs: 60_000 },
};

// Brute-force-prone or enumeration-prone segments under /auth/*.
// These remain IP-based so a hostile actor cannot bypass the cap by rotating
// tokens; everything else under /auth/* uses the lenient per-token tier so
// shared-NAT users do not collide.
const STRICT_AUTH_SEGMENTS = new Set(['login', 'signup', 'verify-otp', 'reset-password', 'oauth']);

let redis: Redis | undefined;
const limiters = new Map<RateLimitTier, Ratelimit>();

function getRedis(): Redis | undefined {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return undefined;

  redis = new Redis({ url, token });
  return redis;
}

function getLimiter(tier: RateLimitTier): Ratelimit | undefined {
  const existing = limiters.get(tier);
  if (existing) return existing;

  const r = getRedis();
  if (!r) return undefined;

  const config = TIER_CONFIG[tier];
  const limiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(config.requests, `${config.windowMs} ms`),
    prefix: `ratelimit:${tier}`,
  });
  limiters.set(tier, limiter);
  return limiter;
}

function getIp(c: Context): string {
  return (
    c.req.header('x-real-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  );
}

function getIdentifier(c: Context, mode: IdentifierMode): string {
  if (mode === 'ip') return getIp(c);

  if (mode === 'user_or_ip') {
    // @type-assertion-allowed: Hono context variable is set by authMiddleware before rate-limit runs
    const userId = c.get('userId' as never);
    if (typeof userId === 'string') return userId;
    return getIp(c);
  }

  // token_or_ip — derive a stable per-session identifier from the Bearer token
  // without verifying it (the rate-limit only needs a stable key, not auth).
  // Hashing avoids storing raw tokens in Upstash keys.
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const hash = createHash('sha256').update(token).digest('hex').slice(0, 32);
    return `token:${hash}`;
  }
  return getIp(c);
}

export function isStrictAuthPath(path: string): boolean {
  const segments = path.split('/');
  const authIdx = segments.lastIndexOf('auth');
  if (authIdx === -1 || authIdx >= segments.length - 1) return false;
  return STRICT_AUTH_SEGMENTS.has(segments[authIdx + 1] ?? '');
}

function createRateLimitMiddleware(tier: RateLimitTier, mode: IdentifierMode): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    // Skip rate limiting in local development to avoid DX friction.
    if (process.env.NODE_ENV !== 'production') {
      await next();
      return;
    }

    const limiter = getLimiter(tier);
    if (!limiter) {
      await next();
      return;
    }

    const identifier = getIdentifier(c, mode);
    const result = await limiter.limit(identifier);

    c.header('X-RateLimit-Limit', String(result.limit));
    c.header('X-RateLimit-Remaining', String(result.remaining));
    c.header('X-RateLimit-Reset', String(result.reset));

    if (!result.success) {
      const retryAfterMs = result.reset - Date.now();
      const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
      c.header('Retry-After', String(retryAfterSec));
      return c.json({ error: 'Too many requests' }, 429);
    }

    await next();
  };
}

export function rateLimitFermentation(): MiddlewareHandler {
  return createRateLimitMiddleware('fermentation', 'user_or_ip');
}

// Dispatches between strict (IP-based, 20/min — brute-force-prone endpoints)
// and lenient (per-token, 120/min — post-auth endpoints like /me, /refresh,
// /change-*) based on the request path. Registered once at /api/v1/auth/* so
// requests are not double-counted.
export function rateLimitAuth(): MiddlewareHandler {
  const strict = createRateLimitMiddleware('auth_strict', 'ip');
  const lenient = createRateLimitMiddleware('auth_lenient', 'token_or_ip');
  return async (c, next) => {
    if (isStrictAuthPath(c.req.path)) {
      return strict(c, next);
    }
    return lenient(c, next);
  };
}

export function rateLimitGeneral(): MiddlewareHandler {
  return createRateLimitMiddleware('general', 'user_or_ip');
}
