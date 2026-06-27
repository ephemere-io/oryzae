import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyDiscord } from '@/contexts/shared/infrastructure/discord-notify.js';

function mockRes(ok: boolean, status: number, body = ''): Response {
  // @type-assertion-allowed: テスト用の最小限 Response スタブ
  return { ok, status, text: async () => body } as Response;
}

/**
 * issue #384: 通知の送信失敗を握りつぶさず可観測にする。
 * cron が 200 で完了しても通知が来ない、という症状の真因（webhook の非OK応答など）を
 * Vercel ログで追えるようにする。アプリ自体は止めない（throw しない）。
 */
describe('notifyDiscord (issue #384: 可観測化)', () => {
  const ORIGINAL = process.env.DISCORD_WEBHOOK_URL;

  beforeEach(() => {
    process.env.DISCORD_WEBHOOK_URL = 'https://discord.test/webhook';
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (ORIGINAL === undefined) {
      delete process.env.DISCORD_WEBHOOK_URL;
    } else {
      process.env.DISCORD_WEBHOOK_URL = ORIGINAL;
    }
  });

  it('URL 未設定なら fetch しない（dev での no-op）', async () => {
    delete process.env.DISCORD_WEBHOOK_URL;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await notifyDiscord({ title: 't' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('成功(2xx)時はエラーログを出さない', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockRes(true, 204));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await notifyDiscord({ title: 't' });
    expect(errSpy).not.toHaveBeenCalled();
  });

  it('非OK(4xx)時はステータス・本文付きでログするが throw しない', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockRes(false, 400, 'Invalid embed'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(notifyDiscord({ title: '発酵 cron: 完了' })).resolves.toBeUndefined();

    expect(errSpy).toHaveBeenCalledWith(
      '[notifyDiscord] webhook responded with non-OK status',
      expect.objectContaining({ status: 400, title: '発酵 cron: 完了', body: 'Invalid embed' }),
    );
  });

  it('fetch が例外でも throw せずログする', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(notifyDiscord({ title: 't' })).resolves.toBeUndefined();

    expect(errSpy).toHaveBeenCalledWith(
      '[notifyDiscord] webhook request failed',
      expect.objectContaining({ error: 'network down' }),
    );
  });
});
