import { jarLayoutUpdateSchema } from '@oryzae/shared';
import { Hono } from 'hono';
import { SupabaseQuestionRepository } from '../../../question/infrastructure/repositories/supabase-question.repository.js';
import { SaveJarLayoutUsecase } from '../../application/usecases/save-jar-layout.usecase.js';
import { SupabaseFermentationRepository } from '../../infrastructure/repositories/supabase-fermentation.repository.js';

type Env = {
  Variables: {
    userId: string;
    supabase: import('@supabase/supabase-js').SupabaseClient;
  };
};

export const jarLayout = new Hono<Env>().put('/', async (c) => {
  const body = jarLayoutUpdateSchema.parse(await c.req.json());
  const supabase = c.get('supabase');
  const usecase = new SaveJarLayoutUsecase(
    new SupabaseQuestionRepository(supabase),
    new SupabaseFermentationRepository(supabase),
  );
  await usecase.execute(body);
  return c.json({ ok: true });
});
