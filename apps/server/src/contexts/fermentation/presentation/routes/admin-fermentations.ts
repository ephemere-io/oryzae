import type { SupabaseClient } from '@supabase/supabase-js';
import { gateway } from 'ai';
import { Hono } from 'hono';
import { RunFermentationUsecase } from '../../application/usecases/run-fermentation.usecase.js';
import { VercelAiAnalysisGateway } from '../../infrastructure/llm/vercel-ai-analysis.gateway.js';
import { SupabaseFermentationRepository } from '../../infrastructure/repositories/supabase-fermentation.repository.js';

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

    let listQuery = supabase
      .from('fermentation_results')
      .select(
        'id, user_id, question_id, entry_id, target_period, status, generation_id, error_message, created_at, updated_at',
        { count: 'exact' },
      );
    if (dateFrom) listQuery = listQuery.gte('created_at', dateFrom);
    if (dateTo) listQuery = listQuery.lte('created_at', `${dateTo}T23:59:59.999Z`);

    const { data, error, count } = await listQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return c.json({ error: error.message }, 500);

    return c.json({
      data: data ?? [],
      pagination: { page, limit, total: count ?? 0 },
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
    const [worksheetRes, snippetsRes, letterRes, keywordsRes] = await Promise.all([
      supabase.from('analysis_worksheets').select('*').eq('fermentation_result_id', id).single(),
      supabase.from('extracted_snippets').select('*').eq('fermentation_result_id', id),
      supabase.from('letters').select('*').eq('fermentation_result_id', id).single(),
      supabase.from('keywords').select('*').eq('fermentation_result_id', id),
    ]);

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

    return c.json({
      id: fermentation.id,
      userId: fermentation.user_id,
      questionId: fermentation.question_id,
      entryId: fermentation.entry_id,
      targetPeriod: fermentation.target_period,
      status: fermentation.status,
      generationId: fermentation.generation_id ?? null,
      errorMessage: fermentation.error_message ?? null,
      createdAt: fermentation.created_at,
      updatedAt: fermentation.updated_at,
      userEmail,
      questionText,
      cost,
      worksheet,
      snippets,
      letter,
      keywords,
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
  .get('/costs', async (c) => {
    const supabase = c.get('adminSupabase');
    const page = Number(c.req.query('page') ?? '1');
    const limit = Number(c.req.query('limit') ?? '50');
    const offset = (page - 1) * limit;
    const dateFrom = c.req.query('date_from');
    const dateTo = c.req.query('date_to');

    let costsQuery = supabase
      .from('fermentation_results')
      .select('id, user_id, status, generation_id, created_at', { count: 'exact' })
      .not('generation_id', 'is', null);
    if (dateFrom) costsQuery = costsQuery.gte('created_at', dateFrom);
    if (dateTo) costsQuery = costsQuery.lte('created_at', `${dateTo}T23:59:59.999Z`);

    const { data, error, count } = await costsQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return c.json({ error: error.message }, 500);

    const items = await Promise.all(
      (data ?? []).map(async (row) => {
        try {
          const info = await gateway.getGenerationInfo({ id: row.generation_id });
          return { ...row, cost: info };
        } catch {
          return { ...row, cost: null };
        }
      }),
    );

    return c.json({
      data: items,
      pagination: { page, limit, total: count ?? 0 },
    });
  })
  .post('/:id/retry', async (c) => {
    const supabase = c.get('adminSupabase');
    const id = c.req.param('id');

    // 1. Look up the failed fermentation
    const { data: fermentation, error: fetchError } = await supabase
      .from('fermentation_results')
      .select('id, user_id, question_id, entry_id, status')
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

    // 3. Fetch entry content
    const { data: entry } = await supabase
      .from('entries')
      .select('content')
      .eq('id', fermentation.entry_id)
      .single();

    if (!entry?.content) {
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
      entryId: fermentation.entry_id,
      entryContent: entry.content,
    });

    return c.json({ id: result.id }, 201);
  });
