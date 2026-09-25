import { MAX_ENTRY_PHOTO_TEXT_LENGTH } from '@oryzae/shared';
import { generateText } from 'ai';
import { anthropicFor } from '../../../shared/infrastructure/anthropic-provider.js';
import { PHOTO_TRANSCRIPTION_MODEL_ID } from '../../../shared/infrastructure/claude-pricing.js';
import type {
  PhotoTranscriptionGateway,
  PhotoTranscriptionResult,
} from '../../domain/gateways/photo-transcription.gateway.js';

/**
 * 文字起こしに使うモデル。fermentation (vercel-ai-analysis.gateway.ts) が
 * `claude-sonnet-4-6` を使っているのとは独立に選んでいる。文字起こしは定型タスクなので
 * 発酵分析ほどの推論力は要らない一方、日記の写真は手書き率が高く Haiku まで落とすと
 * 精度が目に見えて落ちるため、中間の Sonnet を既定にした。
 *
 * `claude-sonnet-5` は実在する。`anthropic()` の引数は任意の string も受けるため
 * typecheck では検出できないが、インストール済みの `@ai-sdk/anthropic` が公開する
 * モデル ID の union に含まれていることを確認済み（dist/index.d.ts を
 * `grep -oE "'claude-[a-z0-9.-]+'"` して確認できる）。
 *
 * 選定理由とコスト比較は docs/entry-photo-guide.md を参照。
 *
 * **board の OCR (board/infrastructure/ocr/anthropic-ocr.gateway.ts) も 2026-09-16 から
 * 同じ claude-sonnet-5**。あちらは精度を理由に claude-opus-5 だったが、ランニング
 * コストを優先して揃えた。**モデルでは 2 つの用途を区別できない**ので、用途別の実額は
 * API キー（＝Workspace）で分けている（anthropic-provider.ts）。
 */
// 価格表から引く。ベタ書きすると価格改定時に推定と実額がズレる。
const OCR_MODEL = PHOTO_TRANSCRIPTION_MODEL_ID;

/** 起こした文字だけを返させる。前置き・要約・推測での補完をさせないのが肝。 */
function buildPrompt(language: string): string {
  const inLanguage =
    language === 'ja'
      ? '画像の文字は日本語が中心です（縦書きの場合もあります）。'
      : `The text in the image is primarily in "${language}".`;

  return `あなたは画像から文字を書き起こす専門家です。${inLanguage}

次のルールを厳密に守ってください:
- 画像に写っている文字だけを出力する。挨拶・前置き・説明・要約は一切書かない。
- 読み取れない文字は推測で埋めず [?] と書く。
- 段落の区切りの改行は残す。ただし紙幅で折り返されただけの行末の改行は詰めて、1つの段落を1行にする。
- 縦書きは右の行から左の行の順で読む。
- 印字されたページ番号・ヘッダー・フッターなど、本文でないものは省く。
- 文字がまったく写っていない場合は、空文字だけを返す。`;
}

/**
 * 前後の空白と、モデルが付けがちな囲み記号を落としてから頭打ちにする。
 *
 * プロンプトで「本文だけを返す」と指示していても、コードフェンスで包んで返ってくることが
 * ある。board の OCR (anthropic-ocr.gateway.ts の cleanup) と同じ処理で、そちらと
 * 揃えてある。
 *
 * maxOutputTokens で頭打ちにしているのはトークン数であって文字数ではないので、
 * 起こした文字が本文へ流れ込む前にここで文字数も抑える。
 */
function cleanup(raw: string): string {
  const trimmed = raw.trim();
  const unfenced = trimmed.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '');
  return unfenced.trim().slice(0, MAX_ENTRY_PHOTO_TEXT_LENGTH);
}

/** テスト専用の内部公開（fermentation の gateway と同じ流儀）。 */
export const __INTERNAL = { buildPrompt, cleanup, OCR_MODEL };

export class AnthropicPhotoTranscriptionGateway implements PhotoTranscriptionGateway {
  async transcribe(
    image: ArrayBuffer,
    contentType: string,
    language: string,
  ): Promise<PhotoTranscriptionResult> {
    const { text, usage } = await generateText({
      // キーは写真の文字起こし専用 (ANTHROPIC_API_KEY_OCR_ENTRY)。ボード OCR と同じ
      // モデルなので、用途を分けているのはキー（＝Workspace）だけ。
      model: anthropicFor('ocrEntry')(OCR_MODEL),
      maxOutputTokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: buildPrompt(language) },
            // contentType は presentation 層で ACCEPTED_IMAGE_MIME_TYPES に対して
            // 検証済みのものだけが渡ってくる（Anthropic は jpeg/png/gif/webp のみ受理）。
            //
            // 'image' パートは AI SDK v6 で deprecated（実行時に警告が出る）。画像も
            // mediaType 付きの 'file' パートで渡すのが現行の形で、board の OCR も同じ。
            { type: 'file', data: image, mediaType: contentType },
          ],
        },
      ],
    });

    return {
      text: cleanup(text),
      model: OCR_MODEL,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
    };
  }
}
