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
 */
const COST_REPORT_URL = 'https://api.anthropic.com/v1/organizations/cost_report';
const ANTHROPIC_VERSION = '2023-06-01';

/** bucket_width='1d' のときの API 側の上限。これ以上は next_page で辿る。 */
const MAX_DAYS_PER_PAGE = 31;

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
 * `amount` は「最小通貨単位の 10 進文字列」= USD ならセント。
 * 例: "123.45" は $1.2345。ここでドルに直す。
 */
function toUsd(amount: unknown): number {
  if (typeof amount !== 'string') return 0;
  const cents = Number.parseFloat(amount);
  return Number.isFinite(cents) ? cents / 100 : 0;
}

function parseBuckets(payload: unknown): { buckets: DailyCost[]; nextPage: string | null } {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    return { buckets: [], nextPage: null };
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
  return { buckets, nextPage };
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

  try {
    // next_page が尽きるまで辿る。1 リクエスト最大 31 日なので月跨ぎでも数回で終わる。
    do {
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
      page = parsed.nextPage;
    } while (page);
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
