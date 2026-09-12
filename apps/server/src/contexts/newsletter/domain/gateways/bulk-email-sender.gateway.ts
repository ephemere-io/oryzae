export interface BulkEmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface BulkEmailFailure {
  to: string;
  error: string;
}

/**
 * 送信の結果。
 *
 * fermentation の `NotifierSendResult`（issue #290）と同じ考え方で、
 * 「送った / 送らなかった (なぜ)」を返す。一斉配信はさらに
 * **一部だけ失敗する** ので、成功数と失敗先も返す。
 */
export type BulkSendOutcome =
  | { sent: true; delivered: number; failures: BulkEmailFailure[] }
  | { sent: false; reason: 'disabled' | 'no-api-key' };

export interface BulkEmailSenderGateway {
  /**
   * 宛先ごとに 1 通ずつ送る。
   *
   * **BCC でまとめない。** 他の登録者のメールアドレスが受信者に見える経路を
   * 作らないため（日記そのものではないが、誰が使っているかは十分に機微）。
   */
  sendBulk(messages: BulkEmailMessage[]): Promise<BulkSendOutcome>;
}
