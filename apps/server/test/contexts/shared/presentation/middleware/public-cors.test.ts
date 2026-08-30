import { Hono } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';
import {
  publicCors,
  resolveAllowedOrigins,
} from '@/contexts/shared/presentation/middleware/public-cors.js';

const DOCS_ORIGIN = 'https://docs.oryzae.ephemere.io';

function appWithCors() {
  return new Hono()
    .use('/availability', publicCors())
    .get('/availability', (c) =>
      c.json({ limit: 100, used: 3, remaining: 97, capacityReached: false }),
    );
}

afterEach(() => {
  delete process.env.PUBLIC_SITE_ORIGINS;
});

describe('resolveAllowedOrigins', () => {
  it('未設定なら本番の公開サイトだけを許可する', () => {
    expect(resolveAllowedOrigins()).toEqual([DOCS_ORIGIN]);
  });

  it('PUBLIC_SITE_ORIGINS をカンマ区切りで読み、前後の空白を落とす', () => {
    process.env.PUBLIC_SITE_ORIGINS = 'https://a.example , https://b.example';
    expect(resolveAllowedOrigins()).toEqual(['https://a.example', 'https://b.example']);
  });

  it('空文字や区切りだけの値では既定にフォールバックする', () => {
    process.env.PUBLIC_SITE_ORIGINS = ' , ';
    expect(resolveAllowedOrigins()).toEqual([DOCS_ORIGIN]);
  });
});

describe('publicCors', () => {
  it('公開サイトのオリジンを反射する', async () => {
    const res = await appWithCors().request('/availability', {
      headers: { Origin: DOCS_ORIGIN },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(DOCS_ORIGIN);
  });

  it('未知のオリジンには Allow-Origin を返さない', async () => {
    // ここが緩むと、認証済み API への横展開を待たずに任意のサイトが
    // このエンドポイントを読めるようになる。
    const res = await appWithCors().request('/availability', {
      headers: { Origin: 'https://evil.example' },
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('プリフライト(OPTIONS)に GET を許可して応答する', async () => {
    const res = await appWithCors().request('/availability', {
      method: 'OPTIONS',
      headers: {
        Origin: DOCS_ORIGIN,
        'Access-Control-Request-Method': 'GET',
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(DOCS_ORIGIN);
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
  });

  it('Origin ヘッダが無い同一オリジン呼び出しは素通しする', async () => {
    const res = await appWithCors().request('/availability');
    expect(res.status).toBe(200);
  });
});
