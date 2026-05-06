import { err, ok, type Result } from '../../../shared/domain/types/result.js';

// 発酵プロセス自動発火 (issue #268) のユーザー単位状態。
// - lastRunAt: 直前に発酵が実行された時刻。null は新規使用者。
// - nextEligibleAt: lastRunAt + nextRandomHours に基づく次回 eligible 時刻。
// - nextRandomHours: 24-168h の整数。発酵成功時に再ロールする。
// - charsSinceLast: lastRunAt 以降に書かれたエントリの合計文字数 (新規使用者は全期間)。
// - readinessScore: 発火条件への近さ (0.00-1.00)。Jar アニメーション反映用。
interface UserFermentationStateProps {
  userId: string;
  lastRunAt: string | null;
  nextEligibleAt: string | null;
  nextRandomHours: number | null;
  charsSinceLast: number;
  readinessScore: number;
  updatedAt: string;
}

type UserFermentationStateError =
  | { type: 'INVALID_RANDOM_HOURS'; message: string }
  | { type: 'INVALID_READINESS_SCORE'; message: string }
  | { type: 'INVALID_CHARS'; message: string };

const RANDOM_HOURS_MIN = 24;
const RANDOM_HOURS_MAX = 168;

export class UserFermentationState {
  readonly userId: string;
  readonly lastRunAt: string | null;
  readonly nextEligibleAt: string | null;
  readonly nextRandomHours: number | null;
  readonly charsSinceLast: number;
  readonly readinessScore: number;
  readonly updatedAt: string;

  private constructor(props: UserFermentationStateProps) {
    this.userId = props.userId;
    this.lastRunAt = props.lastRunAt;
    this.nextEligibleAt = props.nextEligibleAt;
    this.nextRandomHours = props.nextRandomHours;
    this.charsSinceLast = props.charsSinceLast;
    this.readinessScore = props.readinessScore;
    this.updatedAt = props.updatedAt;
  }

  // DB に行が無い新規使用者向けの初期状態を返す。
  // バリデーション不要のため Result では包まない。
  static initial(userId: string, now: Date): UserFermentationState {
    return new UserFermentationState({
      userId,
      lastRunAt: null,
      nextEligibleAt: null,
      nextRandomHours: null,
      charsSinceLast: 0,
      readinessScore: 0,
      updatedAt: now.toISOString(),
    });
  }

  static fromProps(props: UserFermentationStateProps): UserFermentationState {
    return new UserFermentationState(props);
  }

  // 発火しない側のチェックでも、admin/UI 反映のため readiness と文字数は毎回更新する。
  withReadiness(
    charsSinceLast: number,
    readinessScore: number,
    now: Date,
  ): Result<UserFermentationState, UserFermentationStateError> {
    if (!Number.isFinite(charsSinceLast) || charsSinceLast < 0) {
      return err({
        type: 'INVALID_CHARS',
        message: 'charsSinceLast must be a non-negative number',
      });
    }
    if (!Number.isFinite(readinessScore) || readinessScore < 0 || readinessScore > 1) {
      return err({
        type: 'INVALID_READINESS_SCORE',
        message: 'readinessScore must be in [0, 1]',
      });
    }
    return ok(
      new UserFermentationState({
        ...this.toProps(),
        charsSinceLast,
        readinessScore,
        updatedAt: now.toISOString(),
      }),
    );
  }

  // 発酵が実行された後の状態遷移。次回 X 時間を保存し、文字数・readiness をリセット。
  withFired(
    nextRandomHours: number,
    now: Date,
  ): Result<UserFermentationState, UserFermentationStateError> {
    if (
      !Number.isInteger(nextRandomHours) ||
      nextRandomHours < RANDOM_HOURS_MIN ||
      nextRandomHours > RANDOM_HOURS_MAX
    ) {
      return err({
        type: 'INVALID_RANDOM_HOURS',
        message: `nextRandomHours must be an integer in [${RANDOM_HOURS_MIN}, ${RANDOM_HOURS_MAX}]`,
      });
    }
    const nextEligibleAt = new Date(now.getTime() + nextRandomHours * 60 * 60 * 1000);
    return ok(
      new UserFermentationState({
        userId: this.userId,
        lastRunAt: now.toISOString(),
        nextEligibleAt: nextEligibleAt.toISOString(),
        nextRandomHours,
        charsSinceLast: 0,
        readinessScore: 0,
        updatedAt: now.toISOString(),
      }),
    );
  }

  toProps(): UserFermentationStateProps {
    return {
      userId: this.userId,
      lastRunAt: this.lastRunAt,
      nextEligibleAt: this.nextEligibleAt,
      nextRandomHours: this.nextRandomHours,
      charsSinceLast: this.charsSinceLast,
      readinessScore: this.readinessScore,
      updatedAt: this.updatedAt,
    };
  }
}
