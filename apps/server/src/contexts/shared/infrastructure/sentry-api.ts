import { z } from 'zod';

/**
 * Sentry の API から「いま本番で起きている未解決のエラー」を取得する。
 *
 * admin の Errors 画面が出すのは**トリアージに要る分だけ**（何が・どこで・何回・何人に・
 * いつから）。スタックトレース・パンくず・リプレイ・アラート設定は Sentry 側で見る
 * （各 issue の permalink から飛ぶ）。住み分けは docs/observability-guide.md。
 *
 * ## 読み取りと送信は別の設定
 *
 * - **送信**（アプリ → Sentry）: `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`。無いと何も届かない。
 * - **読み取り**（admin → Sentry API）: `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT`。
 *   ソースマップのアップロード用の Organization Token（`sntrys_`）は **issue を読めない**
 *   （スコープが org:ci だけ）。`event:read` を持つ User Auth Token が要る。
 *
 * 2026-09 までは DSN が未設定のまま、読み取り側だけ設定されていた。画面は常に
 * 「No unresolved errors」を出していて、壊れていないのか届いていないのか区別できなかった。
 * だから取得失敗を空配列に潰さず、`kind` で返す。
 */

const SENTRY_API = 'https://sentry.io/api/0';
const REQUEST_TIMEOUT_MS = 8_000;
/** 本番のエラーだけを見る。preview の失敗は開発中の揺れで、運用の判断材料ではない。 */
export const SENTRY_ENVIRONMENT = 'production';
const DAY_MS = 24 * 60 * 60 * 1000;
/** 直近 24 時間に初めて出た issue を「新規」として目立たせる。 */
const NEW_ISSUE_WINDOW_MS = DAY_MS;

// 外部 API の応答は信用せず、使う形だけを実行時に検証する。
const issueSchema = z.object({
  id: z.string(),
  shortId: z.string(),
  title: z.string(),
  culprit: z.string().nullable().optional(),
  level: z.string(),
  // Sentry は count を文字列で返す。
  count: z.union([z.string(), z.number()]),
  userCount: z.number(),
  firstSeen: z.string(),
  lastSeen: z.string(),
  permalink: z.string(),
  isUnhandled: z.boolean().optional(),
  // statsPeriod=14d を渡すと [unix 秒, 件数] の日別バケットが入る。
  stats: z.record(z.string(), z.array(z.tuple([z.number(), z.number()]))).optional(),
});

interface SentryIssue {
  id: string;
  shortId: string;
  title: string;
  /** 発生箇所（関数やルート）。Sentry が推定したもの。 */
  culprit: string;
  level: string;
  count: number;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  permalink: string;
  isUnhandled: boolean;
  /** 直近 24 時間に初めて出た。 */
  isNew: boolean;
}

export interface SentryDailyBucket {
  /** バケット開始（UTC 0:00）の YYYY-MM-DD。 */
  date: string;
  events: number;
}

export type SentryIssuesResult =
  | { kind: 'not-configured'; missing: string[] }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; issues: SentryIssue[]; daily: SentryDailyBucket[]; truncated: boolean };

const READ_ENV_NAMES = ['SENTRY_AUTH_TOKEN', 'SENTRY_ORG', 'SENTRY_PROJECT'] as const;
const LIMIT = 100;

/** Sentry の Web 上での issue 一覧（admin から深掘りに飛ばす先）。 */
export function sentryIssuesConsoleUrl(): string | null {
  const org = process.env.SENTRY_ORG;
  if (!org) return null;
  return `https://${org}.sentry.io/issues/?environment=${SENTRY_ENVIRONMENT}&query=is%3Aunresolved`;
}

export async function fetchSentryIssues(now: Date = new Date()): Promise<SentryIssuesResult> {
  const missing = READ_ENV_NAMES.filter((name) => !process.env[name]);
  const authToken = process.env.SENTRY_AUTH_TOKEN;
  const org = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;
  if (!authToken || !org || !project) return { kind: 'not-configured', missing };

  const params = new URLSearchParams({
    query: 'is:unresolved',
    environment: SENTRY_ENVIRONMENT,
    statsPeriod: '14d',
    sort: 'date',
    limit: String(LIMIT),
  });
  const url = `${SENTRY_API}/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}/issues/?${params}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${authToken}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown';
    return { kind: 'error', message: `Sentry に接続できませんでした (${reason})` };
  }

  if (res.status === 401 || res.status === 403) {
    return {
      kind: 'error',
      message: `Sentry が読み取りを拒否しました (HTTP ${res.status})。SENTRY_AUTH_TOKEN に event:read と project:read の権限が要ります（ソースマップ用の Organization Token では読めません）`,
    };
  }
  if (res.status === 404) {
    return {
      kind: 'error',
      message: `Sentry のプロジェクトが見つかりません (HTTP 404)。SENTRY_ORG / SENTRY_PROJECT を確認してください`,
    };
  }
  if (!res.ok) {
    return { kind: 'error', message: `Sentry の取得に失敗しました (HTTP ${res.status})` };
  }

  const parsed = z.array(issueSchema).safeParse(await res.json().catch(() => null));
  if (!parsed.success) {
    return { kind: 'error', message: 'Sentry の応答の形式が想定と違います' };
  }

  const issues = parsed.data.map((raw) => toIssue(raw, now));
  return {
    kind: 'ok',
    issues,
    daily: sumDailyEvents(parsed.data, now),
    truncated: parsed.data.length >= LIMIT,
  };
}

function toIssue(raw: z.infer<typeof issueSchema>, now: Date): SentryIssue {
  const firstSeenMs = Date.parse(raw.firstSeen);
  return {
    id: raw.id,
    shortId: raw.shortId,
    title: raw.title,
    culprit: raw.culprit ?? '',
    level: raw.level,
    count: Number(raw.count) || 0,
    userCount: raw.userCount,
    firstSeen: raw.firstSeen,
    lastSeen: raw.lastSeen,
    permalink: raw.permalink,
    isUnhandled: raw.isUnhandled ?? false,
    isNew: Number.isFinite(firstSeenMs) && now.getTime() - firstSeenMs <= NEW_ISSUE_WINDOW_MS,
  };
}

/**
 * issue ごとの日別バケットを日付で足し合わせ、直近 14 日の連続系列にする。
 * 未解決 issue のイベント数の合計であって、解決済みにした issue の分は入らない。
 */
export function sumDailyEvents(
  issues: ReadonlyArray<{ stats?: Record<string, Array<[number, number]>> }>,
  now: Date,
): SentryDailyBucket[] {
  const byDate = new Map<string, number>();
  for (const issue of issues) {
    for (const [ts, count] of issue.stats?.['14d'] ?? []) {
      const date = new Date(ts * 1000).toISOString().slice(0, 10);
      byDate.set(date, (byDate.get(date) ?? 0) + count);
    }
  }
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days: SentryDailyBucket[] = [];
  for (let i = 13; i >= 0; i--) {
    const date = new Date(today - i * DAY_MS).toISOString().slice(0, 10);
    days.push({ date, events: byDate.get(date) ?? 0 });
  }
  return days;
}
