import { type ZodType, z } from 'zod';

/**
 * プレーンなオブジェクトか。配列と null は弾く。
 *
 * スキーマを書くほどでもない `unknown` の値を、キャスト無しでフィールド参照
 * できるようにするための型ガード。
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Response の JSON を Zod スキーマで検証して取り出す。
 *
 * `(await res.json()) as T` は「そう書いただけ」で、API の形が変わっても気づけない。
 * ここを通すと、形が違えば `null` が返るので、呼び出し側でエラー表示へ倒せる。
 */
export async function parseJson<T>(res: Response, schema: ZodType<T>): Promise<T | null> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return null;
  }
  const parsed = schema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

const errorBodySchema = z.object({ error: z.string().optional() });

/**
 * 失敗レスポンスの body からサーバーのエラー文言を取り出す。
 * body が JSON でない・error を持たない場合は fallback をそのまま返す。
 */
export async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = await parseJson(res, errorBodySchema);
  return body?.error && body.error.length > 0 ? body.error : fallback;
}
