import app from '@oryzae/server';

// Vercel Pro + Fluid Compute の上限 (800s)。並列化と併用してタイムアウトを回避する。
export const maxDuration = 800;

export async function GET(req: Request) {
  // Vercel Cron sends GET with Authorization: Bearer <CRON_SECRET>
  // Forward as POST to the Hono cron route, preserving the auth header
  const url = new URL('/api/v1/cron/fermentation', req.url);
  const internalReq = new Request(url.toString(), {
    method: 'POST',
    headers: req.headers,
  });

  return app.fetch(internalReq);
}
