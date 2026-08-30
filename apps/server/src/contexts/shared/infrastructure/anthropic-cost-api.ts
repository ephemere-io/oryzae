/**
 * Anthropic Admin API の Cost Report から「実請求額」を取得する。
 *
 * issue #352 で Vercel AI Gateway → Anthropic 直叩きに切替えた結果、Gateway の
 * spend API (`gateway.getSpendReport`) には実績が一切入らなくなった。実額の正は
 * Anthropic の cost_report だけなので、コスト画面と日次レポートはここを参照する。
 *
 * claude-pricing.ts の算出値は「自前トークン × 価格表」の *推定* であり、実額とは
 * 別物として扱うこと（キャッシュ読み書き・値引き・課金丸めを反映できないため）。
 * 推定はユーザー別内訳のように Anthropic 側が知り得ない軸でのみ使う。
 *
 * 仕様上の制約（docs/observability-guide.md にも記載）:
 *   - バケットは UTC 日固定（bucket_width=1d のみ）。JST 日での実額は取得できない。
 *   - amount は「最小通貨単位（セント）の10進文字列」。100 で割って USD にする。
 *   - 反映ラグは通常5分程度。直近数分の利用は載らないことがある。
 *   - Priority Tier のコストは cost_report に含まれない（Oryzae は standard のみ）。
 */
const COST_REPORT_URL = 'https://api.anthropic.com/v1/organizations/cost_report';
const ANTHROPIC_VERSION = '2023-06-01';
const REQUEST_TIMEOUT_MS = 10_000;
// 1リクエスト最大31バケット。暴走防止に上限を置く（31日 × 数ページで十分）。
const MAX_PAGES = 10;

interface DailyActualCost {
  /** UTC 日 (YYYY-MM-DD)。cost_report のバケットは UTC 固定。 */
  date: string;
  costUsd: number;
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

function parseBucket(bucket: unknown): DailyActualCost | null {
  if (!isRecord(bucket)) return null;
  const startingAt = bucket.starting_at;
  if (typeof startingAt !== 'string') return null;
  const results = bucket.results;
  if (!Array.isArray(results)) return null;

  let costUsd = 0;
  for (const item of results) {
    if (!isRecord(item)) continue;
    costUsd += parseAmountToUsd(item.amount);
  }
  return { date: startingAt.slice(0, 10), costUsd };
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
  let page: string | undefined;
  let truncated = false;

  try {
    for (let i = 0; i < MAX_PAGES; i++) {
      const params = new URLSearchParams({
        starting_at: startingAt.toISOString(),
        ending_at: endingAt.toISOString(),
        bucket_width: '1d',
      });
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
        if (parsed) daily.push(parsed);
      }

      if (body.has_more !== true || typeof body.next_page !== 'string') break;
      page = body.next_page;
      // 次ページがあるのに今回が最終イテレーションなら、この後打ち切られる。
      if (i === MAX_PAGES - 1) truncated = true;
    }

    const totalCostUsd = daily.reduce((sum, d) => sum + d.costUsd, 0);
    return { kind: 'ok', totalCostUsd, daily, truncated };
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
