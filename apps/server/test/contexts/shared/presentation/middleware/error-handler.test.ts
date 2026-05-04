import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
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
    mockCaptureException.mockClear();
    const app = createApp();
    await app.request('/app-error');

    // ApplicationError は dynamic import を起動しないので、十分な余裕を取って
    // 他テスト由来の遅延した呼び出しが漏れていないことを確認する。
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockCaptureException).not.toHaveBeenCalled();
  });
});
