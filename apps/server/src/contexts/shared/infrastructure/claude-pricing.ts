/**
 * Claude の従量課金からトークン数 → cost(USD) を算出する純粋関数。
 *
 * issue #352 で Anthropic 直叩きに切替えて以降 generation_id が出ず、
 * `gateway.getGenerationInfo()` ベースのコスト追跡が機能しなくなった。代わりに
 * 保存済みのトークン数と価格表から cost を計算する。
 *
 * 価格は fermentation gateway が使うモデル (claude-sonnet-4-6) のもの:
 *   input  $3.00 / 1M tokens, output $15.00 / 1M tokens
 * (vercel-ai-analysis.gateway.ts のモデルを変えたらここも合わせること)
 */
const INPUT_USD_PER_TOKEN = 3.0 / 1_000_000;
const OUTPUT_USD_PER_TOKEN = 15.0 / 1_000_000;

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
    totalCost: input * INPUT_USD_PER_TOKEN + output * OUTPUT_USD_PER_TOKEN,
    promptTokens: input,
    completionTokens: output,
  };
}
