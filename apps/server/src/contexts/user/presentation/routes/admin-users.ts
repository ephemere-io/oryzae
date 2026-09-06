import type { SupabaseClient } from '@supabase/supabase-js';
import { Hono } from 'hono';
import { DeleteUserAdminUsecase } from '../../application/usecases/delete-user-admin.usecase.js';
import { SupabaseDeleteUserDataRepository } from '../../infrastructure/repositories/supabase-delete-user-data.repository.js';

type Env = {
  Variables: {
    adminUserId: string;
    adminSupabase: SupabaseClient;
  };
};

/** PostgREST の 1 レスポンス上限。これを超えると黙って打ち切られる。 */
const PAGE_SIZE = 1000;

/** 辿るページ数の上限。1000 行 × 200 = 20 万行。到達したら黙って返さず投げる。 */
const MAX_PAGES = 200;

/**
 * 指定カラムを全件読む。
 *
 * `.range()` を付けずに投げると PostgREST の既定上限（1000 行）で静かに打ち切られ、
 * 集計が実態より少なく出る（#367 と同じ壊れ方で、エラーにならないので「なんとなく
 * 少ない」としか見えない）。
 *
 * ページングは offset ではなく **id のカーソル**で進める。id は gen_random_uuid() で
 * 時系列に並ばないため、offset 方式だと読んでいる最中の INSERT が既読ページより前に
 * 入り込み、以降の行がずれて重複カウント・取りこぼしになる。`id > 直前の最大 id` で
 * 進めればその影響を受けない。
 *
 * 上限に達したら**投げる**。黙って部分結果を返すと、この関数が防ぐはずの
 * 「エラーにならないのに数字が少ない」状態を自分で作ってしまう。
 */
async function selectAllRows<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  userIds: string[],
  toRow: (raw: Record<string, unknown>) => T | null,
): Promise<T[]> {
  if (userIds.length === 0) return [];

  const rows: T[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const base = supabase
      .from(table)
      // id はカーソルに使うので、呼び出し側が要求していなくても必ず読む。
      // includes('id') では駄目（'user_id' が部分一致してしまい id が select されない）。
      .select(withIdColumn(columns))
      .in('user_id', userIds);
    // 絞り込みを先に積んでから order/limit を付ける（読み手にも自然な順序）。
    const filtered = cursor ? base.gt('id', cursor) : base;

    const { data, error } = await filtered.order('id', { ascending: true }).limit(PAGE_SIZE);
    if (error) throw new Error(error.message);

    const batch: unknown[] = data ?? [];
    let lastId: string | null = null;
    for (const raw of batch) {
      if (typeof raw !== 'object' || raw === null) continue;
      const record: Record<string, unknown> = { ...raw };
      const id = record.id;
      if (typeof id === 'string') lastId = id;
      const row = toRow(record);
      if (row) rows.push(row);
    }

    if (batch.length < PAGE_SIZE) return rows;
    if (!lastId) {
      // カーソルを進められないと同じページを取り続ける。止めて気づけるようにする。
      throw new Error(`${table}: could not advance pagination cursor (missing id)`);
    }
    cursor = lastId;
  }

  throw new Error(
    `${table}: exceeded ${MAX_PAGES * PAGE_SIZE} rows; aggregate would be incomplete`,
  );
}

/** select 句に `id` を必ず含める。列名を分割して**完全一致**で判定する。 */
function withIdColumn(columns: string): string {
  const names = columns.split(',').map((c) => c.trim());
  return names.includes('id') ? columns : `id, ${columns}`;
}

function readString(raw: Record<string, unknown>, key: string): string | null {
  const value = raw[key];
  return typeof value === 'string' ? value : null;
}

export const adminUsers = new Hono<Env>()
  .get('/', async (c) => {
    const supabase = c.get('adminSupabase');

    const { data: usersData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const users = usersData?.users ?? [];

    const userIds = users.map((u) => u.id);

    const [entryRows, questionRows, fermentationRows] = await Promise.all([
      // created_at も読むのは、最終活動日時（最後に書いた日）を出すため。
      selectAllRows(supabase, 'entries', 'user_id, created_at', userIds, (raw) => {
        const userId = readString(raw, 'user_id');
        return userId ? { userId, createdAt: readString(raw, 'created_at') } : null;
      }),
      selectAllRows(supabase, 'questions', 'user_id', userIds, (raw) => {
        const userId = readString(raw, 'user_id');
        return userId ? { userId } : null;
      }),
      selectAllRows(supabase, 'fermentation_results', 'user_id, status', userIds, (raw) => {
        const userId = readString(raw, 'user_id');
        return userId ? { userId, status: readString(raw, 'status') } : null;
      }),
    ]);

    const entryCounts = new Map<string, number>();
    /**
     * 最後にエントリーを書いた日時。「活動」を発酵で測らないのは、発酵が cron による
     * 自動実行で、本人が使っているかどうかを表さないため。
     */
    const lastActivity = new Map<string, string>();
    for (const row of entryRows) {
      entryCounts.set(row.userId, (entryCounts.get(row.userId) ?? 0) + 1);
      if (row.createdAt) {
        const current = lastActivity.get(row.userId);
        if (!current || row.createdAt > current) lastActivity.set(row.userId, row.createdAt);
      }
    }

    const questionCounts = new Map<string, number>();
    for (const row of questionRows) {
      questionCounts.set(row.userId, (questionCounts.get(row.userId) ?? 0) + 1);
    }

    const fermentationStats = new Map<
      string,
      { total: number; completed: number; failed: number }
    >();
    for (const row of fermentationRows) {
      const current = fermentationStats.get(row.userId) ?? { total: 0, completed: 0, failed: 0 };
      current.total++;
      if (row.status === 'completed') current.completed++;
      if (row.status === 'failed') current.failed++;
      fermentationStats.set(row.userId, current);
    }

    const result = users.map((u) => {
      const ferm = fermentationStats.get(u.id) ?? { total: 0, completed: 0, failed: 0 };
      return {
        id: u.id,
        email: u.email ?? '',
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        /** 最後にエントリーを書いた日時。一度も書いていなければ null。 */
        lastActivityAt: lastActivity.get(u.id) ?? null,
        entryCount: entryCounts.get(u.id) ?? 0,
        questionCount: questionCounts.get(u.id) ?? 0,
        fermentationTotal: ferm.total,
        fermentationCompleted: ferm.completed,
        fermentationFailed: ferm.failed,
      };
    });

    return c.json({ users: result });
  })
  .get('/:id', async (c) => {
    const supabase = c.get('adminSupabase');
    const userId = c.req.param('id');

    // 1. User profile from auth
    const {
      data: { user },
    } = await supabase.auth.admin.getUserById(userId);
    if (!user) return c.json({ error: 'User not found' }, 404);

    // 2. Entries (id, content length, created_at) - most recent 100
    const { data: entries } = await supabase
      .from('entries')
      .select('id, content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    // 3. Questions with latest transaction text
    const { data: questions } = await supabase
      .from('questions')
      .select('id, is_archived, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Get latest validated transaction for each question
    const questionIds = (questions ?? []).map((q: { id: string }) => q.id);
    const { data: transactions } =
      questionIds.length > 0
        ? await supabase
            .from('question_transactions')
            .select('question_id, string, question_version, is_validated_by_user')
            .in('question_id', questionIds)
            .eq('is_validated_by_user', true)
            .order('question_version', { ascending: false })
        : { data: [] };

    // Map latest text per question
    const latestTextMap = new Map<string, string>();
    for (const tx of transactions ?? []) {
      if (!latestTextMap.has(tx.question_id)) {
        latestTextMap.set(tx.question_id, tx.string);
      }
    }

    // 4. Fermentations
    const { data: fermentations } = await supabase
      .from('fermentation_results')
      .select('id, status, error_message, generation_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    // 5. Entry dates for heatmap (past 365 days)
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    const { data: entryDates } = await supabase
      .from('entries')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', yearAgo.toISOString());

    // Count entries per date
    const dateCountMap = new Map<string, number>();
    for (const e of entryDates ?? []) {
      const date = (e.created_at ?? '').slice(0, 10);
      dateCountMap.set(date, (dateCountMap.get(date) ?? 0) + 1);
    }

    return c.json({
      profile: {
        id: user.id,
        email: user.email ?? '',
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
      },
      entries: (entries ?? []).map(
        (e: { id: string; content: string | null; created_at: string }) => ({
          id: e.id,
          characterCount: (e.content ?? '').length,
          createdAt: e.created_at,
        }),
      ),
      questions: (questions ?? []).map(
        (q: { id: string; is_archived: boolean; created_at: string }) => ({
          id: q.id,
          text: latestTextMap.get(q.id) ?? '',
          isArchived: q.is_archived,
          createdAt: q.created_at,
        }),
      ),
      fermentations: (fermentations ?? []).map(
        (f: {
          id: string;
          status: string;
          error_message: string | null;
          generation_id: string | null;
          created_at: string;
        }) => ({
          id: f.id,
          status: f.status,
          errorMessage: f.error_message ?? null,
          hasGenerationId: !!f.generation_id,
          createdAt: f.created_at,
        }),
      ),
      entryDates: Array.from(dateCountMap.entries()).map(([date, count]) => ({ date, count })),
    });
  })
  // Issue #326: テストアカウントとその関連データを一括削除する。
  // Supabase Dashboard の Auth → Users 削除が "Database error deleting user" で
  // 失敗するケースに対応するため、CASCADE に頼らず public.* と storage を明示的に
  // 消してから auth.users を消す。
  .delete('/:id', async (c) => {
    const supabase = c.get('adminSupabase');
    const adminUserId = c.get('adminUserId');
    const targetUserId = c.req.param('id');

    const usecase = new DeleteUserAdminUsecase(new SupabaseDeleteUserDataRepository(supabase));
    const result = await usecase.execute({ targetUserId, requesterUserId: adminUserId });

    return c.json({ deleted: result });
  });
