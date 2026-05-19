import { createHash } from 'node:crypto';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isStrictAuthPath,
  rateLimitAuth,
  rateLimitFermentation,
  rateLimitGeneral,
} from '@/contexts/shared/presentation/middleware/rate-limit.js';

// Mock @upstash/redis
const mockLimit = vi.fn();
vi.mock('@upstash/ratelimit', () => {
  const RatelimitClass = vi.fn().mockImplementation(() => ({
    limit: mockLimit,
  }));
  // @ts-expect-error — attaching static method to mock constructor
  RatelimitClass.slidingWindow = vi.fn().mockReturnValue('sliding-window-config');
  return { Ratelimit: RatelimitClass };
});

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({})),
}));

describe('rate-limit middleware', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://test.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe('when NODE_ENV is not production', () => {
    it('skips rate limiting entirely', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      mockLimit.mockResolvedValue({
        success: false,
        limit: 10,
        remaining: 0,
        reset: Date.now() + 60000,
      });

      const app = new Hono().use('/*', rateLimitAuth()).get('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test', {
        headers: { 'x-real-ip': '1.2.3.4' },
      });
      expect(res.status).toBe(200);
      expect(mockLimit).not.toHaveBeenCalled();
    });
  });

  describe('when Upstash env vars are not set', () => {
    it('skips rate limiting and passes through', async () => {
      vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
      vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');

      const app = new Hono()
        .use('/*', rateLimitGeneral())
        .get('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test');
      expect(res.status).toBe(200);
      expect(mockLimit).not.toHaveBeenCalled();
    });
  });

  describe('rateLimitGeneral', () => {
    it('returns 200 when under the limit', async () => {
      mockLimit.mockResolvedValue({
        success: true,
        limit: 60,
        remaining: 59,
        reset: Date.now() + 60000,
      });

      const app = new Hono()
        .use('/*', rateLimitGeneral())
        .get('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test', {
        headers: { 'x-real-ip': '1.2.3.4' },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('X-RateLimit-Limit')).toBe('60');
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('59');
    });

    it('returns 429 when over the limit', async () => {
      mockLimit.mockResolvedValue({
        success: false,
        limit: 60,
        remaining: 0,
        reset: Date.now() + 30000,
      });

      const app = new Hono()
        .use('/*', rateLimitGeneral())
        .get('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test', {
        headers: { 'x-real-ip': '1.2.3.4' },
      });
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body).toEqual({ error: 'Too many requests' });
      expect(res.headers.get('Retry-After')).toBeTruthy();
    });
  });

  describe('rateLimitAuth (strict — brute-force-prone paths)', () => {
    it('uses IP address as identifier for /auth/login', async () => {
      mockLimit.mockResolvedValue({
        success: true,
        limit: 20,
        remaining: 19,
        reset: Date.now() + 60000,
      });

      const app = new Hono()
        .use('/*', rateLimitAuth())
        .post('/auth/login', (c) => c.json({ ok: true }));

      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: {
          'x-real-ip': '5.6.7.8',
          // Token must be ignored on strict paths so IP-based brute-force
          // protection cannot be bypassed by rotating tokens.
          Authorization: 'Bearer should-be-ignored',
        },
      });
      expect(res.status).toBe(200);
      expect(mockLimit).toHaveBeenCalledWith('5.6.7.8');
    });

    it('uses IP for /auth/signup and /auth/signup/availability', async () => {
      mockLimit.mockResolvedValue({
        success: true,
        limit: 20,
        remaining: 19,
        reset: Date.now() + 60000,
      });

      const app = new Hono()
        .use('/*', rateLimitAuth())
        .post('/auth/signup', (c) => c.json({ ok: true }))
        .get('/auth/signup/availability', (c) => c.json({ ok: true }));

      await app.request('/auth/signup', {
        method: 'POST',
        headers: { 'x-real-ip': '9.9.9.9' },
      });
      await app.request('/auth/signup/availability?nickname=foo', {
        headers: { 'x-real-ip': '9.9.9.9' },
      });

      expect(mockLimit).toHaveBeenNthCalledWith(1, '9.9.9.9');
      expect(mockLimit).toHaveBeenNthCalledWith(2, '9.9.9.9');
    });

    it('uses IP for /auth/oauth/* paths', async () => {
      mockLimit.mockResolvedValue({
        success: true,
        limit: 20,
        remaining: 19,
        reset: Date.now() + 60000,
      });

      const app = new Hono()
        .use('/*', rateLimitAuth())
        .post('/auth/oauth/google', (c) => c.json({ ok: true }));

      await app.request('/auth/oauth/google', {
        method: 'POST',
        headers: { 'x-real-ip': '1.1.1.1' },
      });
      expect(mockLimit).toHaveBeenCalledWith('1.1.1.1');
    });

    it('works under a /api/v1 mount prefix (production routing)', async () => {
      mockLimit.mockResolvedValue({
        success: true,
        limit: 20,
        remaining: 19,
        reset: Date.now() + 60000,
      });

      const app = new Hono()
        .use('/*', rateLimitAuth())
        .post('/api/v1/auth/login', (c) => c.json({ ok: true }));

      await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'x-real-ip': '3.3.3.3' },
      });
      expect(mockLimit).toHaveBeenCalledWith('3.3.3.3');
    });
  });

  describe('rateLimitAuth (lenient — per-token post-auth paths)', () => {
    it('uses hashed Bearer token as identifier for /auth/me', async () => {
      mockLimit.mockResolvedValue({
        success: true,
        limit: 120,
        remaining: 119,
        reset: Date.now() + 60000,
      });

      const token = 'eyJabc.def.ghi';
      const expectedHash = createHash('sha256').update(token).digest('hex').slice(0, 32);

      const app = new Hono()
        .use('/*', rateLimitAuth())
        .get('/auth/me', (c) => c.json({ ok: true }));

      const res = await app.request('/auth/me', {
        headers: {
          'x-real-ip': '7.7.7.7',
          Authorization: `Bearer ${token}`,
        },
      });
      expect(res.status).toBe(200);
      expect(mockLimit).toHaveBeenCalledWith(`token:${expectedHash}`);
    });

    it('isolates per-token counters so shared-NAT users do not collide', async () => {
      mockLimit.mockResolvedValue({
        success: true,
        limit: 120,
        remaining: 119,
        reset: Date.now() + 60000,
      });

      const app = new Hono()
        .use('/*', rateLimitAuth())
        .post('/auth/refresh', (c) => c.json({ ok: true }));

      // Two users behind the same NAT IP but with distinct tokens must hash
      // to distinct identifiers.
      await app.request('/auth/refresh', {
        method: 'POST',
        headers: { 'x-real-ip': '10.0.0.1', Authorization: 'Bearer user-a-token' },
      });
      await app.request('/auth/refresh', {
        method: 'POST',
        headers: { 'x-real-ip': '10.0.0.1', Authorization: 'Bearer user-b-token' },
      });

      const idA = mockLimit.mock.calls[0]?.[0];
      const idB = mockLimit.mock.calls[1]?.[0];
      expect(idA).not.toEqual(idB);
      expect(idA).toMatch(/^token:/);
      expect(idB).toMatch(/^token:/);
    });

    it('falls back to IP when no Bearer token is present', async () => {
      mockLimit.mockResolvedValue({
        success: true,
        limit: 120,
        remaining: 119,
        reset: Date.now() + 60000,
      });

      const app = new Hono()
        .use('/*', rateLimitAuth())
        .post('/auth/refresh', (c) => c.json({ ok: true }));

      await app.request('/auth/refresh', {
        method: 'POST',
        headers: { 'x-real-ip': '4.4.4.4' },
      });
      expect(mockLimit).toHaveBeenCalledWith('4.4.4.4');
    });

    it('returns 429 with the lenient tier limit in the header', async () => {
      mockLimit.mockResolvedValue({
        success: false,
        limit: 120,
        remaining: 0,
        reset: Date.now() + 30000,
      });

      const app = new Hono()
        .use('/*', rateLimitAuth())
        .get('/auth/me', (c) => c.json({ ok: true }));

      const res = await app.request('/auth/me', {
        headers: { Authorization: 'Bearer t', 'x-real-ip': '1.2.3.4' },
      });
      expect(res.status).toBe(429);
      expect(res.headers.get('X-RateLimit-Limit')).toBe('120');
    });
  });

  describe('rateLimitFermentation', () => {
    it('returns 429 when fermentation limit exceeded', async () => {
      mockLimit.mockResolvedValue({
        success: false,
        limit: 5,
        remaining: 0,
        reset: Date.now() + 60000,
      });

      const app = new Hono()
        .use('/*', rateLimitFermentation())
        .post('/fermentations', (c) => c.json({ ok: true }));

      const res = await app.request('/fermentations', {
        method: 'POST',
        headers: { 'x-real-ip': '1.2.3.4' },
      });
      expect(res.status).toBe(429);
    });
  });

  describe('isStrictAuthPath', () => {
    const strict = [
      '/auth/login',
      '/auth/signup',
      '/auth/signup/availability',
      '/auth/verify-otp',
      '/auth/reset-password',
      '/auth/oauth/google',
      '/auth/oauth/callback',
      '/auth/oauth/finalize',
      '/api/v1/auth/login',
      '/api/v1/auth/signup',
      '/api/v1/auth/oauth/google',
    ];
    const lenient = [
      '/auth/me',
      '/auth/refresh',
      '/auth/change-password',
      '/auth/change-email',
      '/auth/profile',
      '/auth/update-password',
      '/auth/nickname/check',
      '/api/v1/auth/me',
      '/api/v1/auth/refresh',
      '/api/v1/auth/change-password',
    ];

    it.each(strict)('classifies %s as strict', (path) => {
      expect(isStrictAuthPath(path)).toBe(true);
    });

    it.each(lenient)('classifies %s as lenient', (path) => {
      expect(isStrictAuthPath(path)).toBe(false);
    });

    it('returns false when /auth/ segment is absent', () => {
      expect(isStrictAuthPath('/api/v1/users/me')).toBe(false);
      expect(isStrictAuthPath('/')).toBe(false);
    });
  });
});
