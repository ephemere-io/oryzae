import app from '@oryzae/server';

export const maxDuration = 120;

export async function GET(req: Request) {
  // Vercel Cron sends GET with Authorization: Bearer <CRON_SECRET>
  // Forward as POST to the Hono cron route, preserving the auth header
  const url = new URL('/api/v1/cron/cost-alert', req.url);
  const internalReq = new Request(url.toString(), {
    method: 'POST',
    headers: req.headers,
  });

  return app.fetch(internalReq);
}
