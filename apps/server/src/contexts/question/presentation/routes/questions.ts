import { Hono } from 'hono';
import { z } from 'zod';
import { CreateQuestionUsecase } from '../../application/usecases/create-question.usecase';
import { ListActiveQuestionsUsecase } from '../../application/usecases/list-active-questions.usecase';
import { ListAllQuestionsUsecase } from '../../application/usecases/list-all-questions.usecase';
import { ListPendingProposalsUsecase } from '../../application/usecases/list-pending-proposals.usecase';
import { GetQuestionUsecase } from '../../application/usecases/get-question.usecase';
import { EditQuestionUsecase } from '../../application/usecases/edit-question.usecase';
import { ArchiveQuestionUsecase } from '../../application/usecases/archive-question.usecase';
import { UnarchiveQuestionUsecase } from '../../application/usecases/unarchive-question.usecase';
import { AcceptQuestionProposalUsecase } from '../../application/usecases/accept-question-proposal.usecase';
import { RejectQuestionProposalUsecase } from '../../application/usecases/reject-question-proposal.usecase';
import { SupabaseQuestionRepository } from '../../infrastructure/repositories/supabase-question.repository';
import { SupabaseQuestionTransactionRepository } from '../../infrastructure/repositories/supabase-question-transaction.repository';

type Env = {
  Variables: {
    userId: string;
    supabase: import('@supabase/supabase-js').SupabaseClient;
  };
};

const questionStringSchema = z.object({
  string: z.string().min(1).max(64),
});

const generateId = () => crypto.randomUUID();

export const questions = new Hono<Env>();

// Static routes BEFORE /:id
questions.get('/all', async (c) => {
  const supabase = c.get('supabase');
  const qRepo = new SupabaseQuestionRepository(supabase);
  const txRepo = new SupabaseQuestionTransactionRepository(supabase);
  const usecase = new ListAllQuestionsUsecase(qRepo, txRepo);

  const result = await usecase.execute(c.get('userId'));
  return c.json(result);
});

questions.get('/pending', async (c) => {
  const supabase = c.get('supabase');
  const qRepo = new SupabaseQuestionRepository(supabase);
  const txRepo = new SupabaseQuestionTransactionRepository(supabase);
  const usecase = new ListPendingProposalsUsecase(qRepo, txRepo);

  const result = await usecase.execute(c.get('userId'));
  return c.json(result);
});

questions.post('/', async (c) => {
  const body = questionStringSchema.parse(await c.req.json());
  const supabase = c.get('supabase');
  const qRepo = new SupabaseQuestionRepository(supabase);
  const txRepo = new SupabaseQuestionTransactionRepository(supabase);
  const usecase = new CreateQuestionUsecase(qRepo, txRepo, generateId);

  const result = await usecase.execute(c.get('userId'), body);
  return c.json(result, 201);
});

questions.get('/', async (c) => {
  const supabase = c.get('supabase');
  const qRepo = new SupabaseQuestionRepository(supabase);
  const txRepo = new SupabaseQuestionTransactionRepository(supabase);
  const usecase = new ListActiveQuestionsUsecase(qRepo, txRepo);

  const result = await usecase.execute(c.get('userId'));
  return c.json(result);
});

questions.get('/:id', async (c) => {
  const supabase = c.get('supabase');
  const qRepo = new SupabaseQuestionRepository(supabase);
  const txRepo = new SupabaseQuestionTransactionRepository(supabase);
  const usecase = new GetQuestionUsecase(qRepo, txRepo);

  const result = await usecase.execute(c.req.param('id'));
  if (!result) return c.json({ error: 'Not found' }, 404);
  return c.json(result);
});

questions.put('/:id', async (c) => {
  const body = questionStringSchema.parse(await c.req.json());
  const supabase = c.get('supabase');
  const qRepo = new SupabaseQuestionRepository(supabase);
  const txRepo = new SupabaseQuestionTransactionRepository(supabase);
  const usecase = new EditQuestionUsecase(qRepo, txRepo, generateId);

  const result = await usecase.execute(c.req.param('id'), body);
  return c.json(result);
});

questions.post('/:id/archive', async (c) => {
  const supabase = c.get('supabase');
  const qRepo = new SupabaseQuestionRepository(supabase);
  const usecase = new ArchiveQuestionUsecase(qRepo);

  const result = await usecase.execute(c.req.param('id'));
  return c.json(result);
});

questions.post('/:id/unarchive', async (c) => {
  const supabase = c.get('supabase');
  const qRepo = new SupabaseQuestionRepository(supabase);
  const usecase = new UnarchiveQuestionUsecase(qRepo);

  const result = await usecase.execute(c.req.param('id'));
  return c.json(result);
});

questions.post('/:id/accept', async (c) => {
  const supabase = c.get('supabase');
  const qRepo = new SupabaseQuestionRepository(supabase);
  const txRepo = new SupabaseQuestionTransactionRepository(supabase);
  const usecase = new AcceptQuestionProposalUsecase(qRepo, txRepo);

  const result = await usecase.execute(c.req.param('id'));
  return c.json(result);
});

questions.post('/:id/reject', async (c) => {
  const supabase = c.get('supabase');
  const qRepo = new SupabaseQuestionRepository(supabase);
  const txRepo = new SupabaseQuestionTransactionRepository(supabase);
  const usecase = new RejectQuestionProposalUsecase(qRepo, txRepo);

  await usecase.execute(c.req.param('id'));
  return c.json({ ok: true });
});
