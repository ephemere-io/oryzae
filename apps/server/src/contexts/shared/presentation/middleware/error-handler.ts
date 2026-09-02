import type { Context } from 'hono';
import { ZodError } from 'zod';
import { ApplicationError } from '../../application/errors/application.errors.js';

export function errorHandler(err: Error, c: Context) {
  if (err instanceof ApplicationError) {
    return c.json({ error: err.message }, err.statusCode as 400);
  }

  // ルートは schema.parse() で入力を検証している。ZodError を拾っていなかったため、
  // 入力が形に合っていないだけの要求が全部 500 になり、Sentry にも未処理例外として
  // 上がっていた。呼び出し側からは「サーバーが壊れた」としか見えず、どのフィールドが
  // 悪いのかも返っていなかった。入力の誤りは 400 で、場所を添えて返す。
  if (err instanceof ZodError) {
    const where = err.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join(', ');
    return c.json({ error: `Invalid request: ${where}` }, 400);
  }

  const mod = '@sentry/nextjs';
  import(/* webpackIgnore: true */ mod)
    .then((Sentry: { captureException: (err: Error, ctx: Record<string, unknown>) => void }) => {
      Sentry.captureException(err, {
        extra: { method: c.req.method, path: c.req.path },
      });
    })
    .catch(() => {});

  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
}
