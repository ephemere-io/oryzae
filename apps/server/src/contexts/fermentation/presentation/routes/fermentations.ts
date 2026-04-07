import { Hono } from 'hono';
import { z } from 'zod';
import { GetFermentationResultUsecase } from '../../application/usecases/get-fermentation-result.usecase.js';
import { ListFermentationResultsUsecase } from '../../application/usecases/list-fermentation-results.usecase.js';
import { RunFermentationUsecase } from '../../application/usecases/run-fermentation.usecase.js';
import { VercelAiAnalysisGateway } from '../../infrastructure/llm/vercel-ai-analysis.gateway.js';
import { SupabaseFermentationRepository } from '../../infrastructure/repositories/supabase-fermentation.repository.js';

type Env = {
  Variables: {
    userId: string;
    supabase: import('@supabase/supabase-js').SupabaseClient;
  };
};

const runFermentationSchema = z.object({
  entryId: z.string().uuid(),
  questionId: z.string().uuid(),
  questionText: z.string().min(1),
  entryContent: z.string().min(1),
});

const generateId = () => crypto.randomUUID();

export const fermentations = new Hono<Env>()
  .post('/', async (c) => {
    const body = runFermentationSchema.parse(await c.req.json());
    const supabase = c.get('supabase');
    const repo = new SupabaseFermentationRepository(supabase);
    const llmGateway = new VercelAiAnalysisGateway();
    const usecase = new RunFermentationUsecase(repo, llmGateway, generateId);

    const result = await usecase.execute({
      userId: c.get('userId'),
      questionId: body.questionId,
      questionText: body.questionText,
      entryId: body.entryId,
      entryContent: body.entryContent,
    });

    return c.json(result, 201);
  })
  .get('/', async (c) => {
    const questionId = c.req.query('questionId');
    if (!questionId) return c.json({ error: 'questionId is required' }, 400);

    const supabase = c.get('supabase');
    const repo = new SupabaseFermentationRepository(supabase);
    const usecase = new ListFermentationResultsUsecase(repo);

    const results = await usecase.execute(questionId);
    return c.json(results);
  })
  .get('/:id', async (c) => {
    const supabase = c.get('supabase');
    const repo = new SupabaseFermentationRepository(supabase);
    const usecase = new GetFermentationResultUsecase(repo);

    const detail = await usecase.execute(c.req.param('id'));
    return c.json({
      ...detail.result.toProps(),
      worksheet: detail.worksheet?.toProps() ?? null,
      snippets: detail.snippets.map((s) => s.toProps()),
      letter: detail.letter?.toProps() ?? null,
      keywords: detail.keywords.map((k) => k.toProps()),
    });
  });
