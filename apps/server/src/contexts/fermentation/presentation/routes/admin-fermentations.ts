import type { SupabaseClient } from '@supabase/supabase-js';
import { gateway } from 'ai';
import { Hono } from 'hono';
import { z } from 'zod';
import { SupabaseEntryRepository } from '../../../entry/infrastructure/repositories/supabase-entry.repository.js';
import { SupabaseEntryQuestionLinkRepository } from '../../../question/infrastructure/repositories/supabase-entry-question-link.repository.js';
import { SupabaseQuestionRepository } from '../../../question/infrastructure/repositories/supabase-question.repository.js';
import { SupabaseQuestionTransactionRepository } from '../../../question/infrastructure/repositories/supabase-question-transaction.repository.js';
import { COLORS, notifyDiscord } from '../../../shared/infrastructure/discord-notify.js';
import { RunFermentationUsecase } from '../../application/usecases/run-fermentation.usecase.js';
import { ScheduledFermentationUsecase } from '../../application/usecases/scheduled-fermentation.usecase.js';
import { SendFermentationDigestUsecase } from '../../application/usecases/send-fermentation-digest.usecase.js';
import { ResendEmailNotifier } from '../../infrastructure/email/resend-email-notifier.js';
import { createSupabaseVerifiedEmailResolver } from '../../infrastructure/email/supabase-verified-email-resolver.js';
import { VercelAiAnalysisGateway } from '../../infrastructure/llm/vercel-ai-analysis.gateway.js';
import { SupabaseFermentationRepository } from '../../infrastructure/repositories/supabase-fermentation.repository.js';
import { getFermentationTargetDateKey } from './cron-target-date.js';

const triggerScheduledSchema = z.object({
  dateKey: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'dateKey must be in YYYY-MM-DD format')
    .optional(),
});

type Env = {
  Variables: {
    adminUserId: string;
    adminSupabase: SupabaseClient;
  };
};

export const adminFermentations = new Hono<Env>()
  .get('/costs/by-user', async (c) => {
    const supabase = c.get('adminSupabase');
    const dateFrom = c.req.query('date_from');
    const dateTo = c.req.query('date_to');

    let byUserQuery = supabase
      .from('fermentation_results')
      .select('user_id, generation_id')
      .not('generation_id', 'is', null);
    if (dateFrom) byUserQuery = byUserQuery.gte('created_at', dateFrom);
    if (dateTo) byUserQuery = byUserQuery.lte('created_at', `${dateTo}T23:59:59.999Z`);

    const { data, error } = await byUserQuery;

    if (error) return c.json({ error: error.message }, 500);

    const costsByUser = new Map<string, { count: number; totalCost: number }>();
    await Promise.all(
      (data ?? []).map(async (row) => {
        try {
          const info = await gateway.getGenerationInfo({ id: row.generation_id });
          const cost = typeof info?.totalCost === 'number' ? info.totalCost : 0;
          const current = costsByUser.get(row.user_id) ?? { count: 0, totalCost: 0 };
          current.count++;
          current.totalCost += cost;
          costsByUser.set(row.user_id, current);
        } catch {
          // skip failed lookups
        }
      }),
    );

    const { data: usersData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emailMap = new Map<string, string>();
    for (const u of usersData?.users ?? []) {
      emailMap.set(u.id, u.email ?? '');
    }

    const items = Array.from(costsByUser.entries())
      .map(([userId, stats]) => ({
        userId,
        email: emailMap.get(userId) ?? '',
        fermentationCount: stats.count,
        totalCostUsd: Math.round(stats.totalCost * 1000000) / 1000000,
      }))
      .sort((a, b) => b.totalCostUsd - a.totalCostUsd);

    return c.json({ data: items });
  })
  .get('/', async (c) => {
    const supabase = c.get('adminSupabase');
    const page = Number(c.req.query('page') ?? '1');
    const limit = Number(c.req.query('limit') ?? '50');
    const offset = (page - 1) * limit;
    const dateFrom = c.req.query('date_from');
    const dateTo = c.req.query('date_to');

    const userParam = c.req.query('user_id');
    const status = c.req.query('status');

    // Resolve email to user ID if needed
    let resolvedUserId = userParam;
    if (userParam && userParam.includes('@')) {
      const { data: usersLookup } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const matchedUser = (usersLookup?.users ?? []).find(
        (u) => u.email?.toLowerCase() === userParam.toLowerCase(),
      );
      resolvedUserId = matchedUser?.id ?? 'no-match';
    }

    let listQuery = supabase
      .from('fermentation_results')
      .select(
        'id, user_id, question_id, target_period, status, generation_id, error_message, created_at, updated_at',
        { count: 'exact' },
      );
    if (resolvedUserId) listQuery = listQuery.eq('user_id', resolvedUserId);
    if (status) listQuery = listQuery.eq('status', status);
    if (dateFrom) listQuery = listQuery.gte('created_at', dateFrom);
    if (dateTo) listQuery = listQuery.lte('created_at', `${dateTo}T23:59:59.999Z`);

    const { data, error, count } = await listQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return c.json({ error: error.message }, 500);

    // Resolve user emails
    const { data: usersData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emailMap = new Map<string, string>();
    for (const u of usersData?.users ?? []) {
      emailMap.set(u.id, u.email ?? '');
    }

    const items = (data ?? []).map((row) => ({
      ...row,
      user_email: emailMap.get(row.user_id) ?? '',
    }));

    return c.json({
      data: items,
      pagination: { page, limit, total: count ?? 0 },
    });
  })
  .get('/costs', async (c) => {
    const supabase = c.get('adminSupabase');
    const page = Number(c.req.query('page') ?? '1');
    const limit = Number(c.req.query('limit') ?? '30');
    const offset = (page - 1) * limit;
    const dateFrom = c.req.query('date_from');
    const dateTo = c.req.query('date_to');
    const userParam = c.req.query('user_id');

    // Resolve email to user ID if needed
    let resolvedUserId = userParam;
    if (userParam && userParam.includes('@')) {
      const { data: usersLookup } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const matchedUser = (usersLookup?.users ?? []).find(
        (u) => u.email?.toLowerCase() === userParam.toLowerCase(),
      );
      resolvedUserId = matchedUser?.id ?? 'no-match';
    }

    let costsQuery = supabase
      .from('fermentation_results')
      .select('id, user_id, status, generation_id, created_at', { count: 'exact' })
      .not('generation_id', 'is', null);
    if (resolvedUserId) costsQuery = costsQuery.eq('user_id', resolvedUserId);
    if (dateFrom) costsQuery = costsQuery.gte('created_at', dateFrom);
    if (dateTo) costsQuery = costsQuery.lte('created_at', `${dateTo}T23:59:59.999Z`);

    const { data, error, count } = await costsQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return c.json({ error: error.message }, 500);

    // Resolve user emails
    const { data: usersData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emailMap = new Map<string, string>();
    for (const u of usersData?.users ?? []) {
      emailMap.set(u.id, u.email ?? '');
    }

    const items = await Promise.all(
      (data ?? []).map(async (row) => {
        try {
          const info = await gateway.getGenerationInfo({ id: row.generation_id });
          return { ...row, user_email: emailMap.get(row.user_id) ?? '', cost: info };
        } catch {
          return { ...row, user_email: emailMap.get(row.user_id) ?? '', cost: null };
        }
      }),
    );

    return c.json({
      data: items,
      pagination: { page, limit, total: count ?? 0 },
    });
  })
  .get('/:id/cost', async (c) => {
    const supabase = c.get('adminSupabase');
    const id = c.req.param('id');

    const { data, error } = await supabase
      .from('fermentation_results')
      .select('generation_id')
      .eq('id', id)
      .single();

    if (error || !data) return c.json({ error: 'Fermentation result not found' }, 404);

    if (!data.generation_id) {
      return c.json({ error: 'No generation ID available for cost tracking' }, 404);
    }

    const info = await gateway.getGenerationInfo({ id: data.generation_id });

    return c.json({
      fermentationResultId: id,
      generationId: data.generation_id,
      cost: info,
    });
  })
  .get('/:id', async (c) => {
    const supabase = c.get('adminSupabase');
    const id = c.req.param('id');

    // 1. Fetch the fermentation result
    const { data: fermentation, error: fetchError } = await supabase
      .from('fermentation_results')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !fermentation) {
      return c.json({ error: 'Fermentation result not found' }, 404);
    }

    // 2. Fetch related data in parallel
    const [worksheetRes, snippetsRes, letterRes, keywordsRes, scannedRes] = await Promise.all([
      supabase.from('analysis_worksheets').select('*').eq('fermentation_result_id', id).single(),
      supabase.from('extracted_snippets').select('*').eq('fermentation_result_id', id),
      supabase.from('letters').select('*').eq('fermentation_result_id', id).single(),
      supabase.from('keywords').select('*').eq('fermentation_result_id', id),
      supabase
        .from('fermentation_scanned_entries')
        .select('entry_id, created_at')
        .eq('fermentation_result_id', id)
        .order('created_at', { ascending: true }),
    ]);

    // 2.5. Fetch entry details for scanned entries
    const scannedEntryIds = (scannedRes.data ?? []).map(
      (row: { entry_id: string }) => row.entry_id,
    );
    let scannedEntries: Array<{
      id: string;
      content: string;
      createdAt: string;
      updatedAt: string;
    }> = [];
    if (scannedEntryIds.length > 0) {
      const { data: entryRows } = await supabase
        .from('entries')
        .select('id, content, created_at, updated_at')
        .in('id', scannedEntryIds);
      const entryMap = new Map(
        (entryRows ?? []).map(
          (row: { id: string; content: string; created_at: string; updated_at: string }) => [
            row.id,
            row,
          ],
        ),
      );
      scannedEntries = scannedEntryIds.flatMap((entryId) => {
        const row = entryMap.get(entryId);
        if (!row) return [];
        return [
          {
            id: row.id,
            content: row.content,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          },
        ];
      });
    }

    // 3. Fetch cost info if generation_id exists
    let cost: unknown = null;
    if (fermentation.generation_id) {
      try {
        cost = await gateway.getGenerationInfo({ id: fermentation.generation_id });
      } catch {
        // skip failed cost lookups
      }
    }

    // 4. Fetch user email
    const { data: userData } = await supabase.auth.admin.getUserById(fermentation.user_id);
    const userEmail = userData?.user?.email ?? '';

    // 5. Fetch question text
    const { data: transactions } = await supabase
      .from('question_transactions')
      .select('string')
      .eq('question_id', fermentation.question_id)
      .eq('is_validated_by_user', true)
      .order('question_version', { ascending: false })
      .limit(1);
    const questionText = transactions?.[0]?.string ?? '';

    // 6. Build response
    const worksheet = worksheetRes.data
      ? {
          id: worksheetRes.data.id,
          fermentationResultId: worksheetRes.data.fermentation_result_id,
          worksheetMarkdown: worksheetRes.data.worksheet_markdown,
          resultDiagramMarkdown: worksheetRes.data.result_diagram_markdown,
          createdAt: worksheetRes.data.created_at,
          updatedAt: worksheetRes.data.updated_at,
        }
      : null;

    const snippets = (snippetsRes.data ?? []).map((row: Record<string, string>) => ({
      id: row.id,
      fermentationResultId: row.fermentation_result_id,
      snippetType: row.snippet_type,
      originalText: row.original_text,
      sourceDate: row.source_date,
      selectionReason: row.selection_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    const letter = letterRes.data
      ? {
          id: letterRes.data.id,
          fermentationResultId: letterRes.data.fermentation_result_id,
          bodyText: letterRes.data.body_text,
          createdAt: letterRes.data.created_at,
          updatedAt: letterRes.data.updated_at,
        }
      : null;

    const keywords = (keywordsRes.data ?? []).map((row: Record<string, string>) => ({
      id: row.id,
      fermentationResultId: row.fermentation_result_id,
      keyword: row.keyword,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    // Mask content if viewing another user's fermentation
    const adminUserId = c.get('adminUserId');
    const isOwner = fermentation.user_id === adminUserId;
    const MASKED = '[masked]';

    return c.json({
      id: fermentation.id,
      userId: fermentation.user_id,
      questionId: fermentation.question_id,
      targetPeriod: fermentation.target_period,
      status: fermentation.status,
      generationId: fermentation.generation_id ?? null,
      errorMessage: fermentation.error_message ?? null,
      createdAt: fermentation.created_at,
      updatedAt: fermentation.updated_at,
      userEmail,
      questionText: isOwner ? questionText : MASKED,
      cost,
      masked: !isOwner,
      worksheet: isOwner
        ? worksheet
        : worksheet
          ? {
              ...worksheet,
              worksheetMarkdown: MASKED,
              resultDiagramMarkdown: MASKED,
            }
          : null,
      snippets: isOwner
        ? snippets
        : snippets.map((s) => ({
            ...s,
            originalText: MASKED,
            selectionReason: MASKED,
          })),
      letter: isOwner ? letter : letter ? { ...letter, bodyText: MASKED } : null,
      keywords: isOwner ? keywords : keywords.map((k) => ({ ...k, description: MASKED })),
      scannedEntries: isOwner
        ? scannedEntries
        : scannedEntries.map((e) => ({ ...e, content: MASKED })),
    });
  })
  .post('/trigger-scheduled', async (c) => {
    const supabase = c.get('adminSupabase');
    const body = triggerScheduledSchema.parse(await c.req.json().catch(() => ({})));

    // 省略時は cron と同じ「JST 前日」
    const dateKey = body.dateKey ?? getFermentationTargetDateKey(new Date());

    const entryRepo = new SupabaseEntryRepository(supabase);
    const questionRepo = new SupabaseQuestionRepository(supabase);
    const questionTransactionRepo = new SupabaseQuestionTransactionRepository(supabase);
    const entryQuestionLinkRepo = new SupabaseEntryQuestionLinkRepository(supabase);
    const fermentationRepo = new SupabaseFermentationRepository(supabase);
    const llmGateway = new VercelAiAnalysisGateway();

    const listActiveUserIds = async (): Promise<string[]> => {
      const { data, error } = await supabase.from('entries').select('user_id').limit(1000);
      if (error) throw error;
      return [...new Set((data ?? []).map((row: { user_id: string }) => row.user_id))];
    };

    const digestUsecase = new SendFermentationDigestUsecase(
      new ResendEmailNotifier(),
      createSupabaseVerifiedEmailResolver(supabase),
    );

    const usecase = new ScheduledFermentationUsecase(
      entryRepo,
      questionRepo,
      questionTransactionRepo,
      entryQuestionLinkRepo,
      fermentationRepo,
      llmGateway,
      () => crypto.randomUUID(),
      listActiveUserIds,
      (userId, titles) => digestUsecase.execute({ userId, questionTitles: titles }),
    );

    const result = await usecase.execute(dateKey);

    // Notify Discord if there were failures
    if (result.failed > 0) {
      notifyDiscord({
        title: 'スケジュール発酵 — 失敗あり',
        color: COLORS.WARNING,
        fields: [
          { name: '対象日', value: dateKey, inline: true },
          { name: '成功', value: String(result.succeeded), inline: true },
          { name: '失敗', value: String(result.failed), inline: true },
          {
            name: 'エラー詳細',
            value:
              result.errors
                .slice(0, 3)
                .map((e) => `${e.userId.slice(0, 8)}: ${e.error.slice(0, 80)}`)
                .join('\n') || '-',
          },
        ],
      });
    }

    return c.json({ dateKey, ...result });
  })
  .post('/:id/retry', async (c) => {
    const supabase = c.get('adminSupabase');
    const id = c.req.param('id');

    // 1. Look up the failed fermentation
    const { data: fermentation, error: fetchError } = await supabase
      .from('fermentation_results')
      .select('id, user_id, question_id, status')
      .eq('id', id)
      .single();

    if (fetchError || !fermentation) {
      return c.json({ error: 'Fermentation result not found' }, 404);
    }
    if (fermentation.status !== 'failed') {
      return c.json({ error: 'Only failed fermentations can be retried' }, 400);
    }

    // 2. Fetch question text (latest validated transaction)
    const { data: transactions } = await supabase
      .from('question_transactions')
      .select('string, question_version, is_validated_by_user')
      .eq('question_id', fermentation.question_id)
      .eq('is_validated_by_user', true)
      .order('question_version', { ascending: false })
      .limit(1);

    const questionText = transactions?.[0]?.string ?? '';
    if (!questionText) {
      return c.json({ error: 'Question text not found' }, 404);
    }

    // 3. Fetch scanned entries (preserves what the original run saw)
    const { data: scannedRows } = await supabase
      .from('fermentation_scanned_entries')
      .select('entry_id, created_at')
      .eq('fermentation_result_id', id)
      .order('created_at', { ascending: true });
    const scannedEntryIds = (scannedRows ?? []).map((row: { entry_id: string }) => row.entry_id);
    if (scannedEntryIds.length === 0) {
      return c.json({ error: 'No scanned entries found for this fermentation' }, 404);
    }

    const { data: entryRows } = await supabase
      .from('entries')
      .select('id, content')
      .in('id', scannedEntryIds);
    const entryMap = new Map(
      (entryRows ?? []).map((row: { id: string; content: string }) => [row.id, row.content]),
    );
    const entries = scannedEntryIds
      .map((entryId) => ({ id: entryId, content: entryMap.get(entryId) ?? '' }))
      .filter((e) => e.content);
    if (entries.length === 0) {
      return c.json({ error: 'Entry content not found' }, 404);
    }

    // 4. Re-run fermentation
    const repo = new SupabaseFermentationRepository(supabase);
    const llmGateway = new VercelAiAnalysisGateway();
    const usecase = new RunFermentationUsecase(repo, llmGateway, () => crypto.randomUUID());

    const result = await usecase.execute({
      userId: fermentation.user_id,
      questionId: fermentation.question_id,
      questionText,
      entries,
    });

    // 5. Send digest email (fire-and-forget)
    const digestUsecase = new SendFermentationDigestUsecase(
      new ResendEmailNotifier(),
      createSupabaseVerifiedEmailResolver(supabase),
    );
    digestUsecase
      .execute({ userId: fermentation.user_id, questionTitles: [questionText] })
      .catch(() => {
        // Notification failure must not break retry response.
      });

    return c.json({ id: result.id }, 201);
  });
