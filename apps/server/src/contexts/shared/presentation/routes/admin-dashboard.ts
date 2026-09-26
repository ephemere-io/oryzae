import type { SupabaseClient } from '@supabase/supabase-js';
import { Hono } from 'hono';
import { fetchActualCost } from '../../infrastructure/anthropic-cost-api.js';

type Env = {
  Variables: {
    adminUserId: string;
    adminSupabase: SupabaseClient;
  };
};

/** `getTimezoneOffset()` 相当の分数。±14 時間を超える値は不正として 0 に落とす。 */
export function parseTzOffset(raw: string | undefined): number {
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || Math.abs(parsed) > 14 * 60) return 0;
  return parsed;
}

// 現在期間と「直前の同じ長さの期間」を解決する（リテンション比較用）。
// date_from/date_to は YYYY-MM-DD（セレクタ）。未指定時は直近7日 / now にフォールバック。
//
// Issue #367: セレクタで選んだ日を UTC の 00:00〜24:00 として扱っていたため、JST で見ると
// 期間が 9 時間ずれ、前日の夜と当日の夜が混ざった数が出ていた（ボードの日付境界と同じ問題）。
// 閲覧者のオフセットを受け取ってローカル暦日の区間に直す。
export function resolveActivityPeriods(
  dateFrom: string | undefined,
  dateTo: string | undefined,
  now: Date,
  tzOffsetMinutes = 0,
): { currentStart: string; currentEnd: string; previousStart: string; previousEnd: string } {
  const offsetMs = tzOffsetMinutes * 60_000;
  const currentStart = dateFrom
    ? new Date(Date.parse(`${dateFrom}T00:00:00.000Z`) + offsetMs)
    : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const currentEnd = dateTo ? new Date(Date.parse(`${dateTo}T23:59:59.999Z`) + offsetMs) : now;
  // 期間長（最低1日）。直前期間は [currentStart - 期間長, currentStart) とする。
  const periodMs = Math.max(currentEnd.getTime() - currentStart.getTime(), 24 * 60 * 60 * 1000);
  const previousEnd = new Date(currentStart.getTime() - 1);
  const previousStart = new Date(currentStart.getTime() - periodMs);
  return {
    currentStart: currentStart.toISOString(),
    currentEnd: currentEnd.toISOString(),
    previousStart: previousStart.toISOString(),
    previousEnd: previousEnd.toISOString(),
  };
}

/** PostgREST の 1 回のレスポンス上限。これを超えると黙って打ち切られる。 */
const PAGE_SIZE = 1000;

/**
 * 期間内に 1 件以上書いた人の user_id を、取りこぼさずに集める。
 *
 * Issue #367: `.select('user_id')` を 1 回投げるだけだったため、期間内のエントリが 1000 件を
 * 超えると PostgREST の既定上限で黙って打ち切られ、アクティブ数が過少になっていた。
 * エラーにならないので「なんとなく少ない」としか見えない種類の壊れ方だった。
 */
export async function collectWriterIds(
  supabase: SupabaseClient,
  startIso: string,
  endIso: string,
): Promise<string[]> {
  const ids: string[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('entries')
      .select('user_id')
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    for (const row of rows) {
      if (typeof row.user_id === 'string') ids.push(row.user_id);
    }
    if (rows.length < PAGE_SIZE) return ids;
  }
}

/**
 * 利用者数（アクティブ率の分母）。
 *
 * Issue #367: `auth.admin.listUsers({ perPage: 1000 })` は 1 ページしか読んでいないため
 * 1000 人で頭打ちになり、分母が止まった分だけアクティブ率が実際より高く出ていた。
 * profiles は signup 時に必ず 1 行できるので、こちらを exact count で数える。
 */
export async function countTotalUsers(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// 現在/直前期間の投稿者から、アクティブ数・直前アクティブ数・継続(両方に出現)数を数える。
export function countReturning(
  currentUserIds: string[],
  previousUserIds: string[],
): { activeWriters: number; previousActiveUsers: number; returningUsers: number } {
  const current = new Set(currentUserIds);
  const previous = new Set(previousUserIds);
  let returning = 0;
  for (const id of current) {
    if (previous.has(id)) returning++;
  }
  return {
    activeWriters: current.size,
    previousActiveUsers: previous.size,
    returningUsers: returning,
  };
}

export const adminDashboard = new Hono<Env>()
  .get('/stats', async (c) => {
    const supabase = c.get('adminSupabase');
    const dateFrom = c.req.query('date_from');
    const dateTo = c.req.query('date_to');

    type DateFilterable = {
      gte: (col: string, val: string) => DateFilterable;
      lte: (col: string, val: string) => DateFilterable;
    };
    const applyDateFilter = <T>(query: T): T => {
      // @type-assertion-allowed: Supabase 2.105 で `T extends { gte/lte... }` の generic 制約が型インスタンス化深度を超えて TS2589 を起こす。runtime は同じ method chain なので、generic を緩めて中で DateFilterable に narrow する。
      let q = query as unknown as DateFilterable;
      if (dateFrom) q = q.gte('created_at', dateFrom);
      if (dateTo) q = q.lte('created_at', `${dateTo}T23:59:59.999Z`);
      // @type-assertion-allowed: 上の理由と同じく、型を元の builder 型に戻す。runtime では同じオブジェクトの chain。
      return q as unknown as T;
    };

    const [totalUsers, entriesRes, allFermRes, completedRes, failedRes] = await Promise.all([
      // Issue #367: listUsers は 1 ページ 1000 人で頭打ちになる。profiles を数える。
      countTotalUsers(supabase),
      applyDateFilter(supabase.from('entries').select('id', { count: 'exact', head: true })),
      applyDateFilter(
        supabase.from('fermentation_results').select('id', { count: 'exact', head: true }),
      ),
      applyDateFilter(
        supabase
          .from('fermentation_results')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'completed'),
      ),
      applyDateFilter(
        supabase
          .from('fermentation_results')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'failed'),
      ),
    ]);

    return c.json({
      totalUsers,
      totalEntries: entriesRes.count ?? 0,
      totalFermentations: allFermRes.count ?? 0,
      completedFermentations: completedRes.count ?? 0,
      failedFermentations: failedRes.count ?? 0,
    });
  })
  .get('/failures-24h', async (c) => {
    const supabase = c.get('adminSupabase');

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('fermentation_results')
      .select('id, user_id, question_id, error_message, created_at')
      .eq('status', 'failed')
      .gt('created_at', since);

    if (error) return c.json({ error: error.message }, 500);

    const rows = data ?? [];

    // Group by user_id
    const grouped = new Map<
      string,
      {
        id: string;
        questionId: string;
        errorMessage: string | null;
        createdAt: string;
      }[]
    >();
    for (const row of rows) {
      const list = grouped.get(row.user_id) ?? [];
      list.push({
        id: row.id,
        questionId: row.question_id,
        errorMessage: row.error_message,
        createdAt: row.created_at,
      });
      grouped.set(row.user_id, list);
    }

    // Get user emails
    const { data: usersData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emailMap = new Map<string, string>();
    for (const u of usersData?.users ?? []) {
      emailMap.set(u.id, u.email ?? '');
    }

    const groups = Array.from(grouped.entries()).map(([userId, failures]) => ({
      userId,
      email: emailMap.get(userId) ?? '',
      failures,
    }));

    return c.json({ groups });
  })
  .get('/trends', async (c) => {
    const supabase = c.get('adminSupabase');
    const dateFromParam = c.req.query('date_from');
    const dateToParam = c.req.query('date_to');

    // Determine date range
    const endDate = dateToParam ? new Date(dateToParam) : new Date();
    const startDate = dateFromParam
      ? new Date(dateFromParam)
      : new Date(endDate.getTime() - 6 * 24 * 60 * 60 * 1000);

    // Build list of dates
    const dates: string[] = [];
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }

    // Fetch all data in the range at once (much faster than per-day queries)
    const rangeStart = `${dates[0]}T00:00:00.000Z`;
    const rangeEnd = `${dates[dates.length - 1]}T23:59:59.999Z`;

    const [fermRes, entriesRes] = await Promise.all([
      supabase
        .from('fermentation_results')
        .select('status, created_at')
        .gte('created_at', rangeStart)
        .lte('created_at', rangeEnd),
      supabase
        .from('entries')
        .select('user_id, created_at')
        .gte('created_at', rangeStart)
        .lte('created_at', rangeEnd),
    ]);

    const fermentations = fermRes.data ?? [];
    const entries = entriesRes.data ?? [];

    // Group by date
    const days = dates.map((dateStr) => {
      const dayFerms = fermentations.filter((f) => f.created_at.slice(0, 10) === dateStr);
      const dayEntries = entries.filter((e) => e.created_at.slice(0, 10) === dateStr);
      const total = dayFerms.length;
      const completed = dayFerms.filter((f) => f.status === 'completed').length;
      const uniqueWriters = new Set(dayEntries.map((e) => e.user_id));

      return {
        date: dateStr,
        totalFermentations: total,
        completedFermentations: completed,
        activeWriters: uniqueWriters.size,
      };
    });

    return c.json({ days });
  })
  // 今月の請求額と月末の見込み（Anthropic の実額だけ）。詳細は /admin/costs。
  // 実額が取れないときは推定で代用しない——発酵だけの推定を「今月のコスト」と並べると、
  // OCR・CI・Default Workspace の分が抜けた数字を全体として読ませてしまう。
  .get('/cost-summary', async (c) => {
    // 月境界は UTC（cost_report のバケットが UTC 日固定のため）。
    const now = new Date();
    const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const daysInMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
    ).getUTCDate();
    // 今日のバケットはまだ閉じていないので、経過日数は閉じた日だけ数える。
    const daysElapsed = Math.floor((now.getTime() - currentMonthStart.getTime()) / 86_400_000);

    const [current, last] = await Promise.all([
      fetchActualCost(currentMonthStart, now),
      fetchActualCost(lastMonthStart, currentMonthStart),
    ]);

    const round = (n: number) => Math.round(n * 1000000) / 1000000;
    const currentMonthCost = current.kind === 'ok' ? current.totalCostUsd : null;

    return c.json({
      // 未設定・取得失敗を $0 と区別できるよう status を必ず添える。
      status: current.kind,
      message: current.kind === 'error' ? current.message : null,
      currentMonthCost: currentMonthCost === null ? null : round(currentMonthCost),
      lastMonthCost: last.kind === 'ok' ? round(last.totalCostUsd) : null,
      projectedCost:
        currentMonthCost !== null && daysElapsed > 0
          ? round((currentMonthCost / daysElapsed) * daysInMonth)
          : null,
      daysElapsed,
      daysInMonth,
    });
  })
  .get('/user-activity', async (c) => {
    const supabase = c.get('adminSupabase');

    // 期間セレクタ (date_from/date_to) を尊重する。未指定時のみ直近7日にフォールバック。
    // 直前の同じ長さの期間も取り、継続(リテンション)ユーザーを算出する。
    const dateFrom = c.req.query('date_from');
    const dateTo = c.req.query('date_to');
    // 閲覧者のローカル暦日で期間を切る（未指定なら UTC 基準＝従来挙動）。
    const tzOffsetMinutes = parseTzOffset(c.req.query('tzOffset'));
    const periods = resolveActivityPeriods(dateFrom, dateTo, new Date(), tzOffsetMinutes);

    const [currentIds, previousIds, totalUsers] = await Promise.all([
      collectWriterIds(supabase, periods.currentStart, periods.currentEnd),
      collectWriterIds(supabase, periods.previousStart, periods.previousEnd),
      countTotalUsers(supabase),
    ]);

    const counts = countReturning(currentIds, previousIds);

    return c.json({
      activeWriters: counts.activeWriters,
      totalUsers,
      returningUsers: counts.returningUsers,
      previousActiveUsers: counts.previousActiveUsers,
    });
  });
