import type {
  BulkEmailFailure,
  BulkEmailMessage,
  BulkEmailSenderGateway,
  BulkSendOutcome,
} from '../../domain/gateways/bulk-email-sender.gateway.js';

/** Resend の batch endpoint は 1 リクエスト 100 通まで。 */
const BATCH_SIZE = 100;
/** バッチ間の間隔 (ms)。Resend の既定レート上限に当てないための保険。 */
const BATCH_INTERVAL_MS = 600;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Resend の batch API で 1 通ずつ送る。
 *
 * ## なぜ ResendEmailNotifier を使い回さないか
 *
 * あれは fermentation コンテキストの実装で、1 通ずつ `POST /emails` を叩く。
 * 200 通を 1 通ずつ投げると 200 リクエストになり、レート制限に当たる。
 * コンテキストを跨いだ import は dep-cruiser が止めるので、素直に
 * newsletter 用の実装を持つ（環境変数の読み方だけ揃えてある）。
 *
 * ## 失敗をどう扱うか
 *
 * バッチが 1 つ落ちても残りは送る。全体を throw で止めると、先に送れた
 * 100 名に届いた状態で「送信していない」ことになり、再送で二重に届く。
 * 落ちたバッチの宛先を failures に積んで、送信結果として返す。
 */
export class ResendBulkEmailSender implements BulkEmailSenderGateway {
  async sendBulk(messages: BulkEmailMessage[]): Promise<BulkSendOutcome> {
    const apiKey = process.env.RESEND_API_KEY;
    // 送信専用サブドメイン。アプリ本体の oryzae.ephemere.io とは別概念。
    const from = process.env.EMAIL_FROM ?? 'Oryzae <noreply@mail.oryzae.ephemere.io>';
    const enabled = process.env.EMAIL_ENABLED !== 'false';

    if (!enabled) return { sent: false, reason: 'disabled' };
    if (!apiKey) {
      console.warn('[ResendBulkEmailSender] RESEND_API_KEY not set — skipping newsletter send', {
        recipientCount: messages.length,
      });
      return { sent: false, reason: 'no-api-key' };
    }

    let delivered = 0;
    const failures: BulkEmailFailure[] = [];
    const batches = chunk(messages, BATCH_SIZE);

    for (const [index, batch] of batches.entries()) {
      if (index > 0) await sleep(BATCH_INTERVAL_MS);

      const payload = batch.map((message) => ({
        from,
        // 宛先は 1 通 1 アドレス。BCC でまとめると受信者同士にアドレスが見える。
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }));

      let response: Response;
      try {
        response = await fetch('https://api.resend.com/emails/batch', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.error('[ResendBulkEmailSender] fetch failed', {
          batchIndex: index,
          batchSize: batch.length,
          error: reason,
        });
        for (const message of batch) failures.push({ to: message.to, error: reason });
        continue;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        const reason = `Resend API ${response.status}: ${body.slice(0, 200)}`;
        console.error('[ResendBulkEmailSender] Resend API returned non-2xx', {
          batchIndex: index,
          batchSize: batch.length,
          status: response.status,
        });
        for (const message of batch) failures.push({ to: message.to, error: reason });
        continue;
      }

      delivered += batch.length;
    }

    return { sent: true, delivered, failures };
  }
}
