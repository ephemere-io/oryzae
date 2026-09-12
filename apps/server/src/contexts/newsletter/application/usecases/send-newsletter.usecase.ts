import type {
  BulkEmailMessage,
  BulkEmailSenderGateway,
} from '../../domain/gateways/bulk-email-sender.gateway.js';
import type { NewsletterAudienceGateway } from '../../domain/gateways/newsletter-audience.gateway.js';
import type { NewsletterRepositoryGateway } from '../../domain/gateways/newsletter-repository.gateway.js';
import type { NewsletterProps } from '../../domain/models/newsletter.js';
import {
  renderNewsletterHtml,
  renderNewsletterText,
} from '../../domain/services/newsletter-content.service.js';
import { NewsletterNotFoundError, NewsletterValidationError } from '../errors/newsletter.errors.js';

export interface SendNewsletterResult {
  newsletter: NewsletterProps;
  /** 送信を実行したか。false なら reason に理由が入る（設定漏れ等）。 */
  sent: boolean;
  reason?: 'disabled' | 'no-api-key';
  delivered: number;
  failed: number;
  /**
   * 失敗の内訳。宛先は伏せて理由だけを数える。
   * 「誰に届かなかったか」は admin 画面にも残さない（送信ログに個人を並べない）。
   */
  failureReasons: Array<{ reason: string; count: number }>;
}

/**
 * 一斉配信の実行。
 *
 * ## 二重送信をどう防ぐか
 *
 * 送信は数百通ぶんの HTTP を伴うので、完了までに秒単位かかる。その間に
 * 2 回目の要求が来ると全員に 2 通届く。そこで **宛先を数えた直後に
 * status を sending にして保存し**、以後の要求はドメインの状態遷移で弾く。
 * （行ロックではないので厳密な排他ではないが、人が押すボタン由来の
 * 二度押しはこれで塞がる。）
 *
 * ## 途中で落ちたら
 *
 * sending のまま残すと、その配信は以後永久に送れなくなる。例外は握らず
 * 呼び出し元へ投げ直すが、投げる前に draft へ戻して理由を残す。
 */
export class SendNewsletterUsecase {
  constructor(
    private repository: NewsletterRepositoryGateway,
    private audience: NewsletterAudienceGateway,
    private sender: BulkEmailSenderGateway,
  ) {}

  async execute(id: string): Promise<SendNewsletterResult> {
    const newsletter = await this.repository.findById(id);
    if (!newsletter) throw new NewsletterNotFoundError(id);

    const recipients = await this.audience.listRecipients();

    const started = newsletter.withSendingStarted(recipients.length);
    if (!started.success) throw new NewsletterValidationError(started.error.message);
    await this.repository.save(started.value);

    const content = { subject: newsletter.subject, bodyMarkdown: newsletter.bodyMarkdown };
    const html = renderNewsletterHtml(content);
    const text = renderNewsletterText(content);
    const messages: BulkEmailMessage[] = recipients.map((recipient) => ({
      to: recipient.email,
      subject: newsletter.subject,
      html,
      text,
    }));

    let outcome: Awaited<ReturnType<BulkEmailSenderGateway['sendBulk']>>;
    try {
      outcome = await this.sender.sendBulk(messages);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await this.repository.save(started.value.withSendAborted(message));
      throw error;
    }

    // EMAIL_ENABLED=false / API キー未設定は「送らなかった」であって送信済みでは
    // ない。sent にしてしまうと、設定を直しても二度と送れなくなる。
    if (!outcome.sent) {
      const aborted = started.value.withSendAborted(`送信されませんでした (${outcome.reason})`);
      await this.repository.save(aborted);
      return {
        newsletter: aborted.toProps(),
        sent: false,
        reason: outcome.reason,
        delivered: 0,
        failed: 0,
        failureReasons: [],
      };
    }

    const completed = started.value.withSendCompleted({
      sentCount: outcome.delivered,
      failedCount: outcome.failures.length,
    });
    await this.repository.save(completed);

    const reasonCounts = new Map<string, number>();
    for (const failure of outcome.failures) {
      reasonCounts.set(failure.error, (reasonCounts.get(failure.error) ?? 0) + 1);
    }

    return {
      newsletter: completed.toProps(),
      sent: true,
      delivered: outcome.delivered,
      failed: outcome.failures.length,
      failureReasons: [...reasonCounts.entries()]
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count),
    };
  }
}
