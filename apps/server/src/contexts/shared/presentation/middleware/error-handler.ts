import type { Context } from 'hono';

export function errorHandler(err: Error, c: Context) {
  if (err.name === 'EntryNotFoundError') {
    return c.json({ error: err.message }, 404);
  }

  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
}
