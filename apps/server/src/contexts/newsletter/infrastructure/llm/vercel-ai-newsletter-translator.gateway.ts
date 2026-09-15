import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NEWSLETTER_MODEL_ID } from '../../../shared/infrastructure/claude-pricing.js';
import type {
  NewsletterTranslationRequest,
  NewsletterTranslationResult,
  NewsletterTranslatorGateway,
} from '../../domain/gateways/newsletter-translator.gateway.js';
import type { TranslatableLocale } from '../../domain/models/newsletter-locale.js';

const translationSchema = z.object({
  subject: z.string().describe('Translated subject line. Keep it about as short as the original.'),
  bodyMarkdown: z
    .string()
    .describe('Translated body. Keep the Markdown structure identical to the original.'),
});

const LANGUAGE_NAMES: Record<TranslatableLocale, string> = {
  en: 'English',
  zh: 'Simplified Chinese (简体中文)',
  ko: 'Korean (한국어)',
};

/**
 * 運営者が書いた日本語のニュースレターを、受信者の言語へ訳す。
 *
 * ## 訳すのは本文と件名だけ
 *
 * フッターと配信停止の案内は `newsletter-content.service.ts` が言語ごとの固定文を
 * 持っている。毎回訳すと配信のたびに言い回しが揺れるうえ、**配信停止の文言が
 * 翻訳事故で意味を変えるとそのまま害になる**（「停止する」が「再開する」になる類）。
 *
 * ## 構造を保つ
 *
 * 出力はそのまま `renderNewsletterHtml` に通る必要がある。見出しの数・箇条書きの
 * 項目数・リンクの URL が変わると、日本語版と他言語版で別のメールになる。
 *
 * ## モデル
 *
 * 下書き生成と同じ `NEWSLETTER_MODEL_ID`。どちらも「ニュースレター下書き」という
 * 同じ用途で、費用の内訳を分けたいわけではない（`claude-pricing.ts` 参照）。
 */
export class VercelAiNewsletterTranslatorGateway implements NewsletterTranslatorGateway {
  async translate(request: NewsletterTranslationRequest): Promise<NewsletterTranslationResult> {
    const { object } = await generateObject({
      model: anthropic(NEWSLETTER_MODEL_ID),
      schema: translationSchema,
      prompt: buildPrompt(request),
      maxOutputTokens: 4000,
    });

    return { subject: object.subject.trim(), bodyMarkdown: object.bodyMarkdown.trim() };
  }
}

function buildPrompt(request: NewsletterTranslationRequest): string {
  const language = LANGUAGE_NAMES[request.targetLocale];

  return `Translate an announcement email for Oryzae — a journaling app where what you write
"ferments" over time and comes back to you as a response — from Japanese into ${language}.

## Subject

${request.subject}

## Body

${request.bodyMarkdown}

## Rules

- Translate for **people who use the app**, not for developers. Keep the calm, plain register of
  the original. Do not add exclamation marks or marketing energy that is not in the Japanese.
- **Preserve the Markdown structure exactly.** The same number of \`##\` headings, the same number
  of \`- \` bullets, in the same order. Only these are available: \`##\` headings, \`- \` bullets,
  \`**bold**\`, and \`[text](URL)\` links. Do not introduce tables, images, code blocks, or HTML.
- **Keep every URL byte-for-byte.** Translate the link text, never the address.
- Do not add, remove, or soften any factual claim. If the Japanese does not say it, it must not
  appear in the translation.
- Leave the product name "Oryzae" as-is.
- Do not translate or restate the footer or the unsubscribe notice — they are not included above
  and are added separately in the reader's language.
- Return only the translation. No notes, no explanation of your choices.`;
}

/** プロンプト組み立てのテスト用。production から呼ばない。 */
export const __INTERNAL = { buildPrompt };
