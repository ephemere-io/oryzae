import type { MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';

/**
 * 公開サイト（別リポジトリ ephemere-io/oryzae-docs、docs.oryzae.ephemere.io）からの
 * クロスオリジン呼び出しを許可する CORS ミドルウェア。
 *
 * 公開サイトを別ドメインに分離したことで、LP の登録枠バッジが
 * `GET /api/v1/auth/signup/availability` を別オリジンから叩くようになった。
 * このエンドポイントは認証不要・読み取り専用で、返すのは登録枠の残数のみ。
 *
 * **このミドルウェアは公開エンドポイントにだけ付ける。** `/api/v1/*` 全体に広げると、
 * 認証済みの API まで別オリジンから叩けるようになる。
 *
 * 許可オリジンは `PUBLIC_SITE_ORIGINS`（カンマ区切り）で差し替えられる。Vercel の
 * プレビューデプロイなど、本番以外の公開サイトから叩きたいときに使う。
 */
const DEFAULT_ALLOWED_ORIGINS = ['https://docs.oryzae.ephemere.io'];

/** `PUBLIC_SITE_ORIGINS` を読み、未設定なら本番の公開サイトだけを許可する。 */
export function resolveAllowedOrigins(): string[] {
  const raw = process.env.PUBLIC_SITE_ORIGINS;
  if (!raw) return DEFAULT_ALLOWED_ORIGINS;
  const parsed = raw
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  return parsed.length > 0 ? parsed : DEFAULT_ALLOWED_ORIGINS;
}

/**
 * 許可リストに載っているオリジンだけをそのまま反射する。
 * 未知のオリジンには `Access-Control-Allow-Origin` を返さない（= ブラウザが遮断する）。
 */
export function publicCors(): MiddlewareHandler {
  return cors({
    origin: (origin) => (resolveAllowedOrigins().includes(origin) ? origin : null),
    allowMethods: ['GET', 'OPTIONS'],
    maxAge: 86_400,
  });
}
