/**
 * トークン数 → cost(USD) の **概算**。請求額そのものではない。
 *
 * お金の正は Anthropic の Cost Report（`anthropic-cost-report.ts`）。この価格表では
 * 次のどれも追えないため、合計金額の算出には使わないこと:
 *   - キャッシュトークンの割引単価（cache_read は通常の約 1/10）
 *   - コンテキスト窓別の単価（0-200k と 200k-1M で違う）
 *   - service tier の割引（batch は 50% 引き）
 *   - 期間限定の導入価格や将来の価格改定
 *
 * それでもこの関数が残っているのは、Cost Report が日次バケットの組織合計しか返さず
 * 「この発酵 1 件がいくらか」を出せないため。管理画面のレコード単位の表示と、
 * Admin キーが無い環境でのフォールバックに限って使う。
 *
 * 単価はモデルごとに違うので価格表を持つ。使う側がモデル名を保存していない場合
 * （fermentation_results はモデル列を持たない）は発酵のモデルを既定として扱う。
 * gateway のモデルを変えたらここの表も合わせること:
 *   - 発酵: vercel-ai-analysis.gateway.ts
 *   - 文字起こし: anthropic-photo-transcription.gateway.ts
 */
const USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-sonnet-5': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
  'claude-opus-5': { input: 5.0, output: 25.0 },
};

/** モデル未記録のレコード（fermentation_results）が使う既定。発酵のモデル。 */
const DEFAULT_MODEL = 'claude-sonnet-4-6';

export interface TokenCost {
  totalCost: number;
  promptTokens: number;
  completionTokens: number;
}

export function computeCostFromTokens(
  inputTokens: number | null | undefined,
  outputTokens: number | null | undefined,
  model?: string | null,
): TokenCost | null {
  // どちらも無ければコスト不明 (= null)。過去の retire 期間や旧 generation_id 方式の
  // レコードはトークン未保存なので null になる。
  if (inputTokens == null && outputTokens == null) return null;
  const input = inputTokens ?? 0;
  const output = outputTokens ?? 0;

  // 未知のモデル名でも 0 円扱いにはしない（集計が黙って過少になるのを避ける）。
  const rate = USD_PER_MTOK[model ?? DEFAULT_MODEL] ?? USD_PER_MTOK[DEFAULT_MODEL];

  return {
    totalCost: (input * rate.input + output * rate.output) / 1_000_000,
    promptTokens: input,
    completionTokens: output,
  };
}
