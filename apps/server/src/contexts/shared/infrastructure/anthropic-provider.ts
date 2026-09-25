import { type AnthropicProvider, createAnthropic } from '@ai-sdk/anthropic';

/**
 * 機能ごとに**別の Anthropic API キー**で provider を作る。
 *
 * ## なぜ機能ごとに分けるのか
 *
 * Anthropic は「何の機能で使ったか」を知らない。請求を用途別に読む手段は 2 つしかなく、
 * どちらもキーを分けることが前提になる:
 *
 *   - **Workspace 別の実額** — `cost_report` は `group_by[]` に `workspace_id` を取れる。
 *     キーは 1 つの Workspace に属するので、キーを分ける = 実額が分かれる。
 *   - **API キー別の実額** — Console の Cost/Usage 画面はキー単位で絞り込める
 *     （`cost_report` API はキーで割れない。Console のほうが細かい）。
 *
 * 以前は全機能が `ANTHROPIC_API_KEY` 1 本を共有していた。そのため:
 *   - モデル ID でしか用途を推測できず、OCR と写真の文字起こしが同じ
 *     `claude-sonnet-5` を使っていたので 1 行に混ざっていた
 *   - 2026-09 に原因不明の課金増（$0.17 → $6.44/日）が起きたとき、**どの機能が
 *     使ったのかを切り分ける手段が無く、数日かけても特定できなかった**
 *
 * キーが分かれていれば「どのキーが増えたか」を Console で見るだけで済む。
 *
 * ## フォールバックを持たない理由
 *
 * キーが無いときに `ANTHROPIC_API_KEY` へ落ちる実装にしてはいけない。落ちた瞬間に
 * 実額が元の混ざった 1 本に戻り、**しかもそれが画面に出ない**。上の「切り分けられない」
 * 状態が黙って再発する。未設定は即座に落として、どの変数が無いかを名指しする。
 */
const FEATURES = {
  fermentation: { envVar: 'ANTHROPIC_API_KEY_FERMENTATION', label: '発酵の分析' },
  ocrBoard: { envVar: 'ANTHROPIC_API_KEY_OCR_BOARD', label: 'ボードの画像の文字起こし' },
  ocrEntry: { envVar: 'ANTHROPIC_API_KEY_OCR_ENTRY', label: 'エントリ写真の文字起こし' },
} as const satisfies Record<string, { envVar: string; label: string }>;

/** LLM を呼ぶ機能。1 機能 = 1 キー = 1 Workspace。 */
export type AnthropicFeature = keyof typeof FEATURES;

/** テストと運用ドキュメントから参照するため公開する。 */
export const ANTHROPIC_FEATURE_ENV_VARS: Readonly<Record<AnthropicFeature, string>> = {
  fermentation: FEATURES.fermentation.envVar,
  ocrBoard: FEATURES.ocrBoard.envVar,
  ocrEntry: FEATURES.ocrEntry.envVar,
};

/**
 * 指定機能のキーで provider を返す。未設定なら変数名を名指しして throw する。
 *
 * provider をモジュール読み込み時ではなく**呼び出しのたびに**作る。読み込み時に作ると
 * env が揃う前（ビルド時・コールドスタート直後）の値を captureしてしまい、
 * 「デプロイ直後だけ古いキーを使う」類の再現しづらい不具合になる。
 * `createAnthropic` は設定オブジェクトを組むだけで、接続は張らない。
 */
export function anthropicFor(feature: AnthropicFeature): AnthropicProvider {
  const { envVar, label } = FEATURES[feature];
  const apiKey = process.env[envVar];
  if (!apiKey) {
    throw new Error(
      `${envVar} が未設定のため${label}を実行できません。` +
        `Anthropic の機能別 API キーを設定してください（機能ごとに別キー・別 Workspace）。` +
        `共通の ANTHROPIC_API_KEY へのフォールバックは、実額を用途別に読めなくなるため意図的に持たせていません。`,
    );
  }
  return createAnthropic({ apiKey });
}
