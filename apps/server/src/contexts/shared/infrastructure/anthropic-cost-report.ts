/**
 * Anthropic Admin API の Cost Report から実請求額を引く。
 *
 * 自前でトークン数 × 価格表を掛けるのをやめた理由（docs/entry-photo-guide.md にも記載）:
 * 価格表では次のどれも追えない。
 *   - キャッシュトークンの割引単価（cache_read は通常の約 1/10）
 *   - コンテキスト窓別の単価（0-200k と 200k-1M で違う）
 *   - service tier の割引（batch は 50% 引き）
 *   - 期間限定の導入価格や将来の価格改定
 * Cost Report が返すのは請求額そのものなので、これら全部が入っている。
 *
 * 認証は Admin API キー（`sk-ant-admin...`）を `x-api-key` に載せる。通常の
 * ANTHROPIC_API_KEY では 401 になる別物なので、env も別に持つ。
 * 未設定なら null を返し、呼び出し側は自前の概算にフォールバックする
 * （ローカル開発や未設定の環境で管理画面が落ちないようにするため）。
 *
 * 既知の制約:
 *   - **Priority Tier のコストはこのエンドポイントに含まれない**（公式ドキュメント記載）。
 *     Priority Tier を使い始めたらここの数字は過少になるので、usage_report 側の
 *     service_tier=priority と突き合わせる必要がある。いまは使っていない。
 *   - データ反映は API 呼び出しから概ね 5 分以内。
 *   - 推奨ポーリング頻度は毎分まで。いまの用途（管理画面 + 日次 cron）は十分下回る。
 */
const COST_REPORT_URL = 'https://api.anthropic.com/v1/organizations/cost_report';
const ANTHROPIC_VERSION = '2023-06-01';

/** bucket_width='1d' のときの API 側の上限。これ以上は next_page で辿る。 */
const MAX_DAYS_PER_PAGE = 31;

/**
 * 辿るページ数の上限。1 ページ最大 31 日なので、実用上は 2〜3 ページで終わる。
 * サーバーが壊れたカーソルを返し続けたときにハンドラを巻き込まないための保険。
 */
const MAX_PAGES = 12;

export interface DailyCost {
  /** YYYY-MM-DD（UTC）。 */
  date: string;
  amountUsd: number;
}

interface CostReportResult {
  amount?: unknown;
  currency?: unknown;
}

interface CostReportBucket {
  starting_at?: unknown;
  results?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * `amount` は **セント建て**の 10 進文字列なのでドルに直す。100 で割るのが正しい。
 *
 * ここは間違えると 100 倍ずれ、しかもテストでは検出できない（期待値も同じ前提で
 * 書かれるため）。レビューで繰り返し疑われたので、出典と検算を残しておく。
 *
 * 出典（2 つの独立したページが一致）:
 *   - https://platform.claude.com/docs/en/api/admin-api/usage-cost/get-cost-report
 *     "Cost amount in lowest currency units (e.g. cents) as a decimal string.
 *      For example, "123.45" in "USD" represents $1.23."
 *   - https://platform.claude.com/docs/en/manage-claude/usage-cost-api
 *     "All costs in USD, reported as decimal strings in lowest units (cents)"
 *
 * 上の例は**セント読みでしか成立しない**:
 *   セント読み … 123.45 セント = $1.2345 → 表示すると "$1.23" ✓
 *   ドル読み   … 123.45 ドル   = $123.45 → "$1.23" にならない ✗
 * つまり例の "$1.23" は $1.2345 をセント表示に丸めたもので、矛盾ではない。
 */
function toUsd(amount: unknown): number {
  if (typeof amount !== 'string') return 0;
  const cents = Number.parseFloat(amount);
  return Number.isFinite(cents) ? cents / 100 : 0;
}

function parseBuckets(payload: unknown): {
  buckets: DailyCost[];
  nextPage: string | null;
  hasMore: boolean;
} {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    return { buckets: [], nextPage: null, hasMore: false };
  }

  const buckets: DailyCost[] = [];
  for (const raw of payload.data) {
    if (!isRecord(raw)) continue;
    const bucket: CostReportBucket = raw;
    if (typeof bucket.starting_at !== 'string') continue;

    // 1 バケットに複数の cost item（モデル × トークン種別など）が入るので合算する。
    let amountUsd = 0;
    if (Array.isArray(bucket.results)) {
      for (const item of bucket.results) {
        if (!isRecord(item)) continue;
        const result: CostReportResult = item;
        amountUsd += toUsd(result.amount);
      }
    }
    buckets.push({ date: bucket.starting_at.slice(0, 10), amountUsd });
  }

  const nextPage = typeof payload.next_page === 'string' ? payload.next_page : null;
  // ドキュメントの手順は「has_more が true の間だけ next_page を辿る」。
  // next_page の有無だけで判定すると、has_more=false でカーソルが残っている
  // レスポンスに当たったとき同じページを取り続けて止まらなくなる。
  const hasMore = payload.has_more === true;
  return { buckets, nextPage, hasMore };
}

/**
 * 期間内の日次コストを返す。Admin キー未設定・API 失敗時は null
 * （呼び出し側が概算にフォールバックできるよう、例外にはしない）。
 */
export async function fetchDailyCosts(
  startingAt: string,
  endingAt: string,
): Promise<DailyCost[] | null> {
  const adminKey = process.env.ANTHROPIC_ADMIN_KEY;
  if (!adminKey) return null;

  const all: DailyCost[] = [];
  let page: string | null = null;
  const seenPages = new Set<string>();

  try {
    // has_more が false になるまで辿る。1 リクエスト最大 31 日なので月跨ぎでも数回で終わる。
    // MAX_PAGES と seenPages は、サーバーが同じカーソルを返し続けた場合の保険
    // （リクエストハンドラ内で無限ループさせない）。
    for (let fetched = 0; fetched < MAX_PAGES; fetched++) {
      const url = new URL(COST_REPORT_URL);
      url.searchParams.set('starting_at', startingAt);
      url.searchParams.set('ending_at', endingAt);
      url.searchParams.set('bucket_width', '1d');
      url.searchParams.set('limit', String(MAX_DAYS_PER_PAGE));
      if (page) url.searchParams.set('page', page);

      const res = await fetch(url, {
        headers: {
          'x-api-key': adminKey,
          'anthropic-version': ANTHROPIC_VERSION,
          // Anthropic が統合の利用状況を把握できるよう、ドキュメントで推奨されている。
          'User-Agent': 'Oryzae/1.0.0 (https://github.com/ephemere-io/oryzae)',
        },
      });

      if (!res.ok) {
        console.error('[anthropic-cost-report] request failed', {
          status: res.status,
          startingAt,
          endingAt,
        });
        return null;
      }

      const parsed = parseBuckets(await res.json());
      all.push(...parsed.buckets);

      if (!parsed.hasMore || !parsed.nextPage) break;
      if (seenPages.has(parsed.nextPage)) {
        console.error('[anthropic-cost-report] pagination cursor did not advance', {
          startingAt,
          endingAt,
        });
        break;
      }
      seenPages.add(parsed.nextPage);
      page = parsed.nextPage;
    }
  } catch (error) {
    console.error('[anthropic-cost-report] request threw', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }

  return all;
}

export function sumDailyCosts(costs: DailyCost[]): number {
  return costs.reduce((total, day) => total + day.amountUsd, 0);
}
