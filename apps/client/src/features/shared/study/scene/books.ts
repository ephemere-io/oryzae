/**
 * 手帳の寸法と、月ごとの冊をどこに置くか（`docs/oryzae-study/21-3d-parameters.md`）。
 *
 * 純関数のみ。three.js にも React にも依存しない。
 */

import { RENDER_LIMITS } from '../constants';
import type { Notebook } from '../types';

/** 厚みの計算に使う件数の上限。これ以上書いても厚みは増えない。 */
const THICKNESS_ENTRY_CAP = 40;

/** 1 件あたりの厚み。 */
const THICKNESS_PER_ENTRY = 0.012;

/** 表紙だけの最小の厚み。 */
const THICKNESS_BASE = 0.1;

/** 手帳 1 冊の厚み。件数で可変にすることで「書いた量」が物の大きさになる。 */
export function notebookThickness(entryCount: number): number {
  const count = Math.max(0, Math.min(THICKNESS_ENTRY_CAP, Math.floor(entryCount)));
  return THICKNESS_BASE + count * THICKNESS_PER_ENTRY;
}

/**
 * 小口・天・地に引く罫の本数。
 *
 * 厚みに比例させることで、厚い本ほど紙が多く見える。三方に入れるのは、クオータービューで
 * どの角度からでも紙の断面が見えるようにするため（1 面だけだと横から見たとき箱に戻る）。
 */
export function edgeLineCount(thickness: number): number {
  return clampInt(Math.round(thickness / 0.013), 7, 26);
}

/** 罫の端の不揃い。1 本ごとにこれだけずらすと、断面が機械的な縞に見えない。 */
export const EDGE_LINE_JITTER = 0.014;

/** 罫の濃度は 2 段を交互に。均一だと縞模様になる。 */
export const EDGE_LINE_OPACITIES: readonly [number, number] = [0.21, 0.13];

/** 束は表紙より小さく作る。表紙がわずかに出ることで箱に見えなくなる。 */
export const BLOCK_INSET = 0.09;

/** 積んだ冊の隙間。 */
export const STACK_GAP = 0.012;

/** 表紙の厚み。 */
export const COVER_THICKNESS = 0.05;

/** 表紙の蝶番（背表紙側）の x。 */
export const COVER_HINGE_X = -1.3;

/** 表紙の開き角。π ちょうどにしないのは、完全に平らだと裏返って見えるため。 */
export const COVER_OPEN_ANGLE = Math.PI * 0.995;

/** 当月だけが持つ見開きのページ。 */
export const SPREAD_PAGES = {
  count: 3,
  thickness: 0.007,
  /** i 枚目の開き角。 */
  angleAt: (i: number): number => Math.PI * 0.986 - i * 0.007,
} as const;

/** 手帳の平面の寸法。 */
export const NOTEBOOK_SIZE = { width: 2.6, depth: 3.4 } as const;

/** 表紙のラベル枠。 */
export const COVER_LABEL = { width: 1.1, height: 0.48, opacity: 0.35 } as const;

/** 小口の罫と見開きの罫。 */
export const RULES = {
  foreEdgeCount: 14,
  foreEdgeOpacity: 0.24,
  spreadCount: 9,
  spreadSpacing: 0.28,
  spreadOpacity: 0.18,
} as const;

/** 棚の背文字（CanvasTexture）。 */
export const SPINE_LABEL = {
  textureWidth: 256,
  textureHeight: 48,
  fontPx: 28,
  letterSpacingPx: 4,
  opacity: 0.7,
  /** 背表紙の厚みに対して収める比率。 */
  fitRatio: 0.78,
} as const;

/** `YYYY-MM` を背文字の表記（`2026.06`）にする。 */
export function spineLabelText(month: string): string {
  return month.replace('-', '.');
}

/**
 * 記録が 1 件も無くても、当月の空の手帳を 1 冊だけ机に置く。
 *
 * 机にペンだけが残ると新規執筆の入口が消えるため。API は変えず、ここで補う。
 * `now` は `YYYY-MM-DD`。
 */
export function withCurrentNotebook(notebooks: readonly Notebook[], now: string): Notebook[] {
  const currentMonth = now.slice(0, 7);
  if (notebooks.some((notebook) => notebook.month === currentMonth)) {
    // current フラグは月から決め直す（サーバーが付けてくるとは限らない）。
    return notebooks.map((notebook) => ({
      ...notebook,
      current: notebook.month === currentMonth,
    }));
  }
  return [
    { month: currentMonth, entryCount: 0, current: true },
    ...notebooks.map((notebook) => ({ ...notebook, current: false })),
  ];
}

export interface NotebookPlacement {
  notebook: Notebook;
  thickness: number;
  /** 積みの底からこの冊の下面までの高さ。 */
  baseY: number;
}

export interface NotebookLayoutResult {
  /** 机に積む冊。**先頭が一番上（当月）**。 */
  desk: NotebookPlacement[];
  /** 奥の棚に背表紙で並べる冊。新しい月から。 */
  shelf: Notebook[];
}

/**
 * 月ごとの冊を机と棚に振り分ける。
 *
 * 机は当月を一番上に、直近 2 ヶ月を下に積む。それ以前は棚へ（直 3 ヶ月分）。
 * 3 ヶ月を超えたら棚は詰めて表示する（間隔を縮める。スクロールも省略記号も出さない）。
 */
export function layoutNotebooks(notebooks: readonly Notebook[], now: string): NotebookLayoutResult {
  // 新しい月から並べる。サーバーの順序に依存しない。
  const sorted = [...withCurrentNotebook(notebooks, now)].sort((a, b) =>
    a.month < b.month ? 1 : a.month > b.month ? -1 : 0,
  );

  const deskNotebooks = sorted.slice(0, RENDER_LIMITS.deskNotebooks);
  const shelf = sorted.slice(
    RENDER_LIMITS.deskNotebooks,
    RENDER_LIMITS.deskNotebooks + RENDER_LIMITS.shelfSpines,
  );

  // 積みは下から作る。一番古い冊が底で、当月が天。
  const bottomUp = [...deskNotebooks].reverse();
  let baseY = 0;
  const placed: NotebookPlacement[] = [];
  for (const notebook of bottomUp) {
    const thickness = notebookThickness(notebook.entryCount);
    placed.push({ notebook, thickness, baseY });
    baseY += thickness + STACK_GAP;
  }

  return { desk: placed.reverse(), shelf };
}

/** 積みの一番上の冊の上面（＝手帳へ寄るときの `topY`）。 */
export function stackTopY(desk: readonly NotebookPlacement[]): number {
  if (desk.length === 0) return 0;
  const top = desk[0];
  return top.baseY + top.thickness;
}

/**
 * 棚の背表紙 1 本ごとの x 位置（棚ローカル）。
 *
 * 冊数が上限に満たなければ広く、上限まで並ぶと詰まる。省略記号やスクロールは出さない。
 */
export function shelfSpineOffsets(count: number, shelfWidth = 2.6): number[] {
  if (count <= 0) return [];
  const usable = shelfWidth * 0.82;
  const step = usable / Math.max(count, RENDER_LIMITS.shelfSpines);
  const start = -((count - 1) * step) / 2;
  return Array.from({ length: count }, (_, i) => start + step * i);
}

/**
 * ホバー時のツールチップに出す日付の範囲。
 *
 * その月の記録の最古・最新から作る。記録が無い月は null（件数だけを出す）。
 * `createdAt` は ISO 文字列。
 */
export function monthDateRange(
  createdAts: readonly string[],
  month: string,
): { first: string; last: string } | null {
  const inMonth = createdAts
    .filter((iso) => iso.slice(0, 7) === month)
    .map((iso) => iso.slice(0, 10))
    .sort();
  if (inMonth.length === 0) return null;
  return { first: inMonth[0], last: inMonth[inMonth.length - 1] };
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return Math.round(value);
}
