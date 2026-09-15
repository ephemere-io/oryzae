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

/**
 * 認証画面の地（書斎の扉）へ、フォームから掛けられる操作。
 *
 * フォームは扉の実体（three.js）を知らない。送信の前後にこの 2 つを呼ぶだけで、
 * 扉が無い場所（検証ハーネス・テスト・WebGL 非対応）では何もせずにすぐ返る。
 */
export interface EntranceControls {
  /** 送信中・認証中か。扉が少し大きく開く。失敗したら false に戻して閉じ直す。 */
  setWaiting(waiting: boolean): void;
  /**
   * 扉を押し開けて奥へ歩き、画面を地の色に溶かす。**溶け切ってから** resolve する。
   *
   * 呼び出し側はこのあとで行き先へ移る。先に移ると、扉が開く前に画面が切り替わる。
   */
  enter(): Promise<void>;
}
