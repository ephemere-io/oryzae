import type {
  EmailNotifier,
  SendEmailParams,
} from '../../domain/gateways/email-notifier.gateway.js';

export class ResendEmailNotifier implements EmailNotifier {
  async send(params: SendEmailParams): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM ?? 'Oryzae <noreply@oryzae.ephemere.io>';
    const enabled = process.env.EMAIL_ENABLED !== 'false';

    if (!enabled || !apiKey) return;

    try {
      await fetch('https://api.resend.com/emails', {
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
    } catch {
      // Silently ignore — notification failure must not break the app.
    }
  }
}
