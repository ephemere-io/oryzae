export interface SendEmailParams {
  to: string;
  subject: string;
  bodyText: string;
}

// issue #290 フォロー: 「emailSent=true なのに実際は送られていない」事故 を防ぐため、
// 「送信した / しなかった (なぜ)」を診断情報として返す。実 API エラーは引き続き
// throw する (graceful degradation は呼び出し側の責務)。
export type NotifierSendResult =
  | { sent: true }
  | { sent: false; reason: 'disabled' | 'no-api-key' };

export interface EmailNotifier {
  send(params: SendEmailParams): Promise<NotifierSendResult>;
}
