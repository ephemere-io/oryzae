import { z } from 'zod';

// server の NewsletterProps / PreviewNewsletterUsecase / SendNewsletterUsecase に対応
// (issue #614)。`as` で通さず実行時に検証して取り出す。

export const newsletterSchema = z.object({
  id: z.string(),
  subject: z.string(),
  bodyMarkdown: z.string(),
  status: z.enum(['draft', 'sending', 'sent']),
  createdBy: z.string().nullable(),
  recipientCount: z.number(),
  sentCount: z.number(),
  failedCount: z.number(),
  lastError: z.string().nullable(),
  testSentAt: z.string().nullable(),
  sentAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Newsletter = z.infer<typeof newsletterSchema>;
export type NewsletterStatus = Newsletter['status'];

export const newsletterPreviewSchema = z.object({
  id: z.string(),
  subject: z.string(),
  html: z.string(),
  text: z.string(),
  recipientCount: z.number(),
  sendable: z.boolean(),
  blockedReason: z.enum(['already-sent', 'not-tested', 'no-recipients']).nullable(),
  testSentAt: z.string().nullable(),
});

export type NewsletterPreview = z.infer<typeof newsletterPreviewSchema>;

/** server の SendNewsletterTestResult に対応。テスト配信だけは宛先を返す。 */
export const testSendResultSchema = z.object({
  newsletter: newsletterSchema,
  sent: z.boolean(),
  reason: z.string().optional(),
  delivered: z.number(),
  failed: z.number(),
  recipients: z.array(z.string()),
});

export type TestSendResult = z.infer<typeof testSendResultSchema>;

export const sendResultSchema = z.object({
  newsletter: newsletterSchema,
  sent: z.boolean(),
  reason: z.string().optional(),
  delivered: z.number(),
  failed: z.number(),
  failureReasons: z.array(z.object({ reason: z.string(), count: z.number() })),
});

export type SendResult = z.infer<typeof sendResultSchema>;

export const generateDraftResultSchema = z.object({
  newsletter: newsletterSchema,
  source: z.object({
    since: z.string().nullable(),
    pullRequestCount: z.number(),
    pullRequests: z.array(z.object({ number: z.number(), title: z.string(), url: z.string() })),
  }),
});

export type GenerateDraftResult = z.infer<typeof generateDraftResultSchema>;

/** 送信ボタンを押せない理由を画面の言葉にする（server の blockedReason に対応）。 */
export function formatBlockedReason(
  reason: NonNullable<NewsletterPreview['blockedReason']>,
): string {
  switch (reason) {
    case 'already-sent':
      return 'この配信はすでに送信済みです。';
    case 'not-tested':
      return 'まだテスト配信していません。先に「テスト配信」を押して受信を確認してください。';
    case 'no-recipients':
      return '宛先が 0 名のため送信できません。';
  }
}

/** 送信されなかった理由を画面の言葉にする（server の BulkSendOutcome.reason に対応）。 */
export function formatSendSkipReason(reason: string | undefined): string {
  switch (reason) {
    case 'disabled':
      return 'EMAIL_ENABLED=false（dev でのメール送信オフ）';
    case 'no-api-key':
      return 'RESEND_API_KEY 未設定';
    default:
      return reason ?? '不明';
  }
}
