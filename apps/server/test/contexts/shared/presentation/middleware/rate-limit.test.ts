import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
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
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://test.upstash.io');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
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

  describe('rateLimitAuth', () => {
    it('uses IP address as identifier', async () => {
      mockLimit.mockResolvedValue({
        success: true,
        limit: 10,
        remaining: 9,
        reset: Date.now() + 60000,
      });

      const app = new Hono()
        .use('/*', rateLimitAuth())
        .post('/auth/login', (c) => c.json({ ok: true }));

      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'x-real-ip': '5.6.7.8' },
      });
      expect(res.status).toBe(200);
      expect(mockLimit).toHaveBeenCalledWith('5.6.7.8');
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
});
