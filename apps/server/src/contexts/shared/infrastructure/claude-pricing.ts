/**
 * トークン数 → cost(USD) の **概算**。請求額そのものではない。
 *
 * 金額の正は Anthropic の Cost Report（`anthropic-cost-report.ts`）。この関数は
 * ANTHROPIC_ADMIN_KEY が無い環境でのフォールバックと、Cost Report では出せない
 * レコード単位の表示（この発酵 1 件がいくらか）のために残してある。
 *
 * 概算なので次のどれも反映されない。合計金額として見せるときは必ず「概算」と明示する:
 *   - キャッシュトークンの割引単価（cache_read は通常の約 1/10。そもそも記録していない）
 *   - コンテキスト窓別の単価（0-200k と 200k-1M で違う）
 *   - service tier の割引（batch は 50% 引き）
 *   - 期間限定の導入価格や将来の価格改定
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

/**
 * 上の価格表を最後に確認した年月。管理画面に出して「いつ時点の単価か」を可視化する。
 * 価格表を更新したらここも直すこと。放っておくと古い単価で静かに計算し続ける。
 */
export const PRICING_AS_OF = '2026-08';

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
