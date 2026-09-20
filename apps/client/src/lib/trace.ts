'use client';

/**
 * 画面が切り替わるまでの時間を、**実機で測って持ち帰る**ための小さな記録。
 *
 * 手元の開発機と実機は、回線も GPU も読み込みの速さも違う。「まだブツ切れ」という報告に
 * 対して、こちらで録画を撮って「白は 0 コマでした」と答えても噛み合わない — 見えている
 * ものが違うのだから、**その端末で測った数字**が要る。
 *
 * - `startTrace()` で記録を始める（`/verify/handover` のボタン）
 * - 流れの各所が `traceMark()` を呼ぶ。止まっているときは**何もしない**（本番でも無害）
 * - コマ落ち（長いフレーム）は自動で拾う。「読み込みで待っている」のか「描画が詰まって
 *   いる」のかは、これが分かれ目になる
 * - 置き場は `sessionStorage`。画面の移動もフルページ遷移もまたぐ
 */

const KEY = 'oryzae_trace';

/** 記録を続ける上限（ms）。入室の前後だけを見たいので長く取らない。 */
const MAX_MS = 20_000;

/** これより長いフレームを「詰まった」として拾う（ms）。60fps なら 16.7ms が普通。 */
const JANK_MS = 40;

interface TraceMark {
  name: string;
  /** 記録開始からの経過（ms）。 */
  at: number;
}

interface TraceJank {
  at: number;
  gapMs: number;
}

export interface TraceRecord {
  startedAt: number;
  device: string;
  marks: TraceMark[];
  janks: TraceJank[];
}

let watching = false;

/** 記録を始める（それまでの記録は捨てる）。 */
export function startTrace(): void {
  write({
    startedAt: Date.now(),
    device: describeDevice(),
    marks: [],
    janks: [],
  });
  watch();
}

/** 記録をやめて消す。 */
export function clearTrace(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // 消せなくても、次に始めるときに上書きされる。
  }
}

/**
 * 流れの一点を記録する。**止まっているときは即座に返る。**
 *
 * 呼ぶ側は「記録中かどうか」を気にしなくてよい。
 */
export function traceMark(name: string): void {
  const record = read();
  if (record === null) return;
  const at = Date.now() - record.startedAt;
  if (at > MAX_MS) return;
  record.marks.push({ name, at });
  write(record);
  watch();
}

/** 記録を読む。 */
export function readTrace(): TraceRecord | null {
  return read();
}

/**
 * コマ落ちを拾う。
 *
 * 記録中だけ回す。止まるのは上限を過ぎたときか、記録が消えたとき。
 */
function watch(): void {
  if (watching || typeof window === 'undefined') return;
  watching = true;
  let previous = performance.now();
  const step = () => {
    const now = performance.now();
    const gap = now - previous;
    previous = now;
    const record = read();
    if (record === null) {
      watching = false;
      return;
    }
    const at = Date.now() - record.startedAt;
    if (at > MAX_MS) {
      watching = false;
      return;
    }
    if (gap >= JANK_MS) {
      record.janks.push({ at: Math.round(at), gapMs: Math.round(gap) });
      write(record);
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function describeDevice(): string {
  const { innerWidth, innerHeight, devicePixelRatio, navigator } = window;
  return `${innerWidth}x${innerHeight} @${devicePixelRatio} / ${navigator.userAgent}`;
}

function read(): TraceRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isTraceRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function write(record: TraceRecord): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    // 置けない環境（プライベートウィンドウ）。測れないだけで何も壊さない。
  }
}

/** 前の版の自分が書いたものが入っていることがあるので、形を確かめてから使う。 */
function isTraceRecord(value: unknown): value is TraceRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record: Record<string, unknown> = { ...value };
  return (
    typeof record.startedAt === 'number' &&
    typeof record.device === 'string' &&
    Array.isArray(record.marks) &&
    Array.isArray(record.janks)
  );
}
