import type { Context } from 'hono';
import { ApplicationError } from '../../application/errors/application.errors.js';

export function errorHandler(err: Error, c: Context) {
  if (err instanceof ApplicationError) {
    return c.json({ error: err.message }, err.statusCode as 400);
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
