import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NEWSLETTER_MODEL_ID } from '../../../shared/infrastructure/claude-pricing.js';
import type {
  NewsletterDraftGeneratorGateway,
  NewsletterDraftRequest,
  NewsletterDraftSuggestion,
} from '../../domain/gateways/newsletter-draft-generator.gateway.js';

const draftSchema = z.object({
  subject: z
    .string()
    .describe('メールの件名。40 文字以内。[Oryzae] などの接頭辞は付けない（送信側で付かない）'),
  bodyMarkdown: z
    .string()
    .describe(
      '本文。Markdown サブセット（# 見出し / - 箇条書き / **太字** / [文字](URL)）のみ使用。' +
        '400〜800 字程度',
    ),
});

/**
 * merge 済み PR から、登録使用者向けの「今回の更新」下書きを書く。
 *
 * ## プロンプトの要点
 *
 * PR のタイトルは開発者向けの語彙で書かれている（「dep-cruise に
 * service-role-client-containment を追加」）。そのまま並べても使用者には
 * 意味が無いので、**利用者から見て何が変わったか** に翻訳させる。
 * 何も変わっていない内部変更は落とさせる —— 水増しされたリリースノートは
 * 読まれなくなる。
 *
 * ## モデル
 *
 * NEWSLETTER_MODEL_ID を使う（発酵 / OCR / 文字起こしとは別モデル）。
 * 同じモデルを共有すると Anthropic のモデル別内訳が用途別内訳として
 * 読めなくなる。claude-pricing.ts のコメントを参照。
 */
export class VercelAiNewsletterDraftGateway implements NewsletterDraftGeneratorGateway {
  async generate(request: NewsletterDraftRequest): Promise<NewsletterDraftSuggestion> {
    const { object } = await generateObject({
      model: anthropic(NEWSLETTER_MODEL_ID),
      schema: draftSchema,
      prompt: buildPrompt(request),
      maxOutputTokens: 2000,
    });

    return { subject: object.subject.trim(), bodyMarkdown: object.bodyMarkdown.trim() };
  }
}

function buildPrompt(request: NewsletterDraftRequest): string {
  const period = request.since ? `前回の配信（${request.since}）以降` : '直近（これが初回の配信）';

  const prList = request.pullRequests
    .map((pr) => {
      const body = pr.body.trim();
      return [
        `### #${pr.number} ${pr.title}`,
        `merged: ${pr.mergedAt}`,
        body.length > 0 ? body : '(本文なし)',
      ].join('\n');
    })
    .join('\n\n');

  const avoid =
    request.previousSubjects.length > 0
      ? `\n## 直近に送った件名（同じ言い回しを繰り返さない）\n\n${request.previousSubjects
          .map((s) => `- ${s}`)
          .join('\n')}\n`
      : '';

  return `あなたは Oryzae（日記を書き、その蓄積が「発酵」して応答が返ってくるジャーナリング
アプリ）の運営者です。登録している使用者へ送る「更新のお知らせ」メールの下書きを書いてください。

## 素材

${period}にマージされた Pull Request の一覧です。開発者向けの言葉で書かれています。

${prList}
${avoid}
## 書き方

- **使用者から見て何が変わったか** に翻訳する。PR のタイトルをそのまま並べない
- 使用者に見えない変更（リファクタリング、CI、テスト、依存更新、型の修正、
  ドキュメント）は **載せない**。載せるものが少なければ少ないままでよい。
  水増ししたお知らせは次から読まれなくなる
- 事実だけを書く。素材に無い機能・日付・数字を足さない
- 落ち着いた、事務的すぎない日本語。過剰な感嘆や煽りを使わない
- 「新機能」「改善」など 2〜3 個の見出し（##）に束ねる。各項目は 1〜2 文
- 冒頭は 1〜2 文の挨拶、末尾は 1 文で締める。署名・フッターは書かない（送信側で付く）

## 使える記法

見出しは \`##\`、箇条書きは \`- \`、強調は \`**\`、リンクは \`[文字](URL)\` だけです。
表・画像・コードブロック・HTML は使えません。`;
}

/** プロンプト組み立てのテスト用。production から呼ばない。 */
export const __INTERNAL = { buildPrompt };
