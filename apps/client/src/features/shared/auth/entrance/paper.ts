/**
 * 扉の前に置く紙（認証フォーム）の見た目。
 *
 * ログイン・登録・パスワード再設定・認証中の画面が**同じ紙の上の同じ部品**で書かれるよう、
 * クラスをここ 1 か所に集める。値は書斎の注釈と紙のパネル（`#fdfbf7`・墨 `#5C4F3F`・
 * 縁 `rgba(122,116,64,…)`）に揃えてある。
 *
 * 書体は `docs/design-language.md` §5 に従う。**フォームはアプリの言葉なのでゴシック**
 * （Inter / Noto Sans JP）。明朝はブランドの名前と見出しだけ。以前は body の既定が明朝で、
 * ラベルも入力欄もボタンも明朝になっていた（「古めかしくて見にくい」の主因）。
 */

/** 紙そのもの（PC は扉の右に立てる 1 枚、SP は下から敷く 1 枚）。 */
export const PAPER_STYLE = {
  background: 'rgba(253, 251, 247, 0.92)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(122, 116, 64, 0.18)',
} as const;

/** PC の紙だけが持つ影。SP の紙は画面の下端に接しているので浮かせない。 */
export const PAPER_SHADOW =
  '0 40px 90px -50px rgba(74, 70, 50, 0.32), 0 12px 32px -20px rgba(74, 70, 50, 0.18)';

/**
 * 紙の上の文字（アプリの言葉）の書体。紙の根に 1 度だけ当て、中は継がせる。
 *
 * **和文の書体を先頭に置く。** アプリ共通の `CONTROL_FONT` は Inter が先頭で、日本語の
 * 文は字ごとに Inter と Noto Sans JP が混ざる。紙の文はほぼ日本語なので、
 * 「Google でログイン」のように欧文と仮名が隣り合うと大きさと並びが揃わず、崩れて見えた
 * （実機レビュー）。ヒラギノ（Apple 端末。読み込みを待たずに出る）→ Noto Sans JP の順にし、
 * 欧文も同じ書体の中の字形で揃える。
 */
export const PAPER_FONT = {
  fontFamily: '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", system-ui, sans-serif',
} as const;

/** 名前と見出しの書体（明朝）。 */
export const SERIF_FONT = { fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", serif' } as const;

/** フォーム全体の縦の並び。 */
export const PAPER_STACK_CLASS = 'flex flex-col gap-5 text-[#2d2d2d]';

/** ブランドの名前（`Oryzae`）。`SERIF_FONT` と組む。 */
export const BRAND_CLASS = 'text-[30px] font-medium leading-none tracking-[0.02em] text-[#2b2a28]';

/** 名前ではない見出し（「パスワードをリセット」など）。`SERIF_FONT` と組む。 */
export const HEADING_CLASS = 'text-[22px] font-medium leading-snug text-[#2b2a28]';

/** 見出しの下の一文。 */
export const LEAD_CLASS = 'text-[14px] leading-relaxed text-[#8c857e]';

/**
 * 入力欄のラベル。
 *
 * **和文に字間を付けない。** 付けていた頃は「ロ グ イ ン」「パ ス ワ ー ド」とばらけ、
 * 崩れて見えた（実機レビュー）。欧文の大文字の注釈（書斎の `JAR` など）とは違う。
 */
export const LABEL_CLASS = 'text-[13px] font-medium text-[#6b6358]';

/** ラベルの下の補足。 */
export const HELP_CLASS = 'text-[12px] text-[#a39b90]';

/**
 * 入力欄。**文字は 16px を割らない** — iOS Safari は 16px 未満の入力欄に触れると
 * 画面ごと拡大し、紙が画面の外へはみ出す。
 */
export const INPUT_CLASS =
  'h-12 w-full rounded-xl border border-[rgba(122,116,64,0.24)] bg-white/80 px-3.5 text-[16px] ' +
  'text-[#2d2d2d] outline-none transition-[border-color,box-shadow] duration-150 ' +
  'placeholder:text-[#b8b0a6] focus:border-[rgba(92,79,63,0.6)] focus:ring-4 focus:ring-[rgba(122,116,64,0.12)]';

/** 主の操作（ログイン・作成）。墨の一色。 */
export const PRIMARY_BUTTON_CLASS =
  'h-12 w-full rounded-full bg-[#2b2a28] text-[15px] font-semibold text-[#fdfbf7] ' +
  'transition-colors duration-150 hover:bg-[#1a1918] disabled:cursor-default disabled:opacity-50';

/** 副の操作（Google で続ける・ログインに戻る）。紙に縁だけ。 */
export const SECONDARY_BUTTON_CLASS =
  'flex h-12 w-full items-center justify-center gap-2.5 rounded-full border border-[rgba(122,116,64,0.24)] ' +
  'bg-white/70 text-[15px] font-medium text-[#2d2d2d] transition-colors duration-150 ' +
  'hover:bg-[#f3f0e8] disabled:cursor-default disabled:opacity-50';

/** 控えめなリンク（パスワードを忘れた方）。 */
export const QUIET_LINK_CLASS =
  'text-[13px] text-[#8c857e] underline-offset-4 transition-colors hover:text-[#2d2d2d] hover:underline';

/** 文中で押させたいリンク（サインアップ・ログイン）。 */
export const INLINE_LINK_CLASS =
  'font-medium text-[#2d2d2d] underline decoration-[rgba(92,79,63,0.35)] underline-offset-4 ' +
  'transition-colors hover:decoration-[#2d2d2d]';

/** 紙の下端の一文（アカウントをお持ちでない方は…）。 */
export const FOOT_CLASS = 'text-[13px] text-[#8c857e]';

/** エラー。赤ではなく、書斎の封（テラコッタ）の色を薄く敷く。 */
export const ERROR_CLASS =
  'rounded-xl border border-[rgba(212,113,78,0.24)] bg-[rgba(212,113,78,0.07)] px-3.5 py-2.5 ' +
  'text-[13px] leading-relaxed text-[#9a4a2c]';

/** 「または」の区切り線。 */
export const DIVIDER_LINE_CLASS = 'h-px flex-1 bg-[rgba(122,116,64,0.18)]';
export const DIVIDER_TEXT_CLASS = 'text-[12px] text-[#a8a381]';
