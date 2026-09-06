/**
 * Claude の従量課金からトークン数 → cost(USD) を算出する純粋関数。
 *
 * issue #352 で Anthropic 直叩きに切替えて以降 generation_id が出ず、
 * `gateway.getGenerationInfo()` ベースのコスト追跡が機能しなくなった。代わりに
 * 保存済みのトークン数と価格表から cost を計算する。
 *
 * ## この算出値の位置づけ
 *
 * Oryzae の LLM 呼び出しは「standard tier・プロンプトキャッシュ無し・バッチ無し・
 * サーバーツール無し」なので、`トークン数 × 公表単価` は Anthropic が請求額を出すのと
 * 同じ計算式になる。当てずっぽうの見積りではなく、Anthropic 自身が返したトークン数に
 * 公表単価を掛けた値である。
 * （丸めや値引き契約のぶんだけ実額とズレうるので、表示上は「推定」と呼ぶ）
 *
 * ## 推定と実請求額がズレる理由（ズレ自体は異常ではない）
 *
 * 実請求額 (anthropic-cost-api.ts の cost_report) は **org 全体**の額で、Oryzae の
 * アプリ以外の利用——CI のセキュリティレビュー、手元の検証、他プロジェクト——も含む。
 * 一方この推定は **Oryzae が自分で記録した呼び出しだけ**を数える。したがって
 * 実請求 ≧ 推定 が常態で、差額は「記録していない利用」の量を意味する。
 *
 * ## 前提が崩れたら気づけるようにしてある
 *
 *   - モデル変更 → 各 gateway が下の *_MODEL_ID を import して anthropic() に渡す。
 *     価格表に無いモデルへ変えると型エラーになる。
 *   - キャッシュ導入 → 各 gateway が cacheRead/cacheWrite を検知して警告ログを出す
 *     （キャッシュ読みは 0.1x、書きは 1.25x/2x なので一律単価では合わなくなる）。
 *   - 単価そのもの → claude-pricing.test.ts が公表値を固定している。
 */

export interface ModelRate {
  /** 100万入力トークンあたりの USD */
  inputUsdPerMTok: number;
  /** 100万出力トークンあたりの USD */
  outputUsdPerMTok: number;
}

/**
 * 価格表。モデルを追加・変更したらここも更新すること。
 * 出典: https://platform.claude.com/docs/en/about-claude/pricing （standard tier）
 */
const RATES = {
  'claude-sonnet-4-6': { inputUsdPerMTok: 3.0, outputUsdPerMTok: 15.0 },
  'claude-opus-5': { inputUsdPerMTok: 5.0, outputUsdPerMTok: 25.0 },
} as const satisfies Record<string, ModelRate>;

/**
 * 用途ごとのモデル。各 gateway はここから import する。
 *
 * 型注釈ではなく satisfies を使うこと。`: keyof typeof RATES` と注釈すると
 * リテラル型が union に広がり、価格表に無いモデルを書いても通ってしまう。
 */
export const FERMENTATION_MODEL_ID = 'claude-sonnet-4-6' satisfies keyof typeof RATES;

/**
 * OCR は発酵と別モデル。手書きの誤読がそのままスニペット本文になるので精度を優先している。
 * 単価は発酵より高い（入力 $5 vs $3、出力 $25 vs $15）ので、同じ単価で計算しないこと。
 */
export const OCR_MODEL_ID = 'claude-opus-5' satisfies keyof typeof RATES;

/** 各モデルの単価。推定の根拠を画面・通知に出すためにも使う。 */
export const FERMENTATION_MODEL_RATE: ModelRate = RATES[FERMENTATION_MODEL_ID];
export const OCR_MODEL_RATE: ModelRate = RATES[OCR_MODEL_ID];

/**
 * 記録済みの model 文字列から単価を引く。価格表に無ければ null。
 *
 * ocr_usage は「そのとき実際に使ったモデル」を文字列で持つ。gateway のモデルを
 * 差し替えた前後のレコードが混在しうるので、集計側は行ごとに引き直す。
 * 引けなかった行を既定の単価で埋めないこと——金額が黙ってズレる。未計上として数える。
 */
function isPricedModel(modelId: string): modelId is keyof typeof RATES {
  // `in` ではなく hasOwn。`'toString' in RATES` はプロトタイプ鎖で true になる。
  return Object.hasOwn(RATES, modelId);
}

export function rateForModel(modelId: string): ModelRate | null {
  return isPricedModel(modelId) ? RATES[modelId] : null;
}

export interface TokenCost {
  totalCost: number;
  promptTokens: number;
  completionTokens: number;
}

/**
 * トークン数 × 単価。**単価は呼び出し側が明示する**。
 *
 * 既定値を持たせない。既定を置くと、OCR のように別モデルで動く呼び出しが
 * うっかり発酵の単価で計算されても何も失敗せず、何倍もズレた金額が
 * 「正しい数字」として出てしまう（合計が増えるだけなので気づけない）。
 */
export function computeCostFromTokens(
  inputTokens: number | null | undefined,
  outputTokens: number | null | undefined,
  rate: ModelRate,
): TokenCost | null {
  // どちらも無ければコスト不明 (= null)。過去の retire 期間や旧 generation_id 方式の
  // レコードはトークン未保存なので null になる。
  if (inputTokens == null && outputTokens == null) return null;
  const input = inputTokens ?? 0;
  const output = outputTokens ?? 0;
  return {
    totalCost:
      (input * rate.inputUsdPerMTok) / 1_000_000 + (output * rate.outputUsdPerMTok) / 1_000_000,
    promptTokens: input,
    completionTokens: output,
  };
}
