/**
 * 七十二候（しちじゅうにこう）で、扉の前の一輪挿しに挿さる草花を替える。
 *
 * 「書斎の方で七十二候に合わせて微妙に装飾が変わるのをやってみたい。この入口にもできると
 * 楽しい」（PR #624 のレビュー）への答え。
 *
 * ### 何を替えるか
 *
 * **節気（15 日ごと・24 回）で花材そのものを替える。** はじめは葉の枚数だけを増減させていたが、
 * 「あまりにも地味」と差し戻された。梅・猫柳・桜・菖蒲・笹・蓮・芒・桔梗・紅葉・松・椿…と
 * 姿の違う草花が巡れば、開くたびに季節が分かる。候（5 日ごと・72 回）では、同じ花材のまま
 * 蕾が開き、丈が伸び、傾きが変わる — **同じ花の時間の経過**として読める差にする。
 *
 * ### 何を替えないか
 *
 * 扉・棚・敷物・花器は季節で変えない。変えるのは挿さっている草花だけ。部屋の作りを動かし
 * 始めると、置いてある物の必然性（世界観デザイン）と衝突する。
 *
 * ### 姿勢
 *
 * 川瀬敏郎の「一日一花」に倣い、**一種を一輪挿しに投げ入れた姿**にする。枯れ枝・実だけの枝・
 * 穂だけの芒も花材として扱い、整えず、まっすぐ立てず、余白を残す。
 *
 * 日付 → 太陽黄経 → 候（5° ごと・72 個）と辿る。暦の表を持たないのは、表が年ごとに作り直しに
 * なるため。黄経は近似式で数分の誤差が出るが、候の切り替わりが数分ずれるだけで見た目に影響しない。
 */

/** 候の数。二十四節気 × 3。 */
export const MICRO_SEASON_COUNT = 72;

/** 候 1 つぶんの太陽黄経（度）。 */
const DEGREES_PER_MICRO_SEASON = 360 / MICRO_SEASON_COUNT;

/** 一年の始まり（立春）の太陽黄経。ここが候 0。 */
const RISSHUN_LONGITUDE = 315;

/** 1970-01-01T00:00:00Z のユリウス日。 */
const UNIX_EPOCH_JD = 2440587.5;
const JD_PER_MS = 1 / 86_400_000;
/** J2000.0。 */
const J2000 = 2451545.0;
const DAYS_PER_CENTURY = 36525;

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** 0..360 に丸める。 */
function normalizeDegrees(degrees: number): number {
  const wrapped = degrees % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/**
 * 太陽黄経（度）。天文の標準的な近似（平均黄経 + 中心差）。
 *
 * 誤差はおよそ 0.01°（時間にして数分）。候の境目がその分ずれるだけで、絵は変わらない。
 */
export function solarLongitude(date: Date): number {
  const julianDay = date.getTime() * JD_PER_MS + UNIX_EPOCH_JD;
  const centuries = (julianDay - J2000) / DAYS_PER_CENTURY;
  const meanLongitude = 280.46646 + 36000.76983 * centuries + 0.0003032 * centuries ** 2;
  const meanAnomaly = radians(357.52911 + 35999.05029 * centuries - 0.0001537 * centuries ** 2);
  const center =
    (1.914602 - 0.004817 * centuries - 0.000014 * centuries ** 2) * Math.sin(meanAnomaly) +
    (0.019993 - 0.000101 * centuries) * Math.sin(2 * meanAnomaly) +
    0.000289 * Math.sin(3 * meanAnomaly);
  return normalizeDegrees(meanLongitude + center);
}

/** いまが何番目の候か（0 = 立春の初候、71 = 大寒の末候）。 */
export function microSeasonIndex(date: Date): number {
  const fromRisshun = normalizeDegrees(solarLongitude(date) - RISSHUN_LONGITUDE);
  const index = Math.floor(fromRisshun / DEGREES_PER_MICRO_SEASON);
  // 丸めの端で 72 になりうる。年をまたぐ 1 つ目に畳む。
  return index % MICRO_SEASON_COUNT;
}

/**
 * 姿の型。**線画で描き分けられる最小の数**に絞ってある。
 *
 * - `branch`: 木の枝（梅・桜・紅葉・実の枝）。節で折れ曲がり、葉や花や実が付く
 * - `flower`: 草花の茎（菖蒲・桔梗・彼岸花）。まっすぐ立ち、先に花、根元に細い葉
 * - `grass`: 草・笹（複数の細い葉が弧を描く）
 * - `plume`: 穂のある草（芒）。`grass` の先に穂が開く
 * - `needle`: 松。茎に短い針が並ぶ
 * - `broadleaf`: 大きな一枚（蓮の葉）
 * - `vine`: つる（藤・朝顔）。うねりながら垂れる
 */
type SprigForm = 'branch' | 'flower' | 'grass' | 'plume' | 'needle' | 'broadleaf' | 'vine';

/** 一輪挿しに挿さっている草花。値は花器の口を原点にした world unit と rad。 */
export interface Sprig {
  /** 花材の名前（注釈とテストのため。画面には出さない）。 */
  name: string;
  form: SprigForm;
  /** 茎・枝の本数。 */
  stems: number;
  /** 花器の口からの丈。 */
  height: number;
  /** 傾き（rad）。正で右へ。まっすぐ立てない。 */
  lean: number;
  /** 咲き具合（0 = 蕾 / 1 = 満開）。花を持たない姿では 0。 */
  bloom: number;
  /** 花びらの数（0 なら花を付けない）。 */
  petals: number;
  /** 葉の枚数。 */
  leaves: number;
  /** 実の数。 */
  berries: number;
  /**
   * 葉の形。省くと丸みのある葉（`oval`）。
   * `narrow` は細長い葉（菖蒲・笹）、`lobed` は切れ込みのある葉（楓）。
   */
  leafShape?: 'oval' | 'narrow' | 'lobed';
}

/** 節気ごとの花材。`step`（初候 0 / 次候 1 / 末候 2）で同じ花材の時間が進む。 */
type TermSprig = (step: number) => Sprig;

/** 節気 24 の花材。並びは立春から。 */
const TERMS: TermSprig[] = [
  // 立春: 白梅。固い蕾がほころび始める。
  (step) => ({
    name: '梅',
    form: 'branch',
    stems: 1,
    height: 1.0 + step * 0.03,
    lean: 0.5,
    bloom: 0.12 + step * 0.22,
    petals: 5,
    leaves: 0,
    berries: 0,
  }),
  // 雨水: 猫柳。銀色の花穂が枝に並ぶ。
  (step) => ({
    name: '猫柳',
    form: 'branch',
    stems: 1,
    height: 1.12 + step * 0.04,
    lean: 0.62,
    bloom: 0,
    petals: 0,
    leaves: 0,
    berries: 3 + step,
  }),
  // 啓蟄: 土筆。短い穂が土から伸びる。
  (step) => ({
    name: '土筆',
    form: 'plume',
    stems: 2 + (step > 1 ? 1 : 0),
    height: 0.6 + step * 0.06,
    lean: 0.18,
    bloom: 0.3 + step * 0.2,
    petals: 0,
    leaves: 0,
    berries: 0,
  }),
  // 春分: 桜。ひと枝に花が開く。
  (step) => ({
    name: '桜',
    form: 'branch',
    stems: 1,
    height: 1.16 + step * 0.03,
    lean: 0.72,
    bloom: 0.55 + step * 0.22,
    petals: 5,
    leaves: 0,
    berries: 0,
  }),
  // 清明: 山吹。花のあとに若葉が追いつく。
  (step) => ({
    name: '山吹',
    form: 'branch',
    stems: 1,
    height: 1.2,
    lean: 0.85,
    bloom: 1,
    petals: 5,
    leaves: 1 + step,
    berries: 0,
  }),
  // 穀雨: 藤。房が垂れる。
  (step) => ({
    name: '藤',
    form: 'vine',
    stems: 1,
    height: 1.05 + step * 0.05,
    lean: 0.5,
    bloom: 0.5 + step * 0.25,
    petals: 4,
    leaves: 2,
    berries: 0,
  }),
  // 立夏: 青楓。葉だけの枝。
  (step) => ({
    name: '青楓',
    form: 'branch',
    stems: 1,
    height: 1.14 + step * 0.04,
    lean: 0.66,
    bloom: 0,
    petals: 0,
    leaves: 2 + step,
    berries: 0,
    leafShape: 'lobed',
  }),
  // 小満: 菖蒲。細い葉と立つ花。
  (step) => ({
    name: '菖蒲',
    form: 'flower',
    stems: 1,
    height: 1.24,
    lean: 0.12,
    bloom: 0.35 + step * 0.3,
    petals: 3,
    leaves: 2,
    berries: 0,
    leafShape: 'narrow',
  }),
  // 芒種: 蛍袋。俯いた釣鐘。
  (step) => ({
    name: '蛍袋',
    form: 'flower',
    stems: 1 + (step > 1 ? 1 : 0),
    height: 1.0,
    lean: 0.34,
    bloom: 0.45 + step * 0.2,
    petals: 1,
    leaves: 1,
    berries: 0,
  }),
  // 夏至: 笹。葉が弧を描く。
  (step) => ({
    name: '笹',
    form: 'grass',
    stems: 3 + (step > 1 ? 1 : 0),
    height: 1.2 + step * 0.04,
    lean: 0.3,
    bloom: 0,
    petals: 0,
    leaves: 0,
    berries: 0,
  }),
  // 小暑: 朝顔。つるを伸ばして一輪。
  (step) => ({
    name: '朝顔',
    form: 'vine',
    stems: 1,
    height: 1.1,
    lean: 0.42,
    bloom: 0.6 + step * 0.2,
    petals: 5,
    leaves: 2,
    berries: 0,
  }),
  // 大暑: 蓮の葉。大きな一枚。
  (step) => ({
    name: '蓮の葉',
    form: 'broadleaf',
    stems: 1,
    height: 0.86 + step * 0.05,
    lean: 0.24,
    bloom: 0,
    petals: 0,
    leaves: 1,
    berries: 0,
  }),
  // 立秋: 芒。穂が開く。
  (step) => ({
    name: '芒',
    form: 'plume',
    stems: 2,
    height: 1.3 + step * 0.05,
    lean: 0.55,
    bloom: 0.4 + step * 0.25,
    petals: 0,
    leaves: 0,
    berries: 0,
  }),
  // 処暑: 桔梗。星形の花。
  (step) => ({
    name: '桔梗',
    form: 'flower',
    stems: 1,
    height: 1.06,
    lean: 0.2,
    bloom: 0.3 + step * 0.35,
    petals: 5,
    leaves: 2,
    berries: 0,
  }),
  // 白露: 萩。枝垂れて小さな花。
  (step) => ({
    name: '萩',
    form: 'vine',
    stems: 1,
    height: 1.12,
    lean: 0.7,
    bloom: 0.5 + step * 0.2,
    petals: 3,
    leaves: 3,
    berries: 0,
  }),
  // 秋分: 彼岸花。細い花びらが放射する。
  (step) => ({
    name: '彼岸花',
    form: 'flower',
    stems: 1,
    height: 1.08,
    lean: 0.16,
    bloom: 0.5 + step * 0.25,
    petals: 6,
    leaves: 0,
    berries: 0,
  }),
  // 寒露: 実の枝（七竈）。
  (step) => ({
    name: '実の枝',
    form: 'branch',
    stems: 1,
    height: 1.1,
    lean: 0.68,
    bloom: 0,
    petals: 0,
    leaves: 2 - (step > 1 ? 1 : 0),
    berries: 3 + step,
  }),
  // 霜降: 紅葉。葉を残した枝。
  (step) => ({
    name: '紅葉',
    form: 'branch',
    stems: 1,
    height: 1.05,
    lean: 0.6,
    bloom: 0,
    petals: 0,
    leaves: 3 - step,
    berries: 0,
    leafShape: 'lobed',
  }),
  // 立冬: 枯れ枝。残った葉が 1 枚。
  (step) => ({
    name: '枯れ枝',
    form: 'branch',
    stems: 1,
    height: 1.0 - step * 0.02,
    lean: 0.78,
    bloom: 0,
    petals: 0,
    leaves: step > 1 ? 0 : 1,
    berries: 0,
  }),
  // 小雪: 山茶花。冬に咲く。
  (step) => ({
    name: '山茶花',
    form: 'branch',
    stems: 1,
    height: 0.98,
    lean: 0.55,
    bloom: 0.5 + step * 0.25,
    petals: 5,
    leaves: 2,
    berries: 0,
  }),
  // 大雪: 松。針が並ぶ。
  (step) => ({
    name: '松',
    form: 'needle',
    stems: 1 + (step > 1 ? 1 : 0),
    height: 1.02 + step * 0.03,
    lean: 0.46,
    bloom: 0,
    petals: 0,
    leaves: 0,
    berries: 0,
  }),
  // 冬至: 千両。赤い実と葉。
  (step) => ({
    name: '千両',
    form: 'branch',
    stems: 1,
    height: 0.96,
    lean: 0.4,
    bloom: 0,
    petals: 0,
    leaves: 2,
    berries: 3 + step,
  }),
  // 小寒: 蝋梅。細い花びらが透ける。
  (step) => ({
    name: '蝋梅',
    form: 'branch',
    stems: 1,
    height: 1.04,
    lean: 0.62,
    bloom: 0.45 + step * 0.2,
    petals: 6,
    leaves: 0,
    berries: 0,
  }),
  // 大寒: 椿。固い蕾が春を待つ。
  (step) => ({
    name: '椿',
    form: 'branch',
    stems: 1,
    height: 0.94,
    lean: 0.5,
    bloom: 0.15 + step * 0.15,
    petals: 5,
    leaves: 2,
    berries: 0,
  }),
];

/** その候に挿さっている草花。範囲の外の候でも一年を巡って収まる。 */
export function entranceSprig(index: number): Sprig {
  const season = ((index % MICRO_SEASON_COUNT) + MICRO_SEASON_COUNT) % MICRO_SEASON_COUNT;
  const term = TERMS[Math.floor(season / 3)] ?? TERMS[0];
  return term(season % 3);
}
