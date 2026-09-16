import type { NewsletterAudienceGateway } from '../../domain/gateways/newsletter-audience.gateway.js';
import type { NewsletterRepositoryGateway } from '../../domain/gateways/newsletter-repository.gateway.js';
import type { NewsletterTranslationRepositoryGateway } from '../../domain/gateways/newsletter-translation-repository.gateway.js';
import {
  NEWSLETTER_LOCALES,
  NEWSLETTER_SOURCE_LOCALE,
  type NewsletterLocale,
  type TranslatableLocale,
} from '../../domain/models/newsletter-locale.js';
import {
  PREVIEW_UNSUBSCRIBE_URL,
  renderNewsletterHtml,
  renderNewsletterText,
} from '../../domain/services/newsletter-content.service.js';
import {
  missingTranslationLocales,
  resolveLocalizedContent,
} from '../../domain/services/newsletter-delivery.service.js';
import { NewsletterNotFoundError } from '../errors/newsletter.errors.js';

/**
 * 送信ボタンを押せない理由。
 *
 * 「押せない」だけを返すと、画面側が理由を推測して文言を組み立てることになり、
 * サーバーの判断とずれる。判断と理由を同じ場所から返す。
 */
type NewsletterSendBlockedReason =
  | 'already-sent'
  | 'not-tested'
  | 'translations-missing'
  | 'no-recipients';

/** 言語ごとのプレビュー。宛先が 0 名の言語も含める（0 名だと画面に出したい）。 */
interface NewsletterLocalePreview {
  locale: NewsletterLocale;
  /** その言語の宛先数。 */
  recipientCount: number;
  /** 訳が無い / 原文より古い場合は null（この言語では送れない）。 */
  subject: string | null;
  html: string | null;
  text: string | null;
}

export interface NewsletterPreview {
  id: string;
  subject: string;
  html: string;
  text: string;
  /** その場で数え直した宛先数の合計。「何名に送られるか」の表示に使う。 */
  recipientCount: number;
  /** 言語ごとの内訳と、その言語で実際に届くもの。 */
  locales: NewsletterLocalePreview[];
  /** 宛先がいるのに訳が揃っていない言語。空なら送れる。 */
  missingTranslations: TranslatableLocale[];
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
 *
 * 翻訳を入れてからは **言語ごとに** 実際に届くものを返す。日本語だけ見て送ると、
 * 英語版が崩れていても気づけない。
 */
export class PreviewNewsletterUsecase {
  constructor(
    private repository: NewsletterRepositoryGateway,
    private audience: NewsletterAudienceGateway,
    private translations: NewsletterTranslationRepositoryGateway,
  ) {}

  async execute(id: string): Promise<NewsletterPreview> {
    const newsletter = await this.repository.findById(id);
    if (!newsletter) throw new NewsletterNotFoundError(id);

    const source = { subject: newsletter.subject, bodyMarkdown: newsletter.bodyMarkdown };
    const recipientCountByLocale = await this.audience.countRecipientsByLocale();
    const translations = await this.translations.listByNewsletterId(id);

    // 配信停止リンクは受信者ごとに違うが、プレビューには署名の無いダミーを載せる
    // （出さないと、実際に届くメールと見えているものがずれる）。押しても誰も
    // 配信停止にはならない。
    const locales: NewsletterLocalePreview[] = NEWSLETTER_LOCALES.map((locale) => {
      const recipientCount = recipientCountByLocale[locale];
      const localized = resolveLocalizedContent(locale, source, translations);
      if (!localized) {
        return { locale, recipientCount, subject: null, html: null, text: null };
      }

      const content = {
        subject: localized.subject,
        bodyMarkdown: localized.bodyMarkdown,
        unsubscribeUrl: PREVIEW_UNSUBSCRIBE_URL,
        locale,
      };
      return {
        locale,
        recipientCount,
        subject: localized.subject,
        html: renderNewsletterHtml(content),
        text: renderNewsletterText(content),
      };
    });

    const recipientCount = NEWSLETTER_LOCALES.reduce(
      (total, locale) => total + recipientCountByLocale[locale],
      0,
    );
    const missingTranslations = missingTranslationLocales(
      recipientCountByLocale,
      source,
      translations,
    );

    // 判定順は domain の withSendingStarted と揃える。ずれると、画面が出す理由と
    // 実際に弾かれる理由が食い違う。翻訳漏れは送信の組み立てで落ちるので、
    // 「テスト配信済みか」の次に見る。
    const blockedReason: NewsletterSendBlockedReason | null =
      newsletter.status !== 'draft'
        ? 'already-sent'
        : newsletter.testSentAt === null
          ? 'not-tested'
          : missingTranslations.length > 0
            ? 'translations-missing'
            : recipientCount === 0
              ? 'no-recipients'
              : null;

    // 原文の言語は翻訳を見ないので必ず解決できる。
    const sourcePreview = locales.find((l) => l.locale === NEWSLETTER_SOURCE_LOCALE);

    return {
      id: newsletter.id,
      subject: newsletter.subject,
      html: sourcePreview?.html ?? '',
      text: sourcePreview?.text ?? '',
      recipientCount,
      locales,
      missingTranslations,
      sendable: blockedReason === null,
      blockedReason,
      testSentAt: newsletter.testSentAt,
    };
  }
}
