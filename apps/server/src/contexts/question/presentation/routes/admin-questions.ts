import type { SupabaseClient } from '@supabase/supabase-js';
import { Hono } from 'hono';
import {
  evaluateQuestionEligibility,
  type FermentationLanguage,
} from '../../../fermentation/domain/services/fermentation-eligibility.service.js';

// admin dashboard 用 questions 一覧 (issue #287)。
// admin-fermentations.ts と同じく Supabase クエリを inline で組み立てる。
//
// 各行は問い単位 readiness を含む:
//   charScore = (この問いに紐づくエントリの文字数, この問いの直近成功発酵以降) / 言語別閾値
//   timeScore = (経過時間) / nextRandomHours (新規問いは 1.0)
//   readiness = min(charScore, timeScore)

type Env = {
  Variables: {
    adminUserId: string;
    adminSupabase: SupabaseClient;
  };
};

function resolveLanguage(meta: unknown): FermentationLanguage {
  if (meta && typeof meta === 'object' && 'locale' in meta) {
    // @type-assertion-allowed: 直前で 'locale' in meta を確認済み。値の型は unknown 扱い。
    const locale = (meta as { locale: unknown }).locale;
    if (locale === 'en') return 'en';
  }
  return 'ja';
}

export const adminQuestions = new Hono<Env>().get('/', async (c) => {
  const supabase = c.get('adminSupabase');
  const page = Number(c.req.query('page') ?? '1');
  const limit = Number(c.req.query('limit') ?? '50');
  const offset = (page - 1) * limit;
  const q = c.req.query('q')?.trim() ?? '';
  const userParam = c.req.query('user_id');
  const archived = c.req.query('archived'); // 'true' | 'false' | undefined

  // ユーザー一覧 (email/locale 解決のため一度だけ取得)
  const { data: usersData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const users = usersData?.users ?? [];
  const emailMap = new Map<string, string>();
  const localeMap = new Map<string, FermentationLanguage>();
  for (const u of users) {
    emailMap.set(u.id, u.email ?? '');
    localeMap.set(u.id, resolveLanguage(u.user_metadata));
  }

  // email → user_id 解決 (フィルタ用)
  let resolvedUserId = userParam;
  if (userParam?.includes('@')) {
    const matched = users.find((u) => u.email?.toLowerCase() === userParam.toLowerCase());
    resolvedUserId = matched?.id ?? 'no-match';
  }

  // 1. 問い文言検索: q が指定されたら question_transactions を先に当てて question_id を絞り込む。
  //    Postgres ilike で部分一致。最新 validated 版に限らずどの transaction でもヒットしたら拾う。
  let questionIdsFromSearch: Set<string> | null = null;
  if (q) {
    const { data: matchedTx, error: searchErr } = await supabase
      .from('question_transactions')
      .select('question_id')
      .ilike('string', `%${q}%`);
    if (searchErr) return c.json({ error: searchErr.message }, 500);
    questionIdsFromSearch = new Set(
      (matchedTx ?? []).map((r: { question_id: string }) => r.question_id),
    );
    if (questionIdsFromSearch.size === 0) {
      return c.json({ data: [], pagination: { page, limit, total: 0 } });
    }
  }

  // 2. questions ページネーション (id, user_id 等の基本列)
  let listQuery = supabase
    .from('questions')
    .select(
      'id, user_id, is_archived, is_validated_by_user, is_proposed_by_oryzae, created_at, updated_at',
      { count: 'exact' },
    );
  if (resolvedUserId) listQuery = listQuery.eq('user_id', resolvedUserId);
  if (archived === 'true') listQuery = listQuery.eq('is_archived', true);
  if (archived === 'false') listQuery = listQuery.eq('is_archived', false);
  if (questionIdsFromSearch) listQuery = listQuery.in('id', Array.from(questionIdsFromSearch));

  const { data, error, count } = await listQuery
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return c.json({ error: error.message }, 500);

  const rows = data ?? [];
  if (rows.length === 0) {
    return c.json({ data: [], pagination: { page, limit, total: count ?? 0 } });
  }

  const questionIds = rows.map((r) => r.id);
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));

  // 3. 最新 validated transaction を一括取得
  const { data: txData, error: txErr } = await supabase
    .from('question_transactions')
    .select('question_id, string, question_version, is_validated_by_user')
    .in('question_id', questionIds)
    .eq('is_validated_by_user', true)
    .order('question_version', { ascending: false });
  if (txErr) return c.json({ error: txErr.message }, 500);
  const latestTextMap = new Map<string, string>();
  for (const tx of txData ?? []) {
    if (!latestTextMap.has(tx.question_id)) {
      latestTextMap.set(tx.question_id, tx.string);
    }
  }

  // 4. nickname (profiles) を一括取得
  const { data: profilesData, error: profErr } = await supabase
    .from('profiles')
    .select('id, nickname')
    .in('id', userIds);
  if (profErr) return c.json({ error: profErr.message }, 500);
  const nicknameMap = new Map<string, string>();
  for (const p of profilesData ?? []) {
    if (p.nickname) nicknameMap.set(p.id, p.nickname);
  }

  // 5. UserFermentationState (nextRandomHours) を一括取得
  const { data: stateData, error: stateErr } = await supabase
    .from('user_fermentation_state')
    .select('user_id, next_random_hours')
    .in('user_id', userIds);
  if (stateErr) return c.json({ error: stateErr.message }, 500);
  const nextRandomHoursMap = new Map<string, number | null>();
  for (const s of stateData ?? []) {
    nextRandomHoursMap.set(
      s.user_id,
      s.next_random_hours == null ? null : Number(s.next_random_hours),
    );
  }

  // 6. 各問いの直近成功発酵時刻を一括取得 (status=completed)
  const { data: fermData, error: fermErr } = await supabase
    .from('fermentation_results')
    .select('question_id, user_id, created_at')
    .in('question_id', questionIds)
    .eq('status', 'completed')
    .order('created_at', { ascending: false });
  if (fermErr) return c.json({ error: fermErr.message }, 500);
  const lastRunAtMap = new Map<string, string>();
  for (const f of fermData ?? []) {
    if (!lastRunAtMap.has(f.question_id)) {
      lastRunAtMap.set(f.question_id, f.created_at);
    }
  }

  // 7. 各問いに紐づくエントリ (Supabase の埋め込み関係構文で entry_question_links → entries を join)
  //    fermentation_enabled は問わず、合計文字数を素直に積算する (admin 観察用なので閾値判定と同じ素材)。
  const { data: linkData, error: linkErr } = await supabase
    .from('entry_question_links')
    .select('question_id, entries (id, user_id, content, created_at)')
    .in('question_id', questionIds);
  if (linkErr) return c.json({ error: linkErr.message }, 500);

  const charsMap = new Map<string, number>();
  const now = new Date();
  for (const link of linkData ?? []) {
    // postgrest 埋め込みは関係 inference 次第で配列にも単数にもなりうるので両方受け取る。
    const entries = Array.isArray(link.entries) ? link.entries : link.entries ? [link.entries] : [];
    const cutoff = lastRunAtMap.get(link.question_id) ?? null;
    for (const entry of entries) {
      if (!entry.content) continue;
      if (cutoff && new Date(entry.created_at).getTime() <= new Date(cutoff).getTime()) continue;
      const chars = [...entry.content].length;
      charsMap.set(link.question_id, (charsMap.get(link.question_id) ?? 0) + chars);
    }
  }

  // 8. 各行に readiness を付与
  const items = rows.map((row) => {
    const language = localeMap.get(row.user_id) ?? 'ja';
    const readiness = evaluateQuestionEligibility({
      lastRunAt: lastRunAtMap.get(row.id) ?? null,
      charsSinceLastRun: charsMap.get(row.id) ?? 0,
      nextRandomHours: nextRandomHoursMap.get(row.user_id) ?? null,
      language,
      now,
    });
    const email = emailMap.get(row.user_id) ?? '';
    const nickname = nicknameMap.get(row.user_id) ?? '';
    return {
      id: row.id,
      user_id: row.user_id,
      user_email: email,
      user_nickname: nickname,
      text: latestTextMap.get(row.id) ?? '',
      is_archived: row.is_archived,
      is_validated_by_user: row.is_validated_by_user,
      is_proposed_by_oryzae: row.is_proposed_by_oryzae,
      created_at: row.created_at,
      updated_at: row.updated_at,
      readiness: {
        score: readiness.readinessScore,
        charScore: readiness.charScore,
        timeScore: readiness.timeScore,
        threshold: readiness.threshold,
        charsCurrent: readiness.charsCurrent,
        hoursElapsed: readiness.hoursElapsed,
        hoursRequired: readiness.hoursRequired,
        eligible: readiness.eligible,
        language,
      },
    };
  });

  return c.json({
    data: items,
    pagination: { page, limit, total: count ?? 0 },
  });
});
