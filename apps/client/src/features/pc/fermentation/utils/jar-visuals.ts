/**
 * 発酵瓶の readiness を「見た目」に翻訳する（issue #278）。
 *
 * readiness は **問いごとの readiness の総和**。1問いあたり上限 1.0、問いは最大3つなので
 * 0.0〜3.0 を取る。issue が定めた段階はこの3点:
 *
 *   1.0 … かなり熟成している（液が満ちる）
 *   2.0 … 中身の微生物の動きが活性化している
 *   3.0 … ぶくぶくと激しく泡立っている
 *
 * 段階ごとに別の要素を担当させるのがポイント。ひとつの数字を全要素へ一様に掛けると、
 * 0→3 のあいだ「全部が少しずつ濃くなる」だけで段階が読み取れない。ここでは
 * 0→1 で **液面**、1→2 で **微生物**、2→3 で **泡** が主役を引き継ぐ。
 *
 * **数値は UI に出さない**（issue #278 受け入れ基準）。進捗バーも "あと N%" も出さず、
 * 「何かが進んでいる」ことだけを伝える。ここが返すのも見た目のパラメータだけで、
 * スコアを文字列として見せる経路は持たせない。
 */

/** 瓶 readiness の上限。問いは最大3つ・1問いあたり 1.0 まで（issue #278）。 */
export const JAR_READINESS_MAX = 3;

/** 瓶の中に置ける微生物の最大数（JarVessel のレイアウト定義と対になる）。 */
export const JAR_MICROBE_SLOTS = 6;

/** 泡の最大数。2.0→3.0 でここまで増える。 */
export const JAR_BUBBLE_SLOTS = 14;

/** 文字粒子の最小数。readiness 0 でも瓶が「ただの空き瓶」に見えないよう少しだけ残す。 */
const PARTICLE_MIN = 3;

/**
 * 瓶の中の縦位置（下端からの比率）。泡が液面まで昇るかはここの引き算で決まる。
 *
 * 液面は瓶 SVG（viewBox 600）の y≈240、つまり下から 60%。泡は下から 8% で生まれる。
 *
 * **px で固定しないこと。** もとは上昇距離が 260px 決め打ちで、瓶が 420×520 だった頃は
 * たまたま液面と一致していたが、#533 で 500×620 になった時点で 60px 手前で消えるように
 * なっていた（水中でふっと消える見え方）。比率にしておけば寸法変更に勝手に追従する。
 * この「数は合っているのに見た目がずれる」型は DOM の個数チェックでは捕まらないので、
 * ここに置いて算数として固定する。
 */
export const LIQUID_SURFACE_RATIO = 0.6;
export const BUBBLE_START_RATIO = 0.08;

/** 泡が液面まで昇る距離（px）。瓶の高さに比例する。 */
export function bubbleRisePx(height: number): number {
  return Math.round(height * (LIQUID_SURFACE_RATIO - BUBBLE_START_RATIO));
}

export interface JarVisuals {
  /**
   * 発酵液の充填率 0〜1。液体 path を下へずらす量に使う（1 = 元の設計どおり満ちた状態）。
   * 0→1 の区間で満ちる。
   */
  fillRatio: number;
  /** 描画する微生物の数（0〜JAR_MICROBE_SLOTS）。1→2 の区間で増える。 */
  microbeCount: number;
  /**
   * 微生物・内部曲線のアニメーション速度倍率（1 = 既定、大きいほど速い）。
   * 1→2 の区間で「動きが活性化」する。
   */
  agitation: number;
  /** 泡の数。2→3 の区間で「ぶくぶく」になる。2.0 未満は 0。 */
  bubbleCount: number;
  /**
   * 発酵液グラデーションの温度 0〜1。0 は冷たく澄んだ緑寄り、1 は温かい琥珀寄り。
   * 全区間でゆるやかに上がる（瓶全体の色相が育つ）。
   */
  warmth: number;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** [from, to] の区間を 0〜1 に正規化する。区間外は 0 / 1 に張り付く。 */
function ramp(score: number, from: number, to: number): number {
  return clamp01((score - from) / (to - from));
}

/**
 * 想定外の値（NaN・負・上限超え）でも描画が壊れないよう 0〜JAR_READINESS_MAX に丸める。
 * サーバーは問いの数だけ足すので、問いの上限が将来増えれば 3 を超えて来うる。
 */
function normalizeReadiness(readiness: number): number {
  if (!Number.isFinite(readiness)) return 0;
  return Math.min(Math.max(readiness, 0), JAR_READINESS_MAX);
}

export function jarVisuals(readiness: number): JarVisuals {
  const score = normalizeReadiness(readiness);
  const filling = ramp(score, 0, 1);
  const activating = ramp(score, 1, 2);
  const bubbling = ramp(score, 2, 3);

  return {
    fillRatio: filling,
    microbeCount: Math.round(activating * JAR_MICROBE_SLOTS),
    // 活性化しきって 2.5 倍速。泡立ちの区間ではこれ以上上げない（速さではなく泡で見せる）。
    agitation: 1 + activating * 1.5,
    bubbleCount: Math.round(bubbling * JAR_BUBBLE_SLOTS),
    warmth: score / JAR_READINESS_MAX,
  };
}

/**
 * 浮遊する文字粒子の数。語彙の総数は呼び出し側（i18n のキー数）で決まるので、
 * 最小数と総数のあいだを readiness で線形に補間する。
 */
export function jarParticleCount(readiness: number, totalWords: number): number {
  const score = normalizeReadiness(readiness);
  const min = Math.min(PARTICLE_MIN, totalWords);
  return min + Math.round((totalWords - min) * (score / JAR_READINESS_MAX));
}
