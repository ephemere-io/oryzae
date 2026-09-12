import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BulkEmailMessage } from '@/contexts/newsletter/domain/gateways/bulk-email-sender.gateway.js';
import { ResendBulkEmailSender } from '@/contexts/newsletter/infrastructure/email/resend-bulk-email-sender.js';

function messages(count: number): BulkEmailMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    to: `user${i}@example.com`,
    subject: '今月の更新',
    html: '<p>本文</p>',
    text: '本文',
  }));
}

const okResponse = () =>
  // @type-assertion-allowed: テスト用の最小限 Response スタブ（実装が読むのは ok / status / text だけ）
  ({ ok: true, status: 200, text: () => Promise.resolve('{}') }) as unknown as Response;

const errorResponse = (status: number, body = 'rate limited') =>
  // @type-assertion-allowed: テスト用の最小限 Response スタブ（実装が読むのは ok / status / text だけ）
  ({ ok: false, status, text: () => Promise.resolve(body) }) as unknown as Response;

describe('ResendBulkEmailSender', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.useFakeTimers();
    process.env.RESEND_API_KEY = 'test-key';
    process.env.EMAIL_ENABLED = 'true';
    process.env.EMAIL_FROM = 'Oryzae <noreply@mail.oryzae.ephemere.io>';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  /** バッチ間 sleep を飛ばすため、fake timer を進めながら待つ。 */
  async function run(sender: ResendBulkEmailSender, msgs: BulkEmailMessage[]) {
    const promise = sender.sendBulk(msgs);
    await vi.runAllTimersAsync();
    return promise;
  }

  it('EMAIL_ENABLED=false なら送らず reason を返す', async () => {
    process.env.EMAIL_ENABLED = 'false';
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await run(new ResendBulkEmailSender(), messages(1));

    expect(result).toEqual({ sent: false, reason: 'disabled' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('API キーが無ければ送らず warn を出す（本番の設定漏れを気づけるように）', async () => {
    process.env.RESEND_API_KEY = '';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await run(new ResendBulkEmailSender(), messages(1));

    expect(result).toEqual({ sent: false, reason: 'no-api-key' });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('100 通ごとにバッチを分ける（Resend の batch 上限）', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse());

    const result = await run(new ResendBulkEmailSender(), messages(250));

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ sent: true, delivered: 250, failures: [] });

    const bodies = fetchSpy.mock.calls.map((call) => JSON.parse(String(call[1]?.body ?? '[]')));
    expect(bodies.map((b) => b.length)).toEqual([100, 100, 50]);
  });

  it('宛先は 1 通 1 アドレス（BCC でまとめない — 受信者同士にアドレスが見える）', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse());

    await run(new ResendBulkEmailSender(), messages(3));

    const payload = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body ?? '[]'));
    expect(payload).toHaveLength(3);
    for (const entry of payload) {
      expect(entry.to).toHaveLength(1);
      expect(entry.bcc).toBeUndefined();
      expect(entry.cc).toBeUndefined();
    }
    expect(payload.map((e: { to: string[] }) => e.to[0])).toEqual([
      'user0@example.com',
      'user1@example.com',
      'user2@example.com',
    ]);
  });

  it('バッチが 1 つ落ちても残りは送る（先に届いたぶんを再送で二重にしない）', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(errorResponse(429))
      .mockResolvedValueOnce(okResponse());

    const result = await run(new ResendBulkEmailSender(), messages(150));

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.sent).toBe(true);
    if (!result.sent) return;
    expect(result.delivered).toBe(50);
    expect(result.failures).toHaveLength(100);
    expect(result.failures[0].error).toContain('429');
  });

  it('ネットワーク例外もバッチ単位の失敗として扱い、throw しない', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNRESET'));

    const result = await run(new ResendBulkEmailSender(), messages(2));

    expect(result.sent).toBe(true);
    if (!result.sent) return;
    expect(result.delivered).toBe(0);
    expect(result.failures.map((f) => f.error)).toEqual(['ECONNRESET', 'ECONNRESET']);
  });

  it('EMAIL_FROM をそのまま差出人に使う', async () => {
    process.env.EMAIL_FROM = 'Oryzae <hello@mail.oryzae.ephemere.io>';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse());

    await run(new ResendBulkEmailSender(), messages(1));

    const payload = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body ?? '[]'));
    expect(payload[0].from).toBe('Oryzae <hello@mail.oryzae.ephemere.io>');
    expect(fetchSpy.mock.calls[0][0]).toBe('https://api.resend.com/emails/batch');
  });
});
