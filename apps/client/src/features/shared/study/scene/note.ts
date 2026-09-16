/**
 * 卓上のメモ（`docs/oryzae-study/00-overview.md`「卓上のメモ」）の寸法と形。純関数のみ。
 *
 * 書斎に初めて来た人の机に 1 枚だけ置いてある、**はがせる**メモ。「使い方とお問い合わせは
 * 左下のアカウントから」とだけ書いてあり、押すとはがれて二度と戻らない。壁に運営の案内を
 * 貼ることはしない — 「プライベートな書斎に運営の世界が異物として紛れ込む」と差し戻された。
 * 他の物と同じ線画（面と細い輪郭だけ）で、文字は手紙と同じ明朝。装飾は付けない。
 */

/** 紙の寸法（world unit、等倍）。3 行の明朝がゆったり入る横長のメモ用紙。 */
export const NOTE_PAPER = { width: 2.6, height: 1.4 } as const;

/**
 * 文字の組み方（world unit、等倍）。
 *
 * 行の高さは文字の 1.4 倍（`createTextTexture` の余白込み）。字は 0.2（ホームで 13px ほど）。
 * 手紙と同じ明朝で、左揃え。いちばん長い行（11 文字）が紙の幅に入る。
 */
export const NOTE_TEXT = { lineHeight: 0.28, inset: 0.16, gap: 0.36 } as const;

/** 文字テクスチャの書体の大きさ（px）。行の高さに対して十分な解像度。 */
export const NOTE_FONT_PX = 56;

/** 紙の置き方（rad、机の面の中の回転）。置いた紙は真っ直ぐには止まらない。 */
export const NOTE_TILT = 0.05;

/**
 * はがすときの動き。持ち上がりながら薄くなり、消える。
 * `prefers-reduced-motion` では動かさずに消す。
 */
export const NOTE_PEEL = { durationMs: 480, rise: 0.5 } as const;

/** 当たりの箱の奥行き（紙は厚みが無いので、指が届く厚さを持たせる）。 */
export const NOTE_HIT_DEPTH = 0.3;

export interface Point2 {
  x: number;
  y: number;
}

/**
 * 紙の輪郭（紙の中心を原点にしたローカル座標、反時計回り）。四隅の 4 点。
 * 板のカードと同じく、面と輪郭線に同じ点列を使う。
 */
export function noteOutline(scale = 1): Point2[] {
  const halfW = (NOTE_PAPER.width * scale) / 2;
  const halfH = (NOTE_PAPER.height * scale) / 2;
  return [
    { x: -halfW, y: halfH },
    { x: -halfW, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: halfH },
  ];
}

/**
 * 各行の y（紙のローカル、中心 0）。行数ぶんを紙の縦中央に均等に置く。
 * 3 行・gap 0.36 なら +0.36 / 0 / -0.36。
 */
export function noteLineYs(count: number, gap: number): number[] {
  if (!Number.isInteger(count) || count <= 0) return [];
  const top = ((count - 1) * gap) / 2;
  return Array.from({ length: count }, (_, index) => top - index * gap);
}

/**
 * 文字の面の幅。テクスチャの縦横比を保って行の高さに合わせる。
 * 全行同幅にしない（背表紙・瓶の言葉と同じ規則）。
 */
export function noteLineWidth(
  texture: { width: number; height: number },
  lineHeight: number,
): number {
  if (texture.height <= 0 || texture.width <= 0) return 0;
  return lineHeight * (texture.width / texture.height);
}

/** 当たりの箱の寸法 [幅, 高さ, 奥行き]。紙そのもの。 */
export function noteHitSize(scale = 1): [number, number, number] {
  return [NOTE_PAPER.width * scale, NOTE_PAPER.height * scale, NOTE_HIT_DEPTH];
}

/**
 * はがす途中の見え方。`progress` は 0..1（イージング済み）。
 * 持ち上がる量と残る不透明度を返す。
 */
export function peelPose(progress: number): { rise: number; opacity: number } {
  const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 1;
  return { rise: NOTE_PEEL.rise * p, opacity: 1 - p };
}
