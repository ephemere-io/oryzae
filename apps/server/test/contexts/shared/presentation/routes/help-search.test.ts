import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeHelpTopicMock = vi.fn();
vi.mock('@/contexts/shared/infrastructure/typesafe-systemone.js', () => ({
  routeHelpTopic: (input: unknown) => routeHelpTopicMock(input),
}));

import { errorHandler } from '@/contexts/shared/presentation/middleware/error-handler.js';
import { helpSearch } from '@/contexts/shared/presentation/routes/help-search.js';

function buildApp() {
  return new Hono().onError(errorHandler).route('/api/v1/help/search', helpSearch);
}

const VALID = {
  query: '手紙はいつ届く？',
  screen: '/jar',
  locale: 'ja',
  topics: [
    { id: 'letter', label: '手紙' },
    { id: 'pickle', label: '漬け込む' },
  ],
};

describe('POST /api/v1/help/search', () => {
  beforeEach(() => {
    routeHelpTopicMock.mockReset();
  });

  it('検証済みの入力をゲートウェイへ渡し、返事をそのまま返す', async () => {
    routeHelpTopicMock.mockResolvedValue({ configured: true, topicId: 'letter', confidence: 0.9 });

    const res = await buildApp().request('/api/v1/help/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ configured: true, topicId: 'letter', confidence: 0.9 });
    expect(routeHelpTopicMock).toHaveBeenCalledWith(VALID);
  });

  it('空の問いは 400（ゲートウェイを呼ばない）', async () => {
    const res = await buildApp().request('/api/v1/help/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID, query: '   ' }),
    });

    expect(res.status).toBe(400);
    expect(routeHelpTopicMock).not.toHaveBeenCalled();
  });

  it('選択肢が 1 つしか無ければ 400（選ぶものが無い）', async () => {
    const res = await buildApp().request('/api/v1/help/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID, topics: VALID.topics.slice(0, 1) }),
    });

    expect(res.status).toBe(400);
  });
});
