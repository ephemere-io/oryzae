import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidationError } from '@/contexts/shared/application/errors/application.errors.js';
import { errorHandler } from '@/contexts/shared/presentation/middleware/error-handler.js';

// Mock @sentry/nextjs dynamic import
const mockCaptureException = vi.fn();
vi.mock('@sentry/nextjs', () => ({
  captureException: mockCaptureException,
}));

function createApp() {
  return new Hono()
    .onError(errorHandler)
    .get('/app-error', () => {
      throw new ValidationError('Invalid input');
    })
    .get('/unhandled', () => {
      throw new Error('Something went wrong');
    });
}

describe('errorHandler', () => {
  // errorHandler の Sentry 送信は dynamic import の fire-and-forget なので、
  // リクエストが返った後に着弾する。前のテストの飛び残りが次のスパイに落ちると、
  // 「送っていないはずのテスト」が他人の呼び出しを拾って落ちる（実際に約5回に1回落ちていた）。
  // **落ち着くのを待ってから記録を消す**ことで、各テストが自分の呼び出しだけを見る。
  beforeEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    mockCaptureException.mockClear();
  });

  it('returns appropriate status for ApplicationError', async () => {
    const app = createApp();
    const res = await app.request('/app-error');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'Invalid input' });
  });

  it('returns 500 for unhandled errors', async () => {
    const app = createApp();
    const res = await app.request('/unhandled');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Internal server error' });
  });

  it('calls Sentry.captureException for unhandled errors', async () => {
    const app = createApp();
    await app.request('/unhandled');

    // errorHandler は dynamic import を fire-and-forget で実行するため、
    // 解決を待つ。waitFor のポーリングで決定的にブロックする。
    await vi.waitFor(() => {
      expect(mockCaptureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Something went wrong' }),
        expect.objectContaining({
          extra: { method: 'GET', path: '/unhandled' },
        }),
      );
    });
  });

  it('does not call Sentry for ApplicationError', async () => {
    const app = createApp();
    await app.request('/app-error');

    // ApplicationError は dynamic import を起動しない。仮に起動していたら
    // この待ち時間の中で着弾するので、待ってから「呼ばれていない」を見る。
    // （前のテストの飛び残りは beforeEach で切り離し済み）
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockCaptureException).not.toHaveBeenCalled();
  });
});
