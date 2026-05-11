import type {
  EmailNotifier,
  NotifierSendResult,
  SendEmailParams,
} from '../../domain/gateways/email-notifier.gateway.js';

// Resend 経由で発酵 digest メールを送る実装。
// graceful degradation (失敗してもジョブ全体を止めない) は呼び出し元の責務とし、
// この層では「失敗はログ + throw」 を徹底する (issue #288)。サイレントスキップで
// メールが届かないまま誰も気付けない、という旧実装の問題に対処するため。
//
// issue #290 フォロー: 戻り値で「送ったか / なぜ送らなかったか」を返す。
// `EMAIL_ENABLED=false` や `RESEND_API_KEY` 抜けは throw ではなく
// `{ sent: false, reason }` で返し、呼び出し元 (admin /fire 等) が
// レスポンスに反映できるようにする。
export class ResendEmailNotifier implements EmailNotifier {
  async send(params: SendEmailParams): Promise<NotifierSendResult> {
    const apiKey = process.env.RESEND_API_KEY;
    // Resend 送信専用サブドメインは `mail.oryzae.ephemere.io` (Route53 で
    // 明示的にメール送信用と分離してある)。アプリ本体の `oryzae.ephemere.io`
    // とは別概念なので混同しないこと。
    const from = process.env.EMAIL_FROM ?? 'Oryzae <noreply@mail.oryzae.ephemere.io>';
    const enabled = process.env.EMAIL_ENABLED !== 'false';

    // EMAIL_ENABLED=false は dev 環境向けの意図的なオフ。
    if (!enabled) return { sent: false, reason: 'disabled' };

    // 本番で API キーが抜けている場合はサイレントにせず、warn でミスを発見できるように。
    if (!apiKey) {
      console.warn('[ResendEmailNotifier] RESEND_API_KEY not set — skipping email send', {
        to: params.to,
        subject: params.subject,
      });
      return { sent: false, reason: 'no-api-key' };
    }

    let response: Response;
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [params.to],
          subject: params.subject,
          text: params.bodyText,
        }),
      });
    } catch (error) {
      // Network error (DNS, TLS, abort, etc.).
      console.error('[ResendEmailNotifier] fetch failed', {
        to: params.to,
        subject: params.subject,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error('[ResendEmailNotifier] Resend API returned non-2xx', {
        to: params.to,
        subject: params.subject,
        status: response.status,
        body: body.slice(0, 500),
      });
      throw new Error(`Resend API returned ${response.status}: ${body.slice(0, 200)}`);
    }

    return { sent: true };
  }
}
