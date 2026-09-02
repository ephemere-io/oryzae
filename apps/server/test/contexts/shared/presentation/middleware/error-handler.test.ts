import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ValidationError } from '@/contexts/shared/application/errors/application.errors.js';
import { errorHandler } from '@/contexts/shared/presentation/middleware/error-handler.js';

// Mock @sentry/nextjs dynamic import
const mockCaptureException = vi.fn<(err: Error, ctx: Record<string, unknown>) => void>();
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
    })
    .get('/zod', () => {
      z.object({ text: z.string().min(1).max(3) }).parse({ text: 'too long' });
      return new Response('unreachable');
    });
}

/**
 * errorHandler は Sentry を dynamic import して fire-and-forget で呼ぶ。
 * リクエストが返った時点ではまだ呼ばれていないので、/unhandled を叩いたテストは
 * 必ずこれで着弾を待ってから終わること。待たずに終わると、その呼び出しが後続テストの
 * mockClear() の「後」に着弾し、無関係なテストが偽の失敗を起こす。
 *
 * 件数ではなく中身で待つ。件数だと想定外の呼び出しでも待機が解けてしまい、
 * 「待った」ことが何の経過も保証しなくなる。
 */
async function waitForSentryCapture(message: string) {
  await vi.waitFor(() => {
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.objectContaining({ message }),
      expect.anything(),
    );
  });
}

/**
 * 先に開始済みの非同期処理が着弾しきるまでのターン稼ぎ。
 * 判定の根拠は sentinel の着弾そのもので、これはあくまで遅い環境向けの余白。
 */
async function drainEventLoop(turns = 3) {
  for (let i = 0; i < turns; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe('errorHandler', () => {
  // モックは module スコープで共有される。vitest.config.ts に clearMocks が無いので、
  // ここで明示的に落とさないと呼び出しが前のテストから持ち越される。
  beforeEach(() => {
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

    // このテストの関心は status だが、Sentry 呼び出しを在庫として残さない。
    await waitForSentryCapture('Something went wrong');
  });

  it('calls Sentry.captureException for unhandled errors', async () => {
    const app = createApp();
    await app.request('/unhandled');

    await waitForSentryCapture('Something went wrong');
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Something went wrong' }),
      expect.objectContaining({ extra: { method: 'GET', path: '/unhandled' } }),
    );
  });

  it('does not call Sentry for ApplicationError', async () => {
    const app = createApp();
    await app.request('/app-error');

    // 「呼ばれていない」を sleep の長さで示すと、短ければ検出できず、長ければ遅いだけの
    // テストになる。代わりに /unhandled を sentinel として後から投げ、その着弾を待つ。
    //
    // sentinel の import は app-error より「後」に始まって着弾済みなので、その時点で
    // app-error 側の import は往復ぶん以上の猶予を得ている。それでも何も渡って
    // いなければ、app-error では import 自体が始まっていない = Sentry を呼んでいない。
    //
    // 検出力を自分で確かめるには: errorHandler が instanceof に使う ApplicationError を
    // 別クラスに vi.mock で差し替えると、ValidationError が早期 return をすり抜けて
    // 本物のハンドラの Sentry 経路に入る。その状態で下のアサーションが落ちれば良い。
    await app.request('/unhandled');
    await waitForSentryCapture('Something went wrong');
    await drainEventLoop();

    // 件数ではなく中身を見る。件数はこのファイル全体の状態に依存してしまい、
    // 「このテストの /app-error が報告しなかった」ことの証明にならない。
    const reportedErrors = mockCaptureException.mock.calls.map(([err]) => err);
    expect(reportedErrors.filter((err) => err instanceof ValidationError)).toEqual([]);
  });
  it('入力が形に合わないときは 500 ではなく 400 で、どこが悪いかを返す', async () => {
    // ルートは schema.parse() で検証している。ZodError を拾っていなかった頃は
    // 入力ミスが全部 500 になり、Sentry にも未処理例外として上がっていた。
    const app = createApp();
    const res = await app.request('/zod');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('text');
  });
});
