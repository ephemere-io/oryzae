/**
 * 壁に貼るメモ（`docs/oryzae-study/00-overview.md`「壁のメモ」）の中身と尺の規則。
 *
 * 書斎から公開サイト（`docs.oryzae.ephemere.io`）へ出ていく唯一の導線。
 * 「分からないとき・聞きたいとき・Oryzae の体験について知りたいとき」の 3 つを、
 * 1 枚の紙に並べる。行き先はすべて公開サイト側の 1 か所（`/support` と LP）に寄せてあり、
 * ここが増えるときは公開サイト側の目次と揃えること。
 *
 * i18n の鍵とパスを返すだけの純関数。描くのは `StudyHelpMemo`。
 */

export interface MemoLink {
  id: 'help' | 'contact' | 'docs';
  /** `study` 配下の鍵。どんなときに押すかの一言。 */
  captionKey: string;
  /** `study` 配下の鍵。行き先の名前。 */
  labelKey: string;
  /** 公開サイトのパス（`docsHref` で絶対 URL にする）。 */
  path: string;
}

/**
 * 紙に並べる順。
 *
 * **お問い合わせは `/support` の中の節**（`#contact`）で、独立したページではない。
 * 使い方・よくある質問・お問い合わせを 1 枚にまとめて「ここに来れば足りる」状態に
 * してあるので、ヘルプとお問い合わせは同じページの別の場所を指す。
 * Docs（体験について）は LP そのもの — コンセプト・発酵の三段・思想がある。
 */
export const MEMO_LINKS: readonly MemoLink[] = [
  { id: 'help', captionKey: 'memo_help_caption', labelKey: 'memo_help', path: '/support' },
  {
    id: 'contact',
    captionKey: 'memo_contact_caption',
    labelKey: 'memo_contact',
    path: '/support#contact',
  },
  { id: 'docs', captionKey: 'memo_docs_caption', labelKey: 'memo_docs', path: '/' },
];

/** どの面に貼るか。壁はテープで留めて正対、机は置いて寝かせる。 */
export type MemoSurface = 'wall' | 'desk';

/**
 * 紙の自然寸（px）。文字はこの幅に合わせて組んである。
 *
 * 机に置く方が狭いのは、SP の机の空き（鉛筆の左）が 100px ほどしか無いため。
 * そのぶん「いつ押すか」の一言は省き、行き先の名前だけを並べる（`showsCaptions`）。
 */
export const MEMO_WIDTH: Record<MemoSurface, number> = { wall: 150, desk: 104 };

/** 机の紙は一言を省く（幅が無い）。壁の紙は一言つき。 */
export function showsCaptions(surface: MemoSurface): boolean {
  return surface === 'wall';
}

/**
 * 自然寸を決めたときの尺 — ホーム位置・高さ 900px の画面で、PC の壁の 1 world unit が
 * 画面上で占める長さ（カメラ (0, 4, 12) からメモ (-4.7, 3.0, -4) まで ≈ 16.7、
 * fov 45° → 900 / (2 × 16.6 × tan 22.5°) ≈ 65）。
 *
 * 150px は 2.3 world unit ほどで、8 × 5 の板に対して A4 を貼ったくらいの比になる。
 */
export const MEMO_BASE_PX_PER_UNIT = 65;

/**
 * 尺の上下限。
 *
 * 下限を切るのは読めるため — 小さい画面で忠実に縮めると 9px の字が 6px になる。
 * ラベルが透視スケールをかけないのと同じ理由で、紙も**読めない大きさにはしない**。
 * 上限は寄り切ったときに画面を紙で埋めないため。
 */
export const MEMO_SCALE_RANGE = { min: 0.85, max: 2.6 } as const;

/** その場所の尺（1 world unit の px）から、紙にかける倍率を決める。 */
export function memoScale(pxPerUnit: number): number {
  if (!Number.isFinite(pxPerUnit) || pxPerUnit <= 0) return MEMO_SCALE_RANGE.min;
  const raw = pxPerUnit / MEMO_BASE_PX_PER_UNIT;
  if (raw < MEMO_SCALE_RANGE.min) return MEMO_SCALE_RANGE.min;
  if (raw > MEMO_SCALE_RANGE.max) return MEMO_SCALE_RANGE.max;
  return raw;
}

/** 紙の傾き（度、面の中の回転）。テープで貼った紙も置いた紙も真っ直ぐには止まらない。 */
const MEMO_TILT_DEG: Record<MemoSurface, number> = { wall: -2.5, desk: 5 };

/**
 * 机に置いた紙を寝かせる見せ方。
 *
 * SP のカメラは仰角およそ 52° で机を見下ろしている（`layout.ts`）。机の面の法線は視線と
 * 38° ずれるので、忠実には `rotateX(38deg)` だが、**指で押す行の高さ**を優先して 32° に
 * 留める（縦が cos 32° ≈ 0.85 倍。38° だと 0.79 倍で 1 行が 16px を切る）。
 * 寝ている紙に見える範囲で、できるだけ立てる。`perspective` は奥が少し狭まる程度に弱く。
 * 壁の紙は正対しているので倒さない。
 */
const MEMO_LIE_FLAT = { rotateXDeg: 32, perspectivePx: 520 } as const;

/** 面ごとの CSS transform（中心合わせと尺のあと）。 */
export function memoPose(surface: MemoSurface, scale: number): string {
  const centered = `translate(-50%, -50%) scale(${scale})`;
  if (surface === 'desk') {
    return `${centered} perspective(${MEMO_LIE_FLAT.perspectivePx}px) rotateX(${MEMO_LIE_FLAT.rotateXDeg}deg) rotate(${MEMO_TILT_DEG.desk}deg)`;
  }
  return `${centered} rotate(${MEMO_TILT_DEG.wall}deg)`;
}

/**
 * 紙の下辺を破る `clip-path`。上と左右は真っ直ぐで、下だけが不揃い。
 *
 * 固定の多角形にしてあるのは、描画のたびに破れ方が変わると紙が「揺れて」見えるため。
 */
export const MEMO_TORN_EDGE =
  'polygon(0 0, 100% 0, 100% 95%, 95% 97.5%, 90% 94%, 84% 98.5%, 77% 95%, 70% 99%, ' +
  '63% 95.5%, 56% 100%, 48% 96%, 41% 99%, 34% 94.5%, 27% 98%, 19% 95%, 12% 99.5%, 6% 95.5%, 0 98%)';
