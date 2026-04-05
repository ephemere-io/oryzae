import type { AppType } from '@oryzae/server/src/app.js';
import { hc } from 'hono/client';

export function createApiClient(accessToken?: string) {
  return hc<AppType>(process.env.NEXT_PUBLIC_API_URL!, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
}

export type ApiClient = ReturnType<typeof createApiClient>;
