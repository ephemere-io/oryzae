/**
 * 画面の上に浮く操作面の共通素材。
 *
 * ボード（#524）が `board-surface.ts` に切り出していたものを、ボード専用ではなく
 * **アプリ全体の素材**として引き上げたもの。エントリー画面のアクションパレットも
 * ここを参照する。同じ「浮いた面」が画面ごとに別の角丸・別の影・別のボタン寸法に
 * なると、同じアプリの住人に見えなくなる。
 *
 * ここが持つのは「面の質感」と「その上に載る部品の寸法」だけ。**位置は各画面が決める**。
 *
 * ---
 *
 * ## 重さの段
 *
 * 浮かせるのは**道具だけ**。同じ画面に浮いた面が2つ3つあると、どれが主役か分からなくなる。
 *
 * | 段 | 使うところ | 面 |
 * |---|---|---|
 * | `ELEVATED_*` | 道具（パレット・ツールバー） | 背景・枠線・影あり |
 * | `FLAT_TRACK_*` | 切り替え（セグメント） | 背景のみ。影も枠線もなし |
 * | `PLAIN_ROW_*` | 情報（日付ナビ等） | 面を持たない |
 *
 * ## 寸法
 *
 * | 用途 | 値 |
 * |---|---|
 * | 面の内側の余白 | 6px（`p-1.5`） |
 * | 面に載るボタン | 36px 角（`h-9 w-9`） |
 * | ボタンの中のアイコン | 18px（`ICON_SIZE`。className ではなく width/height 属性で指定する） |
 * | ボタン同士の間 | 4px（`gap-1`） |
 * | 面の角丸 | 13px |
 * | ボタンの角丸 | 8px（`rounded-lg`） |
 *
 * アイコンの線幅は **1.6** で統一する。
 */

/** 浮いた面。角丸・余白・影を揃える。位置は呼び出し側が付ける。 */
export const ELEVATED_PANEL_CLASS =
  'flex items-center gap-1 rounded-[13px] border p-1.5 ' +
  'shadow-[0_8px_24px_-6px_rgba(0,0,0,0.22),0_2px_6px_-2px_rgba(0,0,0,0.12)]';

export const ELEVATED_PANEL_STYLE = {
  backgroundColor: 'var(--surface-raised)',
  borderColor: 'var(--surface-raised-border)',
} as const;

/** 面に載る正方形のアイコンボタン。 */
/**
 * **押せるものは、ホバーで地がわずかに沈む。アプリ全体でこれ1つ。**
 *
 * 以前は同じ意味のホバーに4種類の色が混ざっていた（灰・砂・茶）。触るたびに手応えの色が
 * 違うと、押せるかどうかを色で覚えられない。色の種類ではなく「地が沈む」ことで伝える。
 * 動き（拡大・浮き上がり）はホバーの言語にしない——押す前に物が動くと、狙いがずれる。
 */
export const HOVER_CLASS = 'transition-colors duration-150 hover:bg-[var(--hover-wash)]';

export const TOOL_BUTTON_CLASS =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors active:scale-95';

/**
 * 選択されていないボタンの hover。
 *
 * 背景をインライン style で指定すると `:hover` に必ず勝ってしまうので、非選択時は
 * インラインで背景を持たせず、この class に委ねる。
 */

/** 押せないことを伝える見た目。`disabled` 属性は使わない（理由に到達できなくなる）。 */
export const DISABLED_CLASS = 'cursor-default opacity-40';

/** 操作 UI の書体。本文の明朝と混ぜない。 */
export const CONTROL_FONT = {
  fontFamily: 'Inter, "Noto Sans JP", sans-serif',
} as const;

/** 面に載るアイコンの寸法。className ではなく width/height 属性に渡す。 */
export const ICON_SIZE = 18;

/** アイコンの線幅。全画面で揃える。 */
export const ICON_STROKE_WIDTH = 1.6;

/**
 * 本文領域（サイドバーを除いた部分）の中央に置くための位置指定。
 *
 * `--sidebar-width` は `(protected)/layout.tsx` が `<main>` に生やしている。
 * 画面中央に置くとサイドバーのぶんだけ左にずれて見えるので、その半分を足して補正する。
 */
export const CONTENT_CENTERED_STYLE = {
  left: 'calc(50% + var(--sidebar-width, 0px) / 2)',
  transform: 'translateX(-50%)',
} as const;

/**
 * 画面の外枠から中身までの余白。**サイドバーの上下端と、エントリー画面のヘッダー上端が
 * これを共有する**。同じ数字を使うから、瓶と「問いを結ぶ」が同じ線に乗る。
 */
export const SHELL_INSET = 20;

/**
 * 外枠に並ぶ行の高さ。サイドバーの各項目と、エントリー画面のヘッダー行。
 * 中身（アイコン・チップ・アバター）は高さが違っても、この箱の中央に揃える。
 */
export const SHELL_ROW_HEIGHT = 48;

/**
 * 画面の右から出る面の幅。**常設の発酵サイドバーと、そこから開く詳細ペインが共有する**。
 * 別々の幅（288 / 400）だと、開いた瞬間に面が広がって別物に見える。
 *
 * 336px は、この面が出ていても本文が1行 34 字を保てる上限から決めてある
 * （1512px の窓 − サイドバー 80 − この面 336 = 1096 ≥ 本文の最大幅）。
 */
export const SIDE_PANEL_WIDTH = 336;
