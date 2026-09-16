/** お知らせメール（ニュースレター）ドメインの共有型（端末非依存）。 */

/**
 * 配信停止ページの状態。
 *
 * `working` はページを開いた直後（停止処理中）。文言の出し分けは UI に委ねるため、
 * `error` だけはサーバーの文言をそのまま持つ——原因が分かる唯一の手がかりで、
 * ログインしていない相手に汎用メッセージだけ返しても次の手が打てないため。
 */
export type UnsubscribeState =
  | { status: 'working' }
  | { status: 'unsubscribed' }
  | { status: 'resubscribed' }
  | { status: 'error'; message: string };
