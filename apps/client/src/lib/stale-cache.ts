'use client';

/**
 * 「前回見たもの」を localStorage に置いて、次に開いたとき即座に描くための最小の箱。
 *
 * stale-while-revalidate の器だけを持つ。**取得は止めない** — 出すのはあくまで前回の値で、
 * 裏で取り直した本物が届いたら差し替える。だから古い値が長く残ることはない。
 *
 * ここはドメインを知らない横断インフラなので lib に置く。何をどれだけ憶えるかは
 * 呼び出し側（features）が決める。
 */

/** すべての鍵に付ける接頭辞。ログアウト時にまとめて捨てるために使う。 */
const PREFIX = 'oryzae_cache:';

interface Envelope<T> {
  /** 形が変わったら古い値を無視するための版。 */
  v: number;
  /** 書いた時刻（epoch ms）。 */
  t: number;
  value: T;
}

export interface StaleCacheOptions {
  /** 保存する値の形の版。増やすと古い値は読まれない。 */
  version: number;
  /** これより古い値は使わない。 */
  maxAgeMs: number;
}

function isEnvelope(value: unknown): value is Envelope<unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const record: Record<string, unknown> = { ...value };
  return typeof record.v === 'number' && typeof record.t === 'number' && 'value' in record;
}

/**
 * 憶えてある値を読む。無い・古い・形が違うなら null。
 *
 * `validate` は**呼び出し側が形を確かめる**ための関門。localStorage の中身は
 * 前のバージョンの自分が書いたもので、信用してそのまま描画に流すと、古い形のまま
 * 落ちる（`as` で通すのと同じ危うさになる）。
 */
export function readStaleCache<T>(
  key: string,
  options: StaleCacheOptions,
  validate: (value: unknown) => value is T,
): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isEnvelope(parsed)) return null;
    if (parsed.v !== options.version) return null;
    if (Date.now() - parsed.t > options.maxAgeMs) return null;
    return validate(parsed.value) ? parsed.value : null;
  } catch {
    // private mode・壊れた JSON・容量超過。憶えていないだけなので取得に任せる。
    return null;
  }
}

/** 値を憶える。書けなくても呼び出し側は困らない（次回も取得するだけ）。 */
export function writeStaleCache<T>(key: string, value: T, options: StaleCacheOptions): void {
  if (typeof window === 'undefined') return;
  try {
    const envelope: Envelope<T> = { v: options.version, t: Date.now(), value };
    window.localStorage.setItem(PREFIX + key, JSON.stringify(envelope));
  } catch {
    // 容量超過が典型。憶えられないだけで、画面は取得した値で成立する。
  }
}

/**
 * 憶えてあるものを全部捨てる。
 *
 * **ログアウトで必ず呼ぶこと。** ここには日記から作った内容（記録の冒頭・発酵の言葉・
 * 貼ったカードの形）が入る。共有端末で次に使う人へ持ち越さない。
 */
export function clearAllStaleCaches(): void {
  if (typeof window === 'undefined') return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    for (const key of keys) window.localStorage.removeItem(key);
  } catch {
    // 消せなくても、鍵は利用者ごとに分かれているので他人には見えない。
  }
}
