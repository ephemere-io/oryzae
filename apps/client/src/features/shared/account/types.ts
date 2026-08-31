/** アカウント（プロフィール・メール・パスワード）ドメインの共有型（端末非依存）。 */

/**
 * アカウント更新系 API の結果。
 *
 * 文言の出し分けは端末側 UI に委ねるため、hook は「翻訳済み文字列」ではなく理由を返す。
 * `unauthenticated` はトークン切れ（ログインし直しの案内）、`server` はサーバーの
 * エラーコード（`translateAuthError` などで訳す）。
 */
export type AccountUpdateResult =
  | { ok: true }
  | { ok: false; kind: 'unauthenticated' }
  | { ok: false; kind: 'server'; error: string };

/** アカウント画面が表示するユーザー情報。 */
export interface AccountUser {
  id: string;
  email: string;
  nickname: string | null;
  avatarUrl: string | null;
  name: string | null;
  providers: string[];
}
