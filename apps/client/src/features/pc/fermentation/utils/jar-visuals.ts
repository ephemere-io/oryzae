/**
 * 発酵瓶の readiness を「見た目」に翻訳する（issue #278）。
 *
 * 瓶は2つの軸を受け取る。
 *
 *   top   … いちばん進んだ問いの readiness（0〜1）
 *   total … 全問いの readiness の総和（0〜問いの数、現状は最大3）
 *
 * **役割を分けているのが肝。**
 *
 *   top   が「何が起きるか」= 段階を決める（液 → 微生物 → 泡）
 *   total が「どれだけ賑やかか」= 密度を決める（微生物と泡の数・動きの速さ）
 *
 * 当初は total だけで段階を 1.0/2.0/3.0 に切っていたが、それだと
 * **問いを1つしか持たない人は上限 1.0 で泡立ちに一生到達しない**。
 * PR #559 のレビューで「問い1つでも泡立ってほしい。ただし同時に多く発酵させている
 * 人の瓶のほうがすごいことになっていてほしい」と決まったので、この2軸に分けた。
 *
 * 結果として:
 *   - 問い1つが満タン → 段階は最後まで進む（泡は立つ）が、量は控えめ
 *   - 問い3つが満タン → 同じ段階で、微生物も泡も倍、動きも速い
 *
 * **数値は UI に出さない**（issue #278 受け入れ基準）。進捗バーも "あと N%" も出さず、
 * 「何かが進んでいる」ことだけを伝える。
 */

/** 同時に持てる問いの上限。密度の分母に使う（#278 時点で 3）。 */
export const MAX_QUESTIONS = 3;

/** 瓶の中に置ける微生物の最大数（JarVessel のレイアウト定義と対になる）。 */
export const JAR_MICROBE_SLOTS = 6;

/** 泡の最大数。 */
export const JAR_BUBBLE_SLOTS = 14;

/**
 * 問いを1つしか持たない人が満タンのときに使えるスロットの割合。
 * ここを 1.0 にすると「問いが多い人の瓶のほうがすごい」が消えるので、半分に留める。
 * 残り半分は total（同時に発酵している量）で開く。
 */
const SOLO_DENSITY = 0.5;

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

/** 段階の切れ目。top をこの3等分で読む。 */
const STAGE_LIQUID_END = 1 / 3;
const STAGE_MICROBE_END = 2 / 3;

export interface JarVisuals {
  /** 発酵液の充填率 0〜1。液体 path を下へずらす量に使う。top の最初の1/3で満ちる。 */
  fillRatio: number;
  /** 描画する微生物の数（0〜JAR_MICROBE_SLOTS）。 */
  microbeCount: number;
  /** 微生物・内部曲線のアニメーション速度倍率（1 = 既定、大きいほど速い）。 */
  agitation: number;
  /** 泡の数（0〜JAR_BUBBLE_SLOTS）。 */
  bubbleCount: number;
  /** 発酵液グラデーションの温度 0〜1。0 は冷たく澄んだ緑寄り、1 は温かい琥珀。 */
  warmth: number;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** [from, to] の区間を 0〜1 に正規化する。区間外は 0 / 1 に張り付く。 */
function ramp(value: number, from: number, to: number): number {
  return clamp01((value - from) / (to - from));
}

/** 想定外の値（NaN・負・上限超え）でも描画が壊れないように丸める。 */
function normalize(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), max);
}

/**
 * 同時に発酵している量から「密度」を出す。
 *
 * いちばん進んだ問い（top）ぶんを差し引いた残りが、他の問いの寄与。
 * 問い1つなら残りは 0 で密度は SOLO_DENSITY、問い3つが満タンなら 1.0（全開）。
 */
function density(top: number, total: number): number {
  const extra = clamp01((total - top) / (MAX_QUESTIONS - 1));
  return SOLO_DENSITY + (1 - SOLO_DENSITY) * extra;
}

export function jarVisuals(top: number, total: number): JarVisuals {
  const progress = normalize(top, 1);
  // total は top を下回らない（総和の一部が top なので）。壊れた入力でも整合させる。
  const abundance = Math.max(normalize(total, MAX_QUESTIONS), progress);
  const d = density(progress, abundance);

  const filling = ramp(progress, 0, STAGE_LIQUID_END);
  const swarming = ramp(progress, STAGE_LIQUID_END, STAGE_MICROBE_END);
  const bubbling = ramp(progress, STAGE_MICROBE_END, 1);

  return {
    fillRatio: filling,
    microbeCount: Math.round(swarming * JAR_MICROBE_SLOTS * d),
    // 微生物が出そろうと動きが速くなり、同時発酵が多いほどさらに速い。
    agitation: 1 + swarming * 1.5 * d,
    bubbleCount: Math.round(bubbling * JAR_BUBBLE_SLOTS * d),
    warmth: progress,
  };
}

/**
 * 浮遊する文字粒子の数。語彙の総数は呼び出し側（i18n のキー数）で決まるので、
 * 最小数と総数のあいだを補間する。段階と同じく top で決める。
 */
export function jarParticleCount(top: number, totalWords: number): number {
  const progress = normalize(top, 1);
  const min = Math.min(PARTICLE_MIN, totalWords);
  return min + Math.round((totalWords - min) * progress);
}
