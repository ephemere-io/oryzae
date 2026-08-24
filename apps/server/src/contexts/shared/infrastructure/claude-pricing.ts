/**
 * Claude の従量課金からトークン数 → cost(USD) を算出する純粋関数。
 *
 * issue #352 で Anthropic 直叩きに切替えて以降 generation_id が出ず、
 * `gateway.getGenerationInfo()` ベースのコスト追跡が機能しなくなった。代わりに
 * 保存済みのトークン数と価格表から cost を計算する。
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
