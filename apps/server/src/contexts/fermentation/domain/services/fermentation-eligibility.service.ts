import type { UserFermentationState } from '../models/user-fermentation-state.js';

// 発酵プロセス自動発火条件 (issue #268)。
//
// 新規使用者 (state == null もしくは lastRunAt == null):
//   - 全エントリ合計文字数 > 言語別閾値
// 継続使用者:
//   - 前回実行以降の合計文字数 > 言語別閾値
//   - 前回実行から nextRandomHours 以上経過
//
// readinessScore は 0.00-1.00 の連続値で、文字数と時間の達成率の min を取る
// (両方が満たされて初めて 1.0 になる)。新規使用者は時間ゲートが無いので charScore のみ。
export type FermentationLanguage = 'ja' | 'en';

// 言語別の文字数閾値 (issue #268)。今のところ外部には公開せず、
// evaluateEligibility/EligibilityResult.threshold 経由で参照する。
const FERMENTATION_CHAR_THRESHOLDS: Readonly<Record<FermentationLanguage, number>> = {
  ja: 1000,
  en: 500,
};

export const FERMENTATION_RANDOM_HOURS_MIN = 24;
export const FERMENTATION_RANDOM_HOURS_MAX = 168;

interface EligibilityInput {
  // 既存の DB レコード。null は新規使用者 (一度も発酵していない)。
  state: UserFermentationState | null;
  // 文字数。新規使用者は全期間、継続使用者は lastRunAt 以降の合計。
  totalChars: number;
  language: FermentationLanguage;
  now: Date;
}

export interface EligibilityResult {
  eligible: boolean;
  readinessScore: number; // [0, 1]
  charScore: number; // [0, 1]
  timeScore: number; // [0, 1] — 新規使用者は 1
  threshold: number; // 言語別の文字数閾値
  charsCurrent: number;
  hoursElapsed: number | null; // 新規使用者は null
  hoursRequired: number | null; // 新規使用者は null
}

export function evaluateEligibility(input: EligibilityInput): EligibilityResult {
  const threshold = FERMENTATION_CHAR_THRESHOLDS[input.language];
  const charScore = clamp01(input.totalChars / threshold);

  const lastRunAtIso = input.state?.lastRunAt ?? null;
  const isFirstTime = lastRunAtIso === null;

  if (isFirstTime) {
    return {
      eligible: charScore >= 1,
      readinessScore: charScore,
      charScore,
      timeScore: 1,
      threshold,
      charsCurrent: input.totalChars,
      hoursElapsed: null,
      hoursRequired: null,
    };
  }

  const lastRunAt = new Date(lastRunAtIso);
  // nextRandomHours が null (旧データ) のときは保守的に最小値を使う。
  const hoursRequired = input.state?.nextRandomHours ?? FERMENTATION_RANDOM_HOURS_MIN;
  const hoursElapsed = (input.now.getTime() - lastRunAt.getTime()) / (60 * 60 * 1000);
  const timeScore = clamp01(hoursElapsed / hoursRequired);
  const readinessScore = Math.min(charScore, timeScore);
  return {
    eligible: charScore >= 1 && timeScore >= 1,
    readinessScore,
    charScore,
    timeScore,
    threshold,
    charsCurrent: input.totalChars,
    hoursElapsed,
    hoursRequired,
  };
}

// 問い単位 readiness 評価 (issue #287)。
//
// admin dashboard 用。fermentation_results は question_id ごとに記録されるので、
// 「この問いについて」の charScore / timeScore を直接スコープして評価できる。
//   charScore = (この問いに紐づくエントリの文字数, この問いの直近成功発酵以降) / 言語別閾値
//   timeScore = (この問いの直近成功発酵からの経過時間) / nextRandomHours
//   readiness = min(charScore, timeScore)
// 未発酵 (lastRunAt == null) の場合は新規使用者と同じく時間ゲートを免除し、
// timeScore = 1, readiness = charScore とする。
// nextRandomHours はユーザー単位の値 (UserFermentationState 由来) をそのまま渡す。
// 不在 (旧データ) なら MIN にフォールバックする。
interface QuestionEligibilityInput {
  // この問いについての直近の成功発酵時刻。null なら未発酵。
  lastRunAt: string | null;
  // この問いに紐づくエントリの文字数。lastRunAt 以降 (null なら全期間)。
  charsSinceLastRun: number;
  // ユーザー単位 nextRandomHours。null は MIN(24h) で評価。
  nextRandomHours: number | null;
  language: FermentationLanguage;
  now: Date;
}

export function evaluateQuestionEligibility(input: QuestionEligibilityInput): EligibilityResult {
  const threshold = FERMENTATION_CHAR_THRESHOLDS[input.language];
  const charScore = clamp01(input.charsSinceLastRun / threshold);

  if (input.lastRunAt === null) {
    return {
      eligible: charScore >= 1,
      readinessScore: charScore,
      charScore,
      timeScore: 1,
      threshold,
      charsCurrent: input.charsSinceLastRun,
      hoursElapsed: null,
      hoursRequired: null,
    };
  }

  const lastRunAt = new Date(input.lastRunAt);
  const hoursRequired = input.nextRandomHours ?? FERMENTATION_RANDOM_HOURS_MIN;
  const hoursElapsed = (input.now.getTime() - lastRunAt.getTime()) / (60 * 60 * 1000);
  const timeScore = clamp01(hoursElapsed / hoursRequired);
  const readinessScore = Math.min(charScore, timeScore);
  return {
    eligible: charScore >= 1 && timeScore >= 1,
    readinessScore,
    charScore,
    timeScore,
    threshold,
    charsCurrent: input.charsSinceLastRun,
    hoursElapsed,
    hoursRequired,
  };
}

// 発酵成功時に呼び、次回までの X 時間 (24-168h, inclusive) を整数で返す。
export function rollRandomHours(rng: () => number = Math.random): number {
  const range = FERMENTATION_RANDOM_HOURS_MAX - FERMENTATION_RANDOM_HOURS_MIN + 1;
  const value = FERMENTATION_RANDOM_HOURS_MIN + Math.floor(rng() * range);
  // rng が 1 を返すなど境界ケースで MAX+1 になりうるのでクランプ。
  if (value > FERMENTATION_RANDOM_HOURS_MAX) return FERMENTATION_RANDOM_HOURS_MAX;
  if (value < FERMENTATION_RANDOM_HOURS_MIN) return FERMENTATION_RANDOM_HOURS_MIN;
  return value;
}

function clamp01(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
