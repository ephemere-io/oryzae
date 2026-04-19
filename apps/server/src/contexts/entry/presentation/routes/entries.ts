import { createEntrySchema } from '@oryzae/shared';
import { Hono } from 'hono';
import { CreateEntryUsecase } from '../../application/usecases/create-entry.usecase.js';
import { DeleteEntryUsecase } from '../../application/usecases/delete-entry.usecase.js';
import { GetEntryUsecase } from '../../application/usecases/get-entry.usecase.js';
import { ListEntriesUsecase } from '../../application/usecases/list-entries.usecase.js';
import { SearchEntriesUsecase } from '../../application/usecases/search-entries.usecase.js';
import { UpdateEntryUsecase } from '../../application/usecases/update-entry.usecase.js';
import { SupabaseEntryRepository } from '../../infrastructure/repositories/supabase-entry.repository.js';
import { SupabaseEntrySnapshotRepository } from '../../infrastructure/repositories/supabase-entry-snapshot.repository.js';

type Env = {
  Variables: {
    userId: string;
    supabase: import('@supabase/supabase-js').SupabaseClient;
  };
};

const generateId = () => crypto.randomUUID();

export const entries = new Hono<Env>()
  .post('/', async (c) => {
    const body = createEntrySchema.parse(await c.req.json());
    const supabase = c.get('supabase');
    const entryRepo = new SupabaseEntryRepository(supabase);
    const snapshotRepo = new SupabaseEntrySnapshotRepository(supabase);
    const usecase = new CreateEntryUsecase(entryRepo, snapshotRepo, generateId);

    const entry = await usecase.execute(c.get('userId'), body);
    return c.json(entry, 201);
  })
  .get('/', async (c) => {
    const cursor = c.req.query('cursor');
    const limit = c.req.query('limit');
    const q = c.req.query('q');
    const supabase = c.get('supabase');
    const entryRepo = new SupabaseEntryRepository(supabase);
    const parsedLimit = limit ? Number(limit) : undefined;

    if (q) {
      const searchUsecase = new SearchEntriesUsecase(entryRepo);
      const result = await searchUsecase.execute(c.get('userId'), q, cursor, parsedLimit);
      return c.json(result);
    }

    const listUsecase = new ListEntriesUsecase(entryRepo);
    const result = await listUsecase.execute(c.get('userId'), cursor, parsedLimit);
    return c.json(result);
  })
  .get('/:id', async (c) => {
    const supabase = c.get('supabase');
    const entryRepo = new SupabaseEntryRepository(supabase);
    const snapshotRepo = new SupabaseEntrySnapshotRepository(supabase);
    const usecase = new GetEntryUsecase(entryRepo, snapshotRepo);

    const result = await usecase.execute(c.req.param('id'));
    if (!result) return c.json({ error: 'Not found' }, 404);
    return c.json(result);
  })
  .put('/:id', async (c) => {
    const body = createEntrySchema.parse(await c.req.json());
    const supabase = c.get('supabase');
    const entryRepo = new SupabaseEntryRepository(supabase);
    const snapshotRepo = new SupabaseEntrySnapshotRepository(supabase);
    const usecase = new UpdateEntryUsecase(entryRepo, snapshotRepo, generateId);

    const result = await usecase.execute(c.req.param('id'), body);
    return c.json(result);
  })
  .delete('/:id', async (c) => {
    const supabase = c.get('supabase');
    const entryRepo = new SupabaseEntryRepository(supabase);
    const usecase = new DeleteEntryUsecase(entryRepo);

    await usecase.execute(c.req.param('id'));
    return c.json({ ok: true });
  });
