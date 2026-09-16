/**
 * メモ帳（`docs/oryzae-study/00-overview.md`「メモ帳」）の寸法と形。純関数のみ。
 *
 * 鉛筆の隣に置いてある小さな紙の束。**文字は描かない** — 書斎の中で文字を持つのは本人の
 * 言葉（瓶）と背表紙の年月だけで、アプリの言葉は DOM 側（ラベル・一言）が言う（`00-overview.md`
 * 「コピー」）。手帳と同じ作り（束・小口の罫）で、上の 1 枚には板のスニペットカードと同じ
 * 抽象の罫線を引く。押すとアカウントへ（使い方とお問い合わせがそこにある）。
 *
 * 文章を印刷した紙を置いた版は「部屋の中で唯一しゃべっている物」になって異物に見え、
 * 差し戻された。物は黙っていて、名乗るのはラベル、中身を言うのは触れたときの一言。
 */

/** 束の寸法（world unit、等倍）。A7 ほどの縦長の束を机に寝かせる。 */
export const MEMO_PAD = { width: 1.0, depth: 1.35, thickness: 0.14 } as const;

/** 置き方（rad、y 軸まわり）。積み（-0.15）とは逆へ少しだけ回して、揃えて置いた感じを外す。 */
export const MEMO_PAD_TILT = 0.12;

/**
 * 上の 1 枚の罫線。板のスニペットカードと同じ「罫線 n 本」の抽象で、文字は書かない。
 * 綴じ（奥の辺）から `topInset` 下がったところから、手前 `bottomInset` を残して均等に。
 */
export const MEMO_PAD_RULES = {
  count: 3,
  widthRatio: 0.72,
  opacity: 0.22,
  topInset: 0.34,
  bottomInset: 0.22,
} as const;

/** 綴じ。奥の辺に沿って 1 本、少し濃く。糊で綴じた束の背に見える。 */
export const MEMO_PAD_BINDING = { inset: 0.16, opacity: 0.32 } as const;

/**
 * 当たりの箱。束より一回り大きく囲む（鉛筆と同じ理由 — 物の見た目は変えず、当たりだけ
 * 手に馴染む大きさにする）。
 */
export const MEMO_PAD_HIT = { margin: 0.25, height: 0.6 } as const;

/**
 * 上の 1 枚の罫線の z（束のローカル、中心 0、奥が負）。綴じの下から手前へ均等に。
 * 罫が 1 本も入らない寸法なら空。
 */
export function memoPadRuleZs(count: number, depth: number = MEMO_PAD.depth, scale = 1): number[] {
  if (!Number.isInteger(count) || count <= 0) return [];
  const halfD = (depth * scale) / 2;
  const top = -halfD + MEMO_PAD_RULES.topInset * scale;
  const bottom = halfD - MEMO_PAD_RULES.bottomInset * scale;
  if (bottom <= top) return [];
  if (count === 1) return [(top + bottom) / 2];
  const step = (bottom - top) / (count - 1);
  return Array.from({ length: count }, (_, index) => top + index * step);
}

/** 当たりの箱の寸法 [幅, 高さ, 奥行き]。 */
export function memoPadHitSize(scale = 1): [number, number, number] {
  return [
    (MEMO_PAD.width + MEMO_PAD_HIT.margin * 2) * scale,
    MEMO_PAD_HIT.height * scale,
    (MEMO_PAD.depth + MEMO_PAD_HIT.margin * 2) * scale,
  ];
}
