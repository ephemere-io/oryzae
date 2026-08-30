/**
 * Anthropic の支出上限に達したことを、他の障害と区別して見分ける。
 *
 * 上限に達すると API はエラーを返すが、そのまま「AI が失敗した」として扱うと
 * ユーザーには原因不明の不具合に見え、運用側も気づけない。区別できれば
 * 「設定した上限に達した」と伝えられるし、Discord にも別扱いで流せる。
 *
 * 止まり方は 3 通りある（platform.claude.com/docs/en/api/rate-limits）:
 *   - 自分で設定した支出上限 … 400 invalid_request_error
 *     "You have reached your specified API usage limits"
 *   - ティアの月間上限     … 429 rate_limit_error
 *     details.error_code = 'enforced_spend_limit_reached'（retry-after 無し）
 *   - クレジット残高切れ   … 402 billing_error
 *
 * 通常のレート制限（429 + retry-after）は「待てば直る」ので対象外。
 * ここで拾うのは「待っても直らない、金銭的に止まっている」状態だけ。
 */

const SELF_SET_LIMIT_MESSAGE = 'you have reached your specified api usage limits';
const TIER_CAP_ERROR_CODE = 'enforced_spend_limit_reached';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** SDK の例外・生の JSON どちらからでも status を読む。 */
function readStatus(error: unknown): number | null {
  if (!isRecord(error)) return null;
  if (typeof error.status === 'number') return error.status;
  if (typeof error.statusCode === 'number') return error.statusCode;
  return null;
}

function readMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (isRecord(error) && typeof error.message === 'string') return error.message;
  return '';
}

/** `error.details.error_code`（ティア上限の識別子）を掘る。 */
function readErrorCode(error: unknown): string | null {
  if (!isRecord(error)) return null;
  const nested = isRecord(error.error) ? error.error : error;
  const details = isRecord(nested.details) ? nested.details : null;
  if (details && typeof details.error_code === 'string') return details.error_code;
  return null;
}

/**
 * 支出上限・残高切れで止まっているなら true。
 * レート制限（待てば回復する）や通常の障害では false。
 */
export function isSpendLimitError(error: unknown): boolean {
  const status = readStatus(error);
  const message = readMessage(error).toLowerCase();

  // クレジット残高切れ。
  if (status === 402) return true;

  // ティアの月間上限。error_code で通常のレート制限と区別する。
  if (readErrorCode(error) === TIER_CAP_ERROR_CODE) return true;

  // 自分で設定した上限。400 なので、文面で他の invalid_request_error と分ける。
  if (status === 400 && message.includes(SELF_SET_LIMIT_MESSAGE)) return true;

  // status を読めない経路（ラップされた例外など）でも、文面が一致すれば拾う。
  return message.includes(SELF_SET_LIMIT_MESSAGE) || message.includes(TIER_CAP_ERROR_CODE);
}
