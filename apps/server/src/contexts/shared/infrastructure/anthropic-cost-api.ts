/**
 * Anthropic Admin API の Cost Report から「実請求額」を取得する。
 *
 * issue #352 で Vercel AI Gateway → Anthropic 直叩きに切替えた結果、Gateway の
 * spend API (`gateway.getSpendReport`) には実績が一切入らなくなった。実額の正は
 * Anthropic の cost_report だけなので、コスト画面と日次レポートはここを参照する。
 *
 * ## 用途別の内訳も **実額** で取る（推定しない）
 *
 * `group_by[]=description` を付けると、各 result に `model` / `token_type` /
 * `service_tier` が入る。Oryzae は用途ごとに別モデルを使っている
 * （発酵 = claude-sonnet-4-6、OCR = claude-opus-5）ので、**モデル別の内訳が
 * そのまま用途別の実額**になる。自前でトークンを記録して単価を掛ける必要はない。
 *
 * これはキャッシュ読み書き・値引き・課金丸めも反映済みの実額なので、自前推定より
 * 正確でもある（`token_type` に cache_read / cache_creation が現れる）。
 *
 * 自前トークンからの推定 (claude-pricing.ts) が残っているのは **ユーザー別内訳**
 * のためだけ。Anthropic は Oryzae のユーザーを知らないので、その軸だけは実額で出せない。
 *
 * 仕様上の制約（docs/observability-guide.md にも記載）:
 *   - バケットは UTC 日固定（bucket_width=1d のみ）。JST 日での実額は取得できない。
 *   - amount は「最小通貨単位（セント）の10進文字列」。100 で割って USD にする。
 *   - 反映ラグは通常5分程度。直近数分の利用は載らないことがある。
 *   - Priority Tier のコストは cost_report に含まれない（Oryzae は standard のみ）。
 *   - cost_report の group_by は `description` / `workspace_id` のみ。api_key 別には
 *     割れないので、**同じ org の他の利用（CI のセキュリティレビュー等）は同じモデルの
 *     バケットに混ざる**。分離するには Anthropic Console で Workspace を分ける。
 */
const COST_REPORT_URL = 'https://api.anthropic.com/v1/organizations/cost_report';
/**
 * 実額の出典（人が見る側）。画面・通知からここへ飛ばして数字を突き合わせられるようにする。
 * Console はモデル別に加えて **API キー別** にも割れるので、この API より細かく見られる。
 */
export const ANTHROPIC_COST_CONSOLE_URL = 'https://platform.claude.com/cost';
const ANTHROPIC_VERSION = '2023-06-01';
const REQUEST_TIMEOUT_MS = 10_000;
/**
 * 1ページあたりのバケット数。**明示しないと既定 7 になる**（docs: "limit … default: 7,
 * maximum: 31"）。30 日分を取るのに api.anthropic.com へ逐次 5 往復していて、これが
 * コスト画面の待ち時間の主因だった。上限の 31 を渡せば 30 日は 1 往復で済む。
 */
const BUCKETS_PER_PAGE = 31;
// 暴走防止の上限。31バケット × 10ページ ≒ 10か月分まで取り切れる。
const MAX_PAGES = 10;

/**
 * 内訳が取れなかった行の受け皿。
 *
 * group_by が効かない・トークン以外のコスト（web_search 等）で model が null の場合に使う。
 * 落とさずここに積むことで、**内訳の合計は必ず総額と一致する**（テストで固定）。
 * 黙って捨てると「内訳を全部出した」ように見えて実際は欠けている状態になる。
 */
const UNGROUPED_MODEL_LABEL = '(内訳なし)';
const UNKNOWN_TOKEN_TYPE_LABEL = '(その他)';

interface DailyActualCost {
  /** UTC 日 (YYYY-MM-DD)。cost_report のバケットは UTC 固定。 */
  date: string;
  costUsd: number;
}

interface TokenTypeActualCost {
  /** cost_report の token_type（uncached_input_tokens / output_tokens / cache_read_input_tokens 等）。 */
  tokenType: string;
  costUsd: number;
}

export interface ModelActualCost {
  /** cost_report の model。トークン以外のコストや内訳なしの場合は代替ラベル。 */
  model: string;
  costUsd: number;
  /** 単価の内訳。キャッシュ読み書きが混ざっていれば token_type に現れる。 */
  byTokenType: TokenTypeActualCost[];
}

/**
 * 実額の取得結果。「未設定」と「$0」を区別できるようにユニオンで返す。
 * これを number | null に潰すと、キー未設定を $0 と誤表示してしまう
 * （まさに issue の「いつも0円」を再生産することになる）。
 */
export type ActualCostResult =
  | {
      kind: 'ok';
      totalCostUsd: number;
      daily: DailyActualCost[];
      /** モデル別の実額（コスト降順）。合計は totalCostUsd と一致する。 */
      byModel: ModelActualCost[];
      /**
       * `group_by[]` を送ったのに内訳が1件も返らなかった場合 true。
       *
       * 書式や仕様が変わって grouping が無視されると、results が1件に丸められ
       * `model` が null になる。**これは失敗しない**——総額は正しいまま内訳だけが
       * 静かに消えるので、フラグにして呼び出し側から見えるようにする。
       * `(内訳なし)` の行だけを見せると、モデル名の一種のように読めてしまう。
       */
      groupingUnavailable: boolean;
      /**
       * MAX_PAGES に達してページングを打ち切った場合 true（= 実額は過少）。
       * 打ち切りを黙って隠すと「途中までの合計」を完全な実請求額として
       * 表示してしまう。fermentation-cost-query.ts の truncated と同じ方針。
       */
      truncated: boolean;
    }
  | { kind: 'not-configured' }
  | { kind: 'error'; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** cost_report の amount はセント単位の10進文字列。数値化できなければ 0 扱い。 */
function parseAmountToUsd(amount: unknown): number {
  if (typeof amount !== 'string') return 0;
  const cents = Number(amount);
  return Number.isFinite(cents) ? cents / 100 : 0;
}

/** result 1件をどのモデルに積むか決める。model が無ければ cost_type、それも無ければ受け皿へ。 */
function modelKeyOf(item: Record<string, unknown>): string {
  if (typeof item.model === 'string' && item.model !== '') return item.model;
  // web_search / code_execution / session_usage はトークンではないので model が null。
  if (typeof item.cost_type === 'string' && item.cost_type !== '') return `(${item.cost_type})`;
  return UNGROUPED_MODEL_LABEL;
}

function tokenTypeKeyOf(item: Record<string, unknown>): string {
  if (typeof item.token_type === 'string' && item.token_type !== '') return item.token_type;
  return UNKNOWN_TOKEN_TYPE_LABEL;
}

interface ParsedBucket {
  daily: DailyActualCost;
  items: { modelKey: string; tokenTypeKey: string; costUsd: number }[];
}

function parseBucket(bucket: unknown): ParsedBucket | null {
  if (!isRecord(bucket)) return null;
  const startingAt = bucket.starting_at;
  if (typeof startingAt !== 'string') return null;
  const results = bucket.results;
  if (!Array.isArray(results)) return null;

  let costUsd = 0;
  const items: ParsedBucket['items'] = [];
  for (const item of results) {
    if (!isRecord(item)) continue;
    const itemCost = parseAmountToUsd(item.amount);
    costUsd += itemCost;
    items.push({
      modelKey: modelKeyOf(item),
      tokenTypeKey: tokenTypeKeyOf(item),
      costUsd: itemCost,
    });
  }
  return { daily: { date: startingAt.slice(0, 10), costUsd }, items };
}

/**
 * 指定期間の実請求額を取得する。
 *
 * @param startingAt 期間開始（この時刻以降に始まるバケットが対象。UTC 日境界に丸められる）
 * @param endingAt   期間終了（この時刻より前に終わるバケットが対象）
 */
export async function fetchActualCost(startingAt: Date, endingAt: Date): Promise<ActualCostResult> {
  const adminKey = process.env.ANTHROPIC_ADMIN_KEY;
  if (!adminKey) return { kind: 'not-configured' };

  const daily: DailyActualCost[] = [];
  const perModel = new Map<string, { costUsd: number; byTokenType: Map<string, number> }>();
  let page: string | undefined;
  let truncated = false;

  try {
    for (let i = 0; i < MAX_PAGES; i++) {
      const params = new URLSearchParams({
        starting_at: startingAt.toISOString(),
        ending_at: endingAt.toISOString(),
        bucket_width: '1d',
        limit: String(BUCKETS_PER_PAGE),
      });
      // 配列パラメータは `group_by[]`。これを付けないと results が1件に丸められ、
      // model / token_type が null になって用途別の内訳が出せない。
      params.append('group_by[]', 'description');
      if (page) params.set('page', page);

      const res = await fetch(`${COST_REPORT_URL}?${params.toString()}`, {
        headers: {
          'x-api-key': adminKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'User-Agent': 'Oryzae/1.0 (https://github.com/ephemere-io/oryzae)',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return {
          kind: 'error',
          message: `cost_report responded ${res.status}: ${body.slice(0, 200)}`,
        };
      }

      const body: unknown = await res.json();
      if (!isRecord(body) || !Array.isArray(body.data)) {
        return { kind: 'error', message: 'cost_report returned an unexpected shape' };
      }

      for (const bucket of body.data) {
        const parsed = parseBucket(bucket);
        if (!parsed) continue;
        daily.push(parsed.daily);
        for (const item of parsed.items) {
          const model = perModel.get(item.modelKey) ?? { costUsd: 0, byTokenType: new Map() };
          model.costUsd += item.costUsd;
          model.byTokenType.set(
            item.tokenTypeKey,
            (model.byTokenType.get(item.tokenTypeKey) ?? 0) + item.costUsd,
          );
          perModel.set(item.modelKey, model);
        }
      }

      if (body.has_more !== true || typeof body.next_page !== 'string') break;
      page = body.next_page;
      // 次ページがあるのに今回が最終イテレーションなら、この後打ち切られる。
      if (i === MAX_PAGES - 1) truncated = true;
    }

    const totalCostUsd = daily.reduce((sum, d) => sum + d.costUsd, 0);
    // 課金があるのに内訳キーが受け皿しか無い = grouping が効いていない。
    // 0 円の日は内訳が無くて当然なので、総額が正のときだけ判定する。
    const groupingUnavailable =
      totalCostUsd > 0 &&
      perModel.size > 0 &&
      Array.from(perModel.keys()).every((key) => key === UNGROUPED_MODEL_LABEL);
    const byModel: ModelActualCost[] = Array.from(perModel.entries())
      .map(([model, v]) => ({
        model,
        costUsd: v.costUsd,
        byTokenType: Array.from(v.byTokenType.entries())
          .map(([tokenType, cost]) => ({ tokenType, costUsd: cost }))
          .sort((a, b) => b.costUsd - a.costUsd),
      }))
      .sort((a, b) => b.costUsd - a.costUsd);

    return { kind: 'ok', totalCostUsd, daily, byModel, groupingUnavailable, truncated };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { kind: 'error', message };
  }
}

/** 実額を Discord / API に出すときの共通表記。未設定・失敗を $0 と混同させない。 */
export function formatActualCost(result: ActualCostResult): string {
  if (result.kind === 'ok') {
    const amount = `$${result.totalCostUsd.toFixed(4)}`;
    return result.truncated ? `${amount} (集計打ち切り・過少)` : amount;
  }
  if (result.kind === 'not-configured') return '未設定 (ANTHROPIC_ADMIN_KEY)';
  return `取得失敗: ${result.message.slice(0, 80)}`;
}
