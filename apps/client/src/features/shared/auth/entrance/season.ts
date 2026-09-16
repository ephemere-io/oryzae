/**
 * 七十二候（しちじゅうにこう）で、扉の前の一輪挿しの枝を変える。
 *
 * 「書斎の方で七十二候に合わせて微妙に装飾が変わるのをやってみたい。この入口にもできると
 * 楽しい」（PR #624 のレビュー）への最初の一歩。**変えるのは枝 1 本だけ**にしてある —
 * 部屋の作りを季節で変え始めると、世界観の設計（扉や置き物の必然性）と衝突する。
 * 枝は生き物なので、季節で姿が変わっても部屋の意味は変わらない。
 *
 * 日付 → 太陽黄経 → 候（5° ごと・72 個）と辿る。暦の表を持たないのは、表は年ごとに
 * 作り直しが要るため。黄経は近似式で数分の誤差が出るが、候の切り替わりが数分ずれるだけで
 * 見た目に影響しない。
 *
 * 時刻の扱いは端末の時計そのまま（利用者の季節感に合わせる）。
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

/** いまが何番目の候か（0 = 立春の初候「東風解凍」、71 = 大寒の末候「鶏始乳」）。 */
export function microSeasonIndex(date: Date): number {
  const fromRisshun = normalizeDegrees(solarLongitude(date) - RISSHUN_LONGITUDE);
  const index = Math.floor(fromRisshun / DEGREES_PER_MICRO_SEASON);
  // 丸めの端で 72 になりうる。年をまたぐ 1 つ目に畳む。
  return index % MICRO_SEASON_COUNT;
}

/** 一輪挿しに挿してある枝の姿。 */
export interface Sprig {
  /** 葉の数（0..3）。 */
  leaves: number;
  /** 蕾。まだ開いていない。 */
  bud: boolean;
  /** 花。 */
  blossom: boolean;
  /** 実。 */
  berry: boolean;
  /**
   * 枝の伸び（0..1）。同じ節気の中でも初候・次候・末候で少しだけ変わる。
   * 「微妙に変わる」を、形ではなく寸法で出すための 1 本。
   */
  reach: number;
}

/**
 * 候から枝の姿を決める。
 *
 * 二十四節気（候 3 つ）を単位に、冬は枝だけ → 春は蕾から花へ → 夏は葉が茂る →
 * 秋は実を付けて葉を落とす、と巡る。候ごとの違いは伸びの 0.04 だけで、
 * 並べて比べなければ気づかない程度にする。
 */
export function entranceSprig(index: number): Sprig {
  const season = ((index % MICRO_SEASON_COUNT) + MICRO_SEASON_COUNT) % MICRO_SEASON_COUNT;
  /** 節気（0 = 立春 … 23 = 大寒）。 */
  const term = Math.floor(season / 3);
  /** 初候 0 / 次候 1 / 末候 2。 */
  const step = season % 3;
  const reach = 0.92 + step * 0.04;

  // 立春・雨水: 枝に蕾だけ。
  if (term <= 1) return { leaves: 0, bud: true, blossom: false, berry: false, reach };
  // 啓蟄・春分: 花が開く。
  if (term <= 3) return { leaves: 1, bud: false, blossom: true, berry: false, reach };
  // 清明・穀雨: 花が残り、葉が増える。
  if (term <= 5) return { leaves: 2, bud: false, blossom: true, berry: false, reach };
  // 立夏〜大暑: 葉が茂る。
  if (term <= 11) return { leaves: 3, bud: false, blossom: false, berry: false, reach };
  // 立秋〜白露: 茂ったまま、実を付ける。
  if (term <= 14) return { leaves: 3, bud: false, blossom: false, berry: true, reach };
  // 秋分〜霜降: 葉を落とし始める。
  if (term <= 17) return { leaves: 2, bud: false, blossom: false, berry: true, reach };
  // 立冬・小雪: 残り 1 枚。
  if (term <= 19) return { leaves: 1, bud: false, blossom: false, berry: false, reach };
  // 大雪〜大寒: 枝だけ。末の大寒には次の蕾が付く。
  return { leaves: 0, bud: term === 23, blossom: false, berry: false, reach };
}
