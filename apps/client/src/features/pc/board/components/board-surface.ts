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

import {
  HOVER_CLASS,
  CONTROL_FONT as SHARED_CONTROL_FONT,
  ELEVATED_PANEL_STYLE as SHARED_ELEVATED_PANEL_STYLE,
} from '@/components/ui/surface';

/* ---------- 共有の語彙（3つとも同じ） ---------- */

/**
 * 盤面の操作 UI を画面の縁からどれだけ離すか。
 *
 * ボードだけフルブリードなので、他画面のような中央カラムの余白が効かない。
 * 代わりに縦の律動を合わせる: entries が `pt-10`(40px)、account が `py-12`(48px)、
 * questions が `pt-6`(24px) で、横は3画面とも `px-6`(24px) の中央カラム。
 * 上下左右をこの 40px に揃え、四辺で同じ間合いにする
 * （以前は上と左右が 30px、下のツールバーだけ 24px でばらついていた）。
 */
export const BOARD_INSET = 40;

/** 操作 UI の文字。小さく・大文字・わずかな字間。 */
export const CONTROL_TEXT = 'text-[11px] font-medium uppercase tracking-[0.08em]';

/**
 * 押せる物の hover。**アプリ全体で1つ**（`components/ui/surface` の HOVER_CLASS）。
 *
 * 以前はここだけ `--toolbar-hover` という別のトークンを見ていた。値は 1% しか違わないのに、
 * 同じ「押せる」の手応えに2つの名前があった。背景はインライン style で指定しないこと
 * （:hover に勝ってしまう）。
 */
export const IDLE_HOVER_CLASS = HOVER_CLASS;

/** 操作 UI の書体。本文の明朝と混ぜない。 */
export const CONTROL_FONT = SHARED_CONTROL_FONT;

/* ---------- 上段のバー（日付と表示単位を1行に収める） ---------- */

/**
 * 盤面の上段。左端に日付ナビ、右端に Daily/Weekly を置く1本のバー。
 *
 * 別々に置いて座標を持たせるのではなく、1本のバーの両端に寄せる。こうすると
 * 上下の位置が必ず揃い、片方だけ余白がずれることが起きない
 * （元は 2 つが別々に fixed で、上と左右で 30px / 下のツールバーだけ 24px とばらついていた）。
 */
export const TOP_BAR_CLASS = 'fixed z-[1600] flex items-center justify-between gap-4';

/* ---------- 行為: 浮いた面（道具箱だけ） ---------- */

export const ELEVATED_PANEL_CLASS =
  'fixed z-[1600] flex items-center gap-1 rounded-[13px] border p-1.5 ' +
  'shadow-[0_8px_24px_-6px_rgba(0,0,0,0.22),0_2px_6px_-2px_rgba(0,0,0,0.12)]';

/** 面の地と枠は共通のものを使い、盤面はそこに書体を足すだけにする。 */
export const ELEVATED_PANEL_STYLE = {
  ...CONTROL_FONT,
  ...SHARED_ELEVATED_PANEL_STYLE,
} as const;

/** 浮いた面に載る道具。ここだけ 36px と大きく、主役として扱う。 */
export const TOOL_BUTTON_CLASS =
  'flex h-9 w-9 items-center justify-center rounded-lg transition-colors';

/* ---------- 状態: 平らなトラック（表示単位の切り替え） ---------- */

/**
 * 盤面に沈んだ溝。影も枠線も持たせない。道具箱より一段小さい（32px）のは、
 * 主役ではないことを寸法でも言うため。
 */
export const FLAT_TRACK_CLASS = 'flex items-center gap-0.5 rounded-lg p-0.5';

export const FLAT_TRACK_STYLE = {
  ...CONTROL_FONT,
  backgroundColor: 'var(--track)',
} as const;

/** トラックの中のセグメント。 */
export const SEGMENT_CLASS = `flex h-7 items-center rounded-md px-3 transition-colors ${CONTROL_TEXT}`;

/**
 * 選択中のセグメント。**アクセント色（緑）は使わない**。
 *
 * ここは「行為」ではなく「今どちらを見ているか」の表示なので、盤面で一番強い色を
 * 使うと、作成の道具より目立ってしまって落ち着かない。溝（--track）の中で
 * 地の色（--bg）を出すぶんだけ明るくなる、という差だけで選択を示す。
 * 浮かせない（影を持たせない）のは、浮いているのは道具だけという約束を守るため。
 */
export const SEGMENT_ACTIVE_STYLE = {
  backgroundColor: 'var(--track-active)',
  color: 'var(--fg)',
} as const;

export const SEGMENT_IDLE_STYLE = { color: 'var(--date-color)' } as const;

/* ---------- 情報: 文字だけ（日付ナビ） ---------- */

/** 面を持たない。盤面に直接置かれた文字として読ませる。 */
export const PLAIN_ROW_CLASS = 'flex items-center gap-1';

/** 前後に送る矢印。押せるが、道具ではないので背景を持たない。 */
export const GHOST_BUTTON_CLASS =
  'flex h-7 w-7 items-center justify-center rounded-md text-base transition-colors';
