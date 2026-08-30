/**
 * 盤面の上に浮く操作面の共通素材。
 *
 * ボードの操作 UI（日付ナビ・表示単位の切り替え・道具箱）は、以前それぞれ別の見た目で
 * 作っていた。道具箱だけが「浮いた面」で、他は盤面に印刷された細い文字だったため、
 * 同じ画面の住人に見えず、デザイン言語が割れていた。素材をここに一本化する。
 *
 * 位置は各コンポーネントが決める（fixed の left/right/top/bottom）。ここが持つのは
 * 「面の質感」と「その上に載るボタンの寸法」だけ。
 */

/** 浮いた面そのもの。角丸・余白・影を揃える。 */
export const SURFACE_CLASS =
  'fixed z-[1600] flex items-center rounded-[13px] border p-1.5 ' +
  'shadow-[0_8px_24px_-6px_rgba(0,0,0,0.22),0_2px_6px_-2px_rgba(0,0,0,0.12)]';

export const SURFACE_STYLE = {
  backgroundColor: 'var(--surface-raised)',
  borderColor: 'var(--surface-raised-border)',
  fontFamily: 'Inter, "Noto Sans JP", sans-serif',
} as const;

/** 面に載る正方形のアイコンボタン（道具・日付の矢印）。 */
export const ICON_BUTTON_CLASS =
  'flex h-9 w-9 items-center justify-center rounded-lg transition-colors';

/** 面に載る文字ボタン（表示単位の切り替え）。高さはアイコンボタンと揃える。 */
export const TEXT_BUTTON_CLASS =
  'flex h-9 items-center rounded-lg px-3.5 text-[11px] font-medium uppercase ' +
  'tracking-[0.08em] transition-colors';

/**
 * 選択されていないボタンの hover。
 *
 * 背景をインライン style で指定すると :hover に必ず勝ってしまうので、非選択時は
 * インラインで背景を持たせず、この class に委ねる。
 */
export const IDLE_HOVER_CLASS = 'hover:bg-[var(--toolbar-hover)]';
