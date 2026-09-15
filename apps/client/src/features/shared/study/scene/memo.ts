/**
 * 壁のメモ（`docs/oryzae-study/00-overview.md`「壁のメモ」）の寸法と形。純関数のみ。
 *
 * 書斎から公開サイト（ヘルプ・お問い合わせ・Docs）へ出ていく唯一の導線。机の上の物が
 * 「書く・読む・眺める」を語るのに対して、これは部屋の外への案内なので、ボタンではなく
 * **紙**にする。他の物と同じ線画 — 板のカードと同じ「面と細い輪郭だけ」の真っ直ぐな紙を
 * 画鋲 1 つで壁に留める。破れ・テープ・傾き・行頭の飾りは付けない（付けた版は
 * 「ボードや本棚、ジャーの雰囲気に合っていない」と差し戻された。扉の画面（`70-entrance.md`）
 * と同じで、装飾ではなく物で語る）。
 */

/** どの面に置くか。壁は画鋲で留めて正対、机は置いて寝かせる。 */
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
 * 壁は 8 × 5 の板の隣に置くメモ用紙の比（縦長）。机は SP の空き（鉛筆の左）に収まる大きさ。
 */
export const MEMO_PAPER: Record<MemoSurface, MemoPaperSize> = {
  wall: { width: 1.8, height: 2.1 },
  desk: { width: 1.4, height: 1.6 },
};

/**
 * 紙の傾き（rad、面の中の回転）。
 *
 * 壁の紙は画鋲 1 つで留めてあるが真っ直ぐに掛ける（傾けると「貼り付けた」感じが出て
 * 板や棚の直線と喧嘩する）。机に置いた紙だけ、置いたなりにわずかに回る。
 */
export const MEMO_TILT: Record<MemoSurface, number> = { wall: 0, desk: 0.06 };

/**
 * 文字の組み方（world unit）。
 *
 * 行の高さは、ホーム位置（PC で 1 unit ≈ 68px）で 16px ほどになる大きさ。扉の紙と同じ
 * 和文ゴシック（`MEMO_FONT`）で、字間は付けない。左揃えで、行の間は行の高さの 2 倍あける。
 */
export const MEMO_TEXT: Record<MemoSurface, { lineHeight: number; inset: number; gap: number }> = {
  wall: { lineHeight: 0.23, inset: 0.26, gap: 0.46 },
  desk: { lineHeight: 0.18, inset: 0.2, gap: 0.38 },
};

/**
 * 文字の書体。扉の紙（`70-entrance.md`「書体」）と同じく和文を先頭にしたゴシック。
 * 背表紙の年月は明朝だが、あれは数字だけの刻印で、こちらはアプリの言葉（`design-language.md` §5）。
 */
export const MEMO_FONT = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif';

/** 文字テクスチャの書体の大きさ（px）。行の高さに対して十分な解像度。 */
export const MEMO_FONT_PX = 56;

/** 書体の太さ。W3 だと線画の墨より細く見えるので、少しだけ太らせる。 */
export const MEMO_FONT_WEIGHT = 500;

/**
 * 画鋲（壁だけ）。紙の上辺の中央、少し下。正面からは小さな円に見える。
 * 針の影も立体も描かない — 線画は正面の円 1 つで足りる。
 */
export const MEMO_PIN = { radius: 0.055, fromTop: 0.16, opacity: 0.7 } as const;

/** 行のかたまりを紙の中心からどれだけ下げるか。上に画鋲があるぶん、下へ寄せて釣り合わせる。 */
export const MEMO_TEXT_DROP: Record<MemoSurface, number> = { wall: 0.06, desk: 0 };

/** 当たりの箱。行の高さより上下に太らせ、行の間で指がすり抜けないようにする。 */
export const MEMO_HIT = { depth: 0.3, heightRatio: 0.92 } as const;

export interface Point2 {
  x: number;
  y: number;
}

/**
 * 紙の輪郭（紙の中心を原点にしたローカル座標、反時計回り）。四隅の 4 点。
 * 板のカードと同じく、面と輪郭線に同じ点列を使う。
 */
export function paperOutline(size: MemoPaperSize): Point2[] {
  const halfW = size.width / 2;
  const halfH = size.height / 2;
  return [
    { x: -halfW, y: halfH },
    { x: -halfW, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: halfH },
  ];
}

/**
 * 各行の y（紙のローカル、中心 0）。行数ぶんを紙の縦中央に均等に置き、`drop` だけ下げる。
 * 3 行・gap 0.5・drop 0 なら +0.5 / 0 / -0.5。
 */
export function memoLineYs(count: number, gap: number, drop = 0): number[] {
  if (!Number.isInteger(count) || count <= 0) return [];
  const top = ((count - 1) * gap) / 2 - drop;
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
