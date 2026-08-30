/**
 * 盤面の操作 UI の「重さ」を役割ごとに決める。
 *
 * ボードには意味の違う3つの記号がある:
 *
 *   行為（何を作るか）   … ✎ スニペット / 🖼 画像     → **浮かせる**
 *   状態（どの粒度で見るか）… Daily / Weekly            → 平らなトラック
 *   情報（今どこにいるか） … ‹ 2026.08.22 土曜日 ›     → 文字だけ
 *
 * 一度これを全部おなじ「浮いた面」に揃えたことがあるが、意味の差が消えて
 * 気持ち悪くなった。**一貫性は同一ではない**。共有するのは語彙（字の大きさ・
 * 角丸の家系・色トークン・hover の反応）で、重さは役割に従って変える。
 *
 * 「浮いているのは道具だけ」という約束が、見た目そのもので意味を運ぶ。
 * だから ELEVATED_* を道具以外に使わないこと。
 */

/* ---------- 共有の語彙（3つとも同じ） ---------- */

/** 操作 UI の文字。小さく・大文字・わずかな字間。 */
export const CONTROL_TEXT = 'text-[11px] font-medium uppercase tracking-[0.08em]';

/** 押せる物の hover。背景はインライン style で指定しないこと（:hover に勝ってしまう）。 */
export const IDLE_HOVER_CLASS = 'hover:bg-[var(--toolbar-hover)]';

export const CONTROL_FONT = { fontFamily: 'Inter, "Noto Sans JP", sans-serif' } as const;

/* ---------- 行為: 浮いた面（道具箱だけ） ---------- */

export const ELEVATED_PANEL_CLASS =
  'fixed z-[1600] flex items-center gap-1 rounded-[13px] border p-1.5 ' +
  'shadow-[0_8px_24px_-6px_rgba(0,0,0,0.22),0_2px_6px_-2px_rgba(0,0,0,0.12)]';

export const ELEVATED_PANEL_STYLE = {
  ...CONTROL_FONT,
  backgroundColor: 'var(--surface-raised)',
  borderColor: 'var(--surface-raised-border)',
} as const;

/** 浮いた面に載る道具。ここだけ 36px と大きく、主役として扱う。 */
export const TOOL_BUTTON_CLASS =
  'flex h-9 w-9 items-center justify-center rounded-lg transition-colors';

/* ---------- 状態: 平らなトラック（表示単位の切り替え） ---------- */

/**
 * 盤面に沈んだ溝。影も枠線も持たせない。道具箱より一段小さい（32px）のは、
 * 主役ではないことを寸法でも言うため。
 */
export const FLAT_TRACK_CLASS = 'fixed z-[1600] flex items-center gap-0.5 rounded-lg p-0.5';

export const FLAT_TRACK_STYLE = {
  ...CONTROL_FONT,
  backgroundColor: 'var(--track)',
} as const;

/** トラックの中のセグメント。 */
export const SEGMENT_CLASS = `flex h-7 items-center rounded-md px-3 transition-colors ${CONTROL_TEXT}`;

/* ---------- 情報: 文字だけ（日付ナビ） ---------- */

/** 面を持たない。盤面に直接置かれた文字として読ませる。 */
export const PLAIN_ROW_CLASS = 'fixed z-[1600] flex items-center gap-1';

/** 前後に送る矢印。押せるが、道具ではないので背景を持たない。 */
export const GHOST_BUTTON_CLASS =
  'flex h-7 w-7 items-center justify-center rounded-md text-base transition-colors';
