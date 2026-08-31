/**
 * `res.json()` の結果を、形を確かめてから読むための最小ヘルパー。
 *
 * `(await res.json()) as T` は `as` と同じで「そう書いただけ」。想定外の形が来ても
 * そのまま state に流れ込み、描画側で落ちる（#512 / #517 / #519 で繰り返し踏んだ形）。
 *
 * 方針は各ドメインの `normalize.ts`（features/shared 配下）と同じく「**厳しい方に寄せる**」。
 * 形が違えば既定値へ倒し、呼び出し側がエラー表示を選べるようにする。
 */

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** JSON として読めなければ null。呼び出し側で try/catch を書かなくて済むようにする。 */
export async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** 文字列フィールドを読む。無い・型が違うなら null。 */
export function readStringField(value: unknown, key: string): string | null {
  if (!isObject(value)) return null;
  const field = value[key];
  return typeof field === 'string' ? field : null;
}

/**
 * **必須の**数値フィールドを読む。無い・型が違うなら null。
 *
 * 既定値へ倒す `readNumberField` と違い、「そもそも期待した形の応答が来ていない」
 * ことを呼び出し側に伝えるためのもの。エラーエンベロープ `{ error: '...' }` が
 * ゼロ埋めの本物のデータとして描画されるのを防ぐ。
 */
export function readRequiredNumber(value: unknown, key: string): number | null {
  if (!isObject(value)) return null;
  const field = value[key];
  return typeof field === 'number' && !Number.isNaN(field) ? field : null;
}

/** 数値フィールドを読む。無い・型が違うなら fallback。 */
export function readNumberField(value: unknown, key: string, fallback: number): number {
  if (!isObject(value)) return fallback;
  const field = value[key];
  return typeof field === 'number' && !Number.isNaN(field) ? field : fallback;
}

/** 真偽フィールドを読む。無い・型が違うなら fallback。 */
export function readBooleanField(value: unknown, key: string, fallback: boolean): boolean {
  if (!isObject(value)) return fallback;
  const field = value[key];
  return typeof field === 'boolean' ? field : fallback;
}
