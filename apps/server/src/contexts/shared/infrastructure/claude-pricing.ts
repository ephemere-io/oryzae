/**
 * Claude の従量課金からトークン数 → cost(USD) を算出する純粋関数。
 *
 * issue #352 で Anthropic 直叩きに切替えて以降 generation_id が出ず、
 * `gateway.getGenerationInfo()` ベースのコスト追跡が機能しなくなった。代わりに
 * 保存済みのトークン数と価格表から cost を計算する。
 *
 * ## この算出値の位置づけ
 *
 * Oryzae の発酵は「単一モデル・standard tier・プロンプトキャッシュ無し・
 * バッチ無し・サーバーツール無し」なので、`トークン数 × 公表単価` は
 * Anthropic が請求額を出すのと同じ計算式になる。当てずっぽうの見積りではなく、
 * Anthropic 自身が返したトークン数に公表単価を掛けた値である。
 * （丸めや値引き契約のぶんだけ実額とズレうるので、表示上は「推定」と呼ぶ）
 *
 * 前提が崩れると静かにズレるので、崩れたら気づけるようにしてある:
 *   - モデル変更 → vercel-ai-analysis.gateway.ts が FERMENTATION_MODEL_ID を
 *     import して anthropicFor('fermentation') に渡す。価格表に無いモデルへ
 *     変えると型エラーになる。
 *   - キャッシュ導入 → 同 gateway が cacheRead/cacheWrite を検知して警告ログを出す
 *     （キャッシュ読みは 0.1x、書きは 1.25x/2x なので一律単価では合わなくなる）。
 */

export interface ModelRate {
  /** 100万入力トークンあたりの USD */
  inputUsdPerMTok: number;
  /** 100万出力トークンあたりの USD */
  outputUsdPerMTok: number;
}

/**
 * 価格表。モデルを追加・変更したらここも更新すること。
 * 出典: https://platform.claude.com/docs/en/about-claude/pricing
 */
const RATES = {
  'claude-sonnet-4-6': { inputUsdPerMTok: 3.0, outputUsdPerMTok: 15.0 },
} as const satisfies Record<string, ModelRate>;

/**
 * fermentation の LLM 呼び出しに使うモデル。gateway はここから import する。
 *
 * 型注釈ではなく satisfies を使うこと。`: keyof typeof RATES` と注釈すると
 * リテラル型が union に広がり、価格表に無いモデルを書いても通ってしまう。
 */
export const FERMENTATION_MODEL_ID = 'claude-sonnet-4-6' satisfies keyof typeof RATES;

/**
 * board の OCR（スニペット切り出し）のモデル。**RATES には載せない。**
 *
 * OCR のコストは cost_report の実額をモデル別に割って取る（anthropic-cost-api.ts）。
 * 自前で単価を持つと二重管理になり、価格改定時に「実額と推定でモデルごとに違う額が
 * 出る」状態を作る。ここに置く理由は2つ:
 *   1. gateway がモデル ID をベタ書きしないため
 *   2. 実額のモデル別内訳に「どれが OCR か」のラベルを付けるため
 *
 * **2026-09-16 に `claude-opus-5` から変更した。理由はランニングコスト。** Opus 5 は
 * $5 / $25 per MTok、Sonnet 5 は $2 / $10 per MTok で **2.5 倍**の差がある。OCR は
 * ユーザーが画像を落とすたびに走るので、利用者が増えるぶんだけそのまま効く。
 * （Sonnet 5 の $2 / $10 は 2026-09-01 に $3 / $15 へ上がる予定が撤回され、
 * そのまま標準価格になったもの。$3 / $15 と書いてある資料は古い。）
 * もともと「手書きの誤読がそのまま
 * スニペットの中身になる」ことを理由に精度へ振っていたが、同じく手書きを読む
 * 写真の文字起こしが Sonnet で運用できているため、コストを優先して揃えた。
 * 読み取り精度が落ちたと感じたら、まずここを戻して切り分けること。
 *
 * **用途別の実額はモデルでは割れない**（写真の文字起こしと同じモデルのため）。
 * 2026-09 に機能ごとの API キー + Workspace に分けたので、用途別の実額は
 * Workspace 軸で取る（anthropic-cost-api.ts の byWorkspace）。
 * この定数が残っているのは gateway がモデル ID をベタ書きしないためだけ。
 */
export const OCR_MODEL_ID = 'claude-sonnet-5';

/**
 * 写真の文字起こし（entry）のモデル。OCR_MODEL_ID と同じ理由でここに置く。
 *
 * 日記のページ全体を起こすため出力が長く (maxOutputTokens 4000)、定型タスクである
 * 文字起こしに Opus の推論力は要らない一方、手書き率が高いので Haiku まで落とすと
 * 精度が目に見えて落ちる——中間の Sonnet。選定根拠は docs/entry-photo-guide.md。
 *
 * 用途別の実額は Workspace 軸で取る（anthropic-cost-api.ts の byWorkspace）。
 * この定数は gateway がモデル ID をベタ書きしないためのもので、費用の分類には使わない。
 */
export const PHOTO_TRANSCRIPTION_MODEL_ID = 'claude-sonnet-5';

/** 上記モデルの単価。推定の根拠を画面に出すためにも使う。 */
export const FERMENTATION_MODEL_RATE: ModelRate = RATES[FERMENTATION_MODEL_ID];

export interface TokenCost {
  totalCost: number;
  promptTokens: number;
  completionTokens: number;
}

export function computeCostFromTokens(
  inputTokens: number | null | undefined,
  outputTokens: number | null | undefined,
): TokenCost | null {
  // どちらも無ければコスト不明 (= null)。過去の retire 期間や旧 generation_id 方式の
  // レコードはトークン未保存なので null になる。
  if (inputTokens == null && outputTokens == null) return null;
  const input = inputTokens ?? 0;
  const output = outputTokens ?? 0;
  return {
    totalCost:
      (input * FERMENTATION_MODEL_RATE.inputUsdPerMTok) / 1_000_000 +
      (output * FERMENTATION_MODEL_RATE.outputUsdPerMTok) / 1_000_000,
    promptTokens: input,
    completionTokens: output,
  };
}
