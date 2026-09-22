import { helpSearchSchema } from '@oryzae/shared';
import { Hono } from 'hono';
import { routeHelpTopic } from '../../infrastructure/typesafe-systemone.js';

/**
 * `POST /api/v1/help/search` — ヘルプの検索欄に書かれた「したいこと」を話題へ振り分ける。
 *
 * 認証の内側（`/api/v1/*`）に置く。誰でも叩ける口にすると、他人の鍵で Jev を回せる。
 * 状態は持たない（DB に触らない）ので、shared の presentation に置く。
 */
export const helpSearch = new Hono().post('/', async (c) => {
  const input = helpSearchSchema.parse(await c.req.json());
  return c.json(await routeHelpTopic(input));
});
