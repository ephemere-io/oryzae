/**
 * Research Preview のサインアップ枠ポリシー（ドメイン純粋ロジック）。
 *
 * 上限値は環境変数 `MAX_USER_COUNT` で運用変更できる前提だが、
 * env 読み取りは application 層に置く。ここは（used, limit）→ 状態の純関数のみ。
 */

export const DEFAULT_MAX_USER_COUNT = 100;

export interface SignupAvailability {
  /** 上限人数 */
  limit: number;
  /** 現在の登録済み人数（profiles 行数） */
  used: number;
  /** 残り枠（0 未満にはならない） */
  remaining: number;
  /** 上限到達フラグ */
  capacityReached: boolean;
}

export function computeSignupAvailability(used: number, limit: number): SignupAvailability {
  const safeUsed = Math.max(0, Math.floor(used));
  const safeLimit = Math.max(0, Math.floor(limit));
  const remaining = Math.max(0, safeLimit - safeUsed);
  return {
    limit: safeLimit,
    used: safeUsed,
    remaining,
    capacityReached: safeUsed >= safeLimit,
  };
}
