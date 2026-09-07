/**
 * 日次コストレポートに「全体感」を与えるための集計（純粋関数）。
 *
 * 単日の金額だけでは、それが多いのか少ないのか判断できない。前日・今月の累計・
 * 月末の見込みを並べて初めて「このままで良いか」が読める。日次レポートが
 * 「$0.1220」とだけ言って何も判断できなかったのがこれを足した理由。
 *
 * 入力は Anthropic cost_report の **UTC 日バケット**（JST 日には切れない）。
 * 呼び出し側は utcDateKeyOfJstFermentationRun() で対応 UTC 日を渡すこと。
 */
import { previousUtcDateKey, utcMonthBounds } from './jst-day.js';

export interface DailyActualCostPoint {
  /** UTC 日 (YYYY-MM-DD)。 */
  date: string;
  costUsd: number;
}

export interface ActualCostTrend {
  /** 対象 UTC 日の実額。 */
  todayUsd: number;
  /** 前日の実額。バケットが無ければ null（「$0 だった」と「データが無い」を混ぜない）。 */
  previousUsd: number | null;
  /** 前日比。前日が不明または $0 なら null（0 除算と「+∞%」を避ける）。 */
  changeRatio: number | null;
  /** 当月 1 日〜対象日の累計。 */
  monthToDateUsd: number;
  /** 当月の経過日数（対象日を含む）。 */
  elapsedDays: number;
  /** 当月の日数。 */
  daysInMonth: number;
  /** 1 日あたり平均（monthToDate / elapsedDays）。 */
  dailyAverageUsd: number;
  /** 月末の見込み（1 日あたり平均 × 当月日数）。単純延長であり予測モデルではない。 */
  projectedMonthEndUsd: number;
}

export function summarizeActualCostTrend(
  daily: DailyActualCostPoint[],
  targetUtcDateKey: string,
): ActualCostTrend {
  // 同じ日のバケットが複数返ることは無いはずだが、返っても取りこぼさず足す。
  const byDate = new Map<string, number>();
  for (const point of daily) {
    byDate.set(point.date, (byDate.get(point.date) ?? 0) + point.costUsd);
  }

  const todayUsd = byDate.get(targetUtcDateKey) ?? 0;
  const previousUsd = byDate.get(previousUtcDateKey(targetUtcDateKey)) ?? null;
  const changeRatio =
    previousUsd !== null && previousUsd > 0 ? (todayUsd - previousUsd) / previousUsd : null;

  const monthPrefix = targetUtcDateKey.slice(0, 7);
  let monthToDateUsd = 0;
  for (const [date, costUsd] of byDate) {
    if (date.slice(0, 7) === monthPrefix && date <= targetUtcDateKey) monthToDateUsd += costUsd;
  }

  const { daysInMonth } = utcMonthBounds(targetUtcDateKey);
  const elapsedDays = Number(targetUtcDateKey.slice(8, 10));
  const dailyAverageUsd = elapsedDays > 0 ? monthToDateUsd / elapsedDays : 0;

  return {
    todayUsd,
    previousUsd,
    changeRatio,
    monthToDateUsd,
    elapsedDays,
    daysInMonth,
    dailyAverageUsd,
    projectedMonthEndUsd: dailyAverageUsd * daysInMonth,
  };
}
