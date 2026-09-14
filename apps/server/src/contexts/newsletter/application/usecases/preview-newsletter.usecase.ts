import type { NewsletterAudienceGateway } from '../../domain/gateways/newsletter-audience.gateway.js';
import type { NewsletterRepositoryGateway } from '../../domain/gateways/newsletter-repository.gateway.js';
import {
  PREVIEW_UNSUBSCRIBE_URL,
  renderNewsletterHtml,
  renderNewsletterText,
} from '../../domain/services/newsletter-content.service.js';
import { NewsletterNotFoundError } from '../errors/newsletter.errors.js';

/**
 * 送信ボタンを押せない理由。
 *
 * 「押せない」だけを返すと、画面側が理由を推測して文言を組み立てることになり、
 * サーバーの判断とずれる。判断と理由を同じ場所から返す。
 */
type NewsletterSendBlockedReason = 'already-sent' | 'not-tested' | 'no-recipients';

export interface NewsletterPreview {
  id: string;
  subject: string;
  html: string;
  text: string;
  /** その場で数え直した宛先数。「何名に送られるか」の表示に使う。 */
  recipientCount: number;
  /** 送信ボタンを押せるか。`blockedReason === null` と同値。 */
  sendable: boolean;
  /** 押せない理由。押せるなら null。 */
  blockedReason: NewsletterSendBlockedReason | null;
  /** 最後にテスト配信した時刻。null なら未テスト。 */
  testSentAt: string | null;
}

/**
 * 送信前の確認材料をまとめて返す。
 *
 * issue #614 の制約「送信時に HTML プレビュー・宛先数・確認ボタン」のうち
 * 前の 2 つがこれ。宛先数は保存された値ではなく **その時点で数え直す**
 * （下書きを書いてから送るまでに登録者が増減するため）。
 */
export class PreviewNewsletterUsecase {
  constructor(
    private repository: NewsletterRepositoryGateway,
    private audience: NewsletterAudienceGateway,
  ) {}

  async execute(id: string): Promise<NewsletterPreview> {
    const newsletter = await this.repository.findById(id);
    if (!newsletter) throw new NewsletterNotFoundError(id);

    // 配信停止リンクは受信者ごとに違うが、プレビューには署名の無いダミーを載せる
    // （出さないと、実際に届くメールと見えているものがずれる）。押しても誰も
    // 配信停止にはならない。
    const content = {
      subject: newsletter.subject,
      bodyMarkdown: newsletter.bodyMarkdown,
      unsubscribeUrl: PREVIEW_UNSUBSCRIBE_URL,
    };
    const recipientCount = await this.audience.countRecipients();

    // 判定順は domain の withSendingStarted と揃える。ずれると、画面が出す理由と
    // 実際に弾かれる理由が食い違う。
    const blockedReason: NewsletterSendBlockedReason | null =
      newsletter.status !== 'draft'
        ? 'already-sent'
        : newsletter.testSentAt === null
          ? 'not-tested'
          : recipientCount === 0
            ? 'no-recipients'
            : null;

    return {
      id: newsletter.id,
      subject: newsletter.subject,
      html: renderNewsletterHtml(content),
      text: renderNewsletterText(content),
      recipientCount,
      sendable: blockedReason === null,
      blockedReason,
      testSentAt: newsletter.testSentAt,
    };
  }
}
