import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { Context, MiddlewareHandler, Next } from 'hono';

type RateLimitTier = 'fermentation' | 'auth' | 'general';

const TIER_CONFIG: Record<RateLimitTier, { requests: number; windowMs: number }> = {
  fermentation: { requests: 5, windowMs: 60_000 },
  auth: { requests: 10, windowMs: 60_000 },
  general: { requests: 60, windowMs: 60_000 },
};

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

function getIdentifier(c: Context, useIp: boolean): string {
  if (useIp) {
    return (
      c.req.header('x-real-ip') ??
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      'unknown'
    );
  }
  // @type-assertion-allowed: Hono context variable is set by authMiddleware before rate-limit runs
  const userId = c.get('userId' as never);
  if (typeof userId === 'string') return userId;
  return c.req.header('x-real-ip') ?? 'unknown';
}

function createRateLimitMiddleware(tier: RateLimitTier, useIp: boolean): MiddlewareHandler {
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

    const identifier = getIdentifier(c, useIp);
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
  return createRateLimitMiddleware('fermentation', false);
}

export function rateLimitAuth(): MiddlewareHandler {
  return createRateLimitMiddleware('auth', true);
}

export function rateLimitGeneral(): MiddlewareHandler {
  return createRateLimitMiddleware('general', false);
}
