import type { Context } from 'hono';
import { ApplicationError } from '../../application/errors/application.errors';

export function errorHandler(err: Error, c: Context) {
  if (err instanceof ApplicationError) {
    return c.json({ error: err.message }, err.statusCode as 400);
  }

  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
}
