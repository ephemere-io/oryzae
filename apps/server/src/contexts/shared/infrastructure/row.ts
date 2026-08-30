/**
 * Supabase から返る型なし行（`Record<string, unknown>`）を、実行時検証しつつ読むためのヘルパー。
 *
 * `row.id as string` のような型アサーションは「そう書いただけ」で、DB スキーマがずれても
 * 気づけないまま undefined がドメインへ流れ込む。ここを通すことで、ずれた瞬間に
 * どのカラムがどう違ったのかが分かる例外になる。
 *
 * infrastructure 層なので throw してよい（domain は Result、application が throw に変換）。
 */

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function fail(key: string, expected: string, value: unknown): never {
  throw new Error(`Row column "${key}" expected ${expected} but got ${describe(value)}`);
}

/** 任意の値を行オブジェクトとして扱う。配列や null は弾く。 */
export function toRecord(value: unknown, label = 'row'): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Expected ${label} to be an object but got ${describe(value)}`);
  }
  return { ...value };
}

/** 任意の値を行オブジェクトの配列として扱う。 */
export function toRecordArray(value: unknown, label = 'rows'): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new Error(`Expected ${label} to be an array but got ${describe(value)}`);
  }
  return value.map((item, index) => toRecord(item, `${label}[${index}]`));
}

export function readString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== 'string') fail(key, 'string', value);
  return value;
}

export function readNumber(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value !== 'number' || Number.isNaN(value)) fail(key, 'number', value);
  return value;
}

/**
 * 文字列 union のカラム。許可値と実際に突き合わせるので、
 * DB に想定外の値が入っていれば読み出した時点で分かる。
 */
export function readEnum<T extends string>(
  row: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): T {
  const value = row[key];
  for (const candidate of allowed) {
    if (candidate === value) return candidate;
  }
  return fail(key, allowed.join(' | '), value);
}

export function readBoolean(row: Record<string, unknown>, key: string): boolean {
  const value = row[key];
  if (typeof value !== 'boolean') fail(key, 'boolean', value);
  return value;
}

/** NULL 許容カラム。未定義も null に丸める。 */
export function readStringOrNull(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') fail(key, 'string | null', value);
  return value;
}

export function readNumberOrNull(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || Number.isNaN(value)) fail(key, 'number | null', value);
  return value;
}

/** 未設定なら undefined を返す（省略可能なカラム）。 */
export function readOptionalString(row: Record<string, unknown>, key: string): string | undefined {
  const value = row[key];
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string') fail(key, 'string | undefined', value);
  return value;
}

export function readOptionalNumber(row: Record<string, unknown>, key: string): number | undefined {
  const value = row[key];
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'number' || Number.isNaN(value)) fail(key, 'number | undefined', value);
  return value;
}

/** NULL を既定値に丸めて読む（`(row.x as boolean) ?? false` の置き換え）。 */
export function readBooleanOr(
  row: Record<string, unknown>,
  key: string,
  fallback: boolean,
): boolean {
  const value = row[key];
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'boolean') fail(key, 'boolean', value);
  return value;
}

export function readStringArray(row: Record<string, unknown>, key: string): string[] {
  const value = row[key];
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) fail(key, 'string[]', value);
  return value.map((item) => {
    if (typeof item !== 'string') fail(key, 'string[]', value);
    return item;
  });
}

/** JSONB カラム。NULL なら空オブジェクト。 */
export function readRecord(row: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = row[key];
  if (value === null || value === undefined) return {};
  if (typeof value !== 'object' || Array.isArray(value)) fail(key, 'object', value);
  return { ...value };
}
