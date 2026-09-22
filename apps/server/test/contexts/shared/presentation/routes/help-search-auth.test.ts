import { describe, expect, it, vi } from 'vitest';

// ゲートウェイは本物を読み込まない（鍵の有無や fetch に依らず、認可の境界だけを見る）。
vi.mock('@/contexts/shared/infrastructure/typesafe-systemone.js', () => ({
  routeHelpTopic: vi.fn(),
}));

import app from '@/app.js';

/**
 * `POST /api/v1/help/search` が認証の内側（`/api/v1/*` の authMiddleware）に居続けることの
 * 回帰テスト。ルート単体のテスト（help-search.test.ts）は自分で Hono を組むので、app.ts の
 * 登録順が変わって認証の外に出ても気づけない。誰でも叩ける口になると、他人の鍵で Jev を
 * 回せる（有料の外部 API）。
 *
 * Authorization ヘッダが無ければ authMiddleware は Supabase に触らず 401 を返すので、
 * 環境変数も外部接続も要らない。
 */
describe('app: POST /api/v1/help/search の認可境界', () => {
  const VALID = {
    query: '手紙はいつ届く？',
    screen: '/jar',
    locale: 'ja',
    topics: [
      { id: 'letter', label: '手紙' },
      { id: 'pickle', label: '漬け込む' },
    ],
  };

  it('Authorization ヘッダが無ければ 401（本文が正しくても）', async () => {
    const res = await app.request('/api/v1/help/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID),
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Missing or invalid Authorization header' });
  });

  it('Bearer でない Authorization も 401', async () => {
    const res = await app.request('/api/v1/help/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Basic abc' },
      body: JSON.stringify(VALID),
    });

    expect(res.status).toBe(401);
  });
});
