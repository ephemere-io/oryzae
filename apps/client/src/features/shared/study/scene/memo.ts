/**
 * 壁のメモ（`docs/oryzae-study/00-overview.md`「壁のメモ」）の寸法と形。純関数のみ。
 *
 * 書斎から公開サイト（ヘルプ・お問い合わせ・Docs）へ出ていく唯一の導線。机の上の物が
 * 「書く・読む・眺める」を語るのに対して、これは部屋の外への案内なので、ボタンではなく
 * **紙**にする。他の物と同じ線画 — 紙の面・墨の輪郭・背表紙と同じ文字 — で組み、
 * HTML をかぶせない（かぶせた版は「モデルから離れすぎ」と差し戻された）。
 */

/** どの面に置くか。壁はテープで留めて正対、机は置いて寝かせる。 */
export type MemoSurface = 'wall' | 'desk';

/** 1 行 = 1 つの行き先。文面は i18n、URL は呼び出し側が組む（scene は知らない）。 */
export interface MemoLine {
  id: 'help' | 'contact' | 'docs';
  text: string;
  href: string;
}

export interface MemoPaperSize {
  width: number;
  height: number;
}

/**
 * 紙の寸法（world unit）。
 *
 * 壁は 8 × 5 の板の隣に A4 を貼ったくらいの比。机は SP の空き（鉛筆の左）に収まる大きさ。
 */
export const MEMO_PAPER: Record<MemoSurface, MemoPaperSize> = {
  wall: { width: 2.0, height: 2.1 },
  desk: { width: 1.5, height: 1.6 },
};

/** 紙の傾き（rad、面の中の回転）。テープで貼った紙も置いた紙も真っ直ぐには止まらない。 */
export const MEMO_TILT: Record<MemoSurface, number> = { wall: -0.045, desk: 0.09 };

/**
 * 文字の組み方（world unit）。
 *
 * 行の高さは、ホーム位置（PC で 1 unit ≈ 65px）で 15px ほどになる大きさ。背表紙の年月と
 * 同じ明朝・墨。左揃えで、行の間は行の高さの 2 倍あける（紙に 3 行を余白ごと置く）。
 */
export const MEMO_TEXT: Record<MemoSurface, { lineHeight: number; inset: number; gap: number }> = {
  wall: { lineHeight: 0.24, inset: 0.3, gap: 0.5 },
  desk: { lineHeight: 0.19, inset: 0.22, gap: 0.4 },
};

/** 文字テクスチャの書体の大きさ（px）。行の高さに対して十分な解像度。 */
export const MEMO_FONT_PX = 56;

/** 行頭の点。ラベルの「押せる」の手掛かり（3px の点）を紙の上でも同じ役で使う。 */
export const MEMO_DOT = { radius: 0.028, gap: 0.09, opacity: 0.55 } as const;

/** セロハンテープ（壁だけ）。紙の上辺をまたいで壁に留まる。 */
export const MEMO_TAPE = { width: 0.62, height: 0.2, tilt: 0.06, opacity: 0.5 } as const;

/** 当たりの箱。行の高さより上下に太らせ、行の間で指がすり抜けないようにする。 */
export const MEMO_HIT = { depth: 0.3, heightRatio: 0.92 } as const;

/**
 * 破れた下辺。左から右へ、下辺からの食い込み（紙の高さに対する比）。
 *
 * **固定の折れ点。** 描画のたびに変わると紙が「揺れて」見える。上辺と左右は真っ直ぐ。
 */
const TORN: readonly (readonly [number, number])[] = [
  [0.06, 0.045],
  [0.12, 0.005],
  [0.19, 0.05],
  [0.27, 0.02],
  [0.34, 0.055],
  [0.41, 0.01],
  [0.48, 0.04],
  [0.56, 0],
  [0.63, 0.045],
  [0.7, 0.01],
  [0.77, 0.05],
  [0.84, 0.015],
  [0.9, 0.06],
  [0.95, 0.025],
];

export interface Point2 {
  x: number;
  y: number;
}

/**
 * 紙の輪郭（紙の中心を原点にしたローカル座標、反時計回り）。
 * 上辺と左右は真っ直ぐで、下辺だけが `TORN` で不揃い。面にも輪郭線にも同じ点列を使う。
 */
export function paperOutline(size: MemoPaperSize): Point2[] {
  const halfW = size.width / 2;
  const halfH = size.height / 2;
  const points: Point2[] = [
    { x: -halfW, y: halfH },
    { x: -halfW, y: -halfH + size.height * 0.02 },
  ];
  for (const [ratioX, bite] of TORN) {
    points.push({ x: -halfW + size.width * ratioX, y: -halfH + size.height * bite });
  }
  points.push({ x: halfW, y: -halfH + size.height * 0.03 });
  points.push({ x: halfW, y: halfH });
  return points;
}

/**
 * 各行の y（紙のローカル、中心 0）。行数ぶんを紙の縦中央に均等に置く。
 * 3 行・gap 0.5 なら +0.5 / 0 / -0.5。
 */
export function memoLineYs(count: number, gap: number): number[] {
  if (!Number.isInteger(count) || count <= 0) return [];
  const top = ((count - 1) * gap) / 2;
  return Array.from({ length: count }, (_, index) => top - index * gap);
}

/**
 * 文字の面の幅。テクスチャの縦横比を保って行の高さに合わせる。
 * 全行同幅にしない（背表紙・瓶の言葉と同じ規則）。
 */
export function memoLineWidth(
  texture: { width: number; height: number },
  lineHeight: number,
): number {
  if (texture.height <= 0 || texture.width <= 0) return 0;
  return lineHeight * (texture.width / texture.height);
}

/** 行の当たりの箱の寸法 [幅, 高さ, 奥行き]。紙の横幅いっぱい、高さは行間ぶん。 */
export function memoHitSize(surface: MemoSurface): [number, number, number] {
  const paper = MEMO_PAPER[surface];
  const text = MEMO_TEXT[surface];
  return [paper.width - text.inset, text.gap * MEMO_HIT.heightRatio, MEMO_HIT.depth];
}
