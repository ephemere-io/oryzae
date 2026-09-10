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
 *     import して anthropic() に渡す。価格表に無いモデルへ変えると型エラーになる。
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
 * OCR のモデル。**RATES には載せない。**
 *
 * OCR のコストは cost_report の実額をモデル別に割って取る（anthropic-cost-api.ts）。
 * 自前で単価を持つと二重管理になり、価格改定時に「実額と推定でモデルごとに違う額が
 * 出る」状態を作る。ここに置く理由は3つだけ:
 *   1. gateway がモデル ID をベタ書きしないため
 *   2. 実額のモデル別内訳に「どれが OCR か」のラベルを付けるため
 *   3. 発酵と別モデルであることをテストで固定するため——**同じモデルになると
 *      モデル別内訳が用途別内訳として機能しなくなる**（混ざって区別できない）
 */
export const OCR_MODEL_ID = 'claude-opus-5';

/**
 * 写真の文字起こし（entry）のモデル。OCR_MODEL_ID と同じ理由でここに置く。
 *
 * board の OCR と別モデルなのは意図的。あちらはスニペット 1 枚で出力が短く
 * (maxOutputTokens 1024)、誤読がそのままスニペットの中身になるので精度に振れる。
 * こちらは日記のページ全体を起こすため出力が 4 倍 (4000) あり、同じ Opus にすると
 * 1 回あたり $0.065 → $0.108 になる。選定根拠は docs/entry-photo-guide.md。
 *
 * **用途別の内訳はモデル ID でしか引けない**（Anthropic は用途を知らない）。
 * ここに登録し featureOfModel が拾えるようにしないと、この機能の費用が
 * 管理画面でも費用アラートでも「分類不明」に落ちる。実際 #529 で入ったときは
 * gateway にベタ書きされており、そうなっていた。
 */
export const PHOTO_TRANSCRIPTION_MODEL_ID = 'claude-sonnet-5';

/**
 * モデル ID を用途名に読み替える。未登録なら null（＝分類不明）。
 *
 * Anthropic は「用途」を知らない。モデルが分かれているから用途別に読めるだけで、
 * **同じモデルを他の用途や CI が使えば同じバケットに混ざる**。だから返すのは
 * 「このモデルを使っている機能」であって「その機能のコード」ではない。
 * 画面・通知の文言もそのつもりで書くこと。
 *
 * モデル ID の定義と同じファイルに置く。以前は admin-observability.ts と
 * cron-cost-alert.ts に同じ関数が複製されており、#529 で 3 つ目のモデルが
 * 増えたときにどちらも更新されず、費用が両方で「分類不明」に落ちた。
 * モデルを足すときに直す場所を 1 つにする。
 */
export function featureOfModel(model: string): string | null {
  if (model === FERMENTATION_MODEL_ID) return '発酵';
  if (model === OCR_MODEL_ID) return 'OCR';
  if (model === PHOTO_TRANSCRIPTION_MODEL_ID) return '写真の文字起こし';
  return null;
}

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
