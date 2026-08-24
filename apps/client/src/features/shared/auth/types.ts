/** 認証ドメインの共有型（端末非依存）。 */

/** ログイン/OAuth/OTP が返すユーザーとセッション。 */
export interface AuthSession {
  user: { id: string; email: string };
  session: { accessToken: string; refreshToken: string };
}

/**
 * OAuth / メール確認フローの失敗理由。
 *
 * 文言は端末側 UI が i18n で解決するため、hook はコードだけを返す。
 * `capacity_reached` は Research Preview の登録枠満了（サーバーが 409 で返す）。
 */
export type AuthFlowError = 'capacity_reached' | 'auth_failed' | 'invalid_link' | 'no_code';

/**
 * 認証フォーム（パスワード再設定・更新）の結果。
 * `error` はサーバーのエラーコードで、文言は `translateAuthError` が解決する。
 */
export type AuthActionResult = { ok: true } | { ok: false; error: string };
