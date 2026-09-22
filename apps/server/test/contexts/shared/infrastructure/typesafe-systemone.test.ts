import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  parseSystemOneAnswer,
  routeHelpTopic,
} from '@/contexts/shared/infrastructure/typesafe-systemone.js';

const IDS = new Set(['write', 'jar', 'board']);

const INPUT = {
  query: '去年書いたものを読み返したい',
  screen: '/',
  locale: 'ja' as const,
  topics: [
    { id: 'write', label: '書く — 手帳を開いて書く' },
    { id: 'jar', label: '瓶 — 漬けたエントリーが発酵する' },
    { id: 'board', label: 'ボード — スニペットと写真を貼る' },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('parseSystemOneAnswer', () => {
  it('choice と confidence を読む', () => {
    const parsed = parseSystemOneAnswer(
      { answers: { topic: { choice: 'jar', confidence: 0.82 } } },
      IDS,
    );
    expect(parsed).toEqual({ topicId: 'jar', confidence: 0.82 });
  });

  it('confidence が無ければ probabilities の選ばれた値で代える', () => {
    const parsed = parseSystemOneAnswer(
      {
        answers: {
          topic: { choice: 'write', probabilities: { write: 0.6, jar: 0.3, board: 0.1 } },
        },
      },
      IDS,
    );
    expect(parsed).toEqual({ topicId: 'write', confidence: 0.6 });
  });

  it('選択肢に無い id は採らない（モデルが勝手に話題を作れない）', () => {
    const parsed = parseSystemOneAnswer(
      { answers: { topic: { choice: 'billing', confidence: 0.99 } } },
      IDS,
    );
    expect(parsed).toEqual({ topicId: null, confidence: 0 });
  });

  it('形が違えば答え無し（例外にしない）', () => {
    expect(parseSystemOneAnswer(null, IDS)).toEqual({ topicId: null, confidence: 0 });
    expect(parseSystemOneAnswer({ answers: [] }, IDS)).toEqual({ topicId: null, confidence: 0 });
    expect(parseSystemOneAnswer({ answers: { topic: 'jar' } }, IDS)).toEqual({
      topicId: null,
      confidence: 0,
    });
  });

  it('confidence は 0〜1 に収める', () => {
    expect(
      parseSystemOneAnswer({ answers: { topic: { choice: 'jar', confidence: 3 } } }, IDS)
        .confidence,
    ).toBe(1);
    expect(
      parseSystemOneAnswer({ answers: { topic: { choice: 'jar', confidence: -1 } } }, IDS)
        .confidence,
    ).toBe(0);
  });
});

describe('routeHelpTopic', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('鍵が無ければ何もしない（configured: false）。fetch も呼ばない', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', '');
    const result = await routeHelpTopic(INPUT);
    expect(result).toEqual({ configured: false, topicId: null, confidence: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('鍵があれば systemone に choice の問いを 1 つ投げ、選ばれた話題を返す', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', 'ts-test-key');
    fetchMock.mockResolvedValue(
      jsonResponse({ answers: { topic: { choice: 'jar', confidence: 0.77 } } }),
    );

    const result = await routeHelpTopic(INPUT);

    expect(result).toEqual({ configured: true, topicId: 'jar', confidence: 0.77 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.typesafe.ai/v1/systemone');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer ts-test-key');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('jev-latest');
    expect(body.state).toEqual({ user_request: INPUT.query, screen: '/', language: 'ja' });
    expect(body.questions.topic.type).toBe('choice');
    expect(Object.keys(body.questions.topic.options)).toEqual(['write', 'jar', 'board']);
  });

  it('非 OK の返事は答え無し。問いの本文をログに載せない', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', 'ts-test-key');
    fetchMock.mockResolvedValue(jsonResponse({ error: 'nope' }, 500));

    const result = await routeHelpTopic(INPUT);

    expect(result).toEqual({ configured: true, topicId: null, confidence: 0 });
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).not.toContain(INPUT.query);
  });

  it('ネットワークの失敗も投げない', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', 'ts-test-key');
    fetchMock.mockRejectedValue(new Error('boom'));

    await expect(routeHelpTopic(INPUT)).resolves.toEqual({
      configured: true,
      topicId: null,
      confidence: 0,
    });
  });
});
