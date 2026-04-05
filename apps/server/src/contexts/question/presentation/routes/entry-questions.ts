import { Hono } from 'hono';
import { SupabaseEntryRepository } from '../../../entry/infrastructure/repositories/supabase-entry.repository.js';
import { LinkQuestionToEntryUsecase } from '../../application/usecases/link-question-to-entry.usecase.js';
import { ListEntryQuestionsUsecase } from '../../application/usecases/list-entry-questions.usecase.js';
import { UnlinkQuestionFromEntryUsecase } from '../../application/usecases/unlink-question-from-entry.usecase.js';
import { SupabaseEntryQuestionLinkRepository } from '../../infrastructure/repositories/supabase-entry-question-link.repository.js';
import { SupabaseQuestionRepository } from '../../infrastructure/repositories/supabase-question.repository.js';
import { SupabaseQuestionTransactionRepository } from '../../infrastructure/repositories/supabase-question-transaction.repository.js';

type Env = {
  Variables: {
    userId: string;
    supabase: import('@supabase/supabase-js').SupabaseClient;
  };
};

export const entryQuestions = new Hono<Env>()
  .get('/', async (c) => {
    const supabase = c.get('supabase');
    const linkRepo = new SupabaseEntryQuestionLinkRepository(supabase);
    const qRepo = new SupabaseQuestionRepository(supabase);
    const txRepo = new SupabaseQuestionTransactionRepository(supabase);
    const usecase = new ListEntryQuestionsUsecase(linkRepo, qRepo, txRepo);

    const entryId = c.req.param('entryId')!;
    const result = await usecase.execute(entryId);
    return c.json(result);
  })
  .post('/:questionId', async (c) => {
    const supabase = c.get('supabase');
    const linkRepo = new SupabaseEntryQuestionLinkRepository(supabase);
    const qRepo = new SupabaseQuestionRepository(supabase);
    const entryRepo = new SupabaseEntryRepository(supabase);
    const usecase = new LinkQuestionToEntryUsecase(linkRepo, qRepo, entryRepo);

    const entryId = c.req.param('entryId')!;
    const questionId = c.req.param('questionId')!;
    await usecase.execute(entryId, questionId);
    return c.json({ ok: true }, 201);
  })
  .delete('/:questionId', async (c) => {
    const supabase = c.get('supabase');
    const linkRepo = new SupabaseEntryQuestionLinkRepository(supabase);
    const usecase = new UnlinkQuestionFromEntryUsecase(linkRepo);

    const entryId = c.req.param('entryId')!;
    const questionId = c.req.param('questionId')!;
    await usecase.execute(entryId, questionId);
    return c.json({ ok: true });
  });
