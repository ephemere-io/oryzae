import { Hono } from 'hono';
import { z } from 'zod';
import { CreateEntryUsecase } from '../../application/usecases/create-entry.usecase';
import { DeleteEntryUsecase } from '../../application/usecases/delete-entry.usecase';
import { GetEntryUsecase } from '../../application/usecases/get-entry.usecase';
import { ListEntriesUsecase } from '../../application/usecases/list-entries.usecase';
import { UpdateEntryUsecase } from '../../application/usecases/update-entry.usecase';
import { SupabaseEntryRepository } from '../../infrastructure/repositories/supabase-entry.repository';
import { SupabaseEntrySnapshotRepository } from '../../infrastructure/repositories/supabase-entry-snapshot.repository';

type Env = {
  Variables: {
    userId: string;
    supabase: import('@supabase/supabase-js').SupabaseClient;
  };
};

const createEntrySchema = z.object({
  content: z.string(),
  mediaUrls: z.array(z.string()).default([]),
  editorType: z.string(),
  editorVersion: z.string(),
  extension: z.record(z.unknown()).default({}),
});

const updateEntrySchema = createEntrySchema;

const generateId = () => crypto.randomUUID();

export const entries = new Hono<Env>();

entries.post('/', async (c) => {
  const body = createEntrySchema.parse(await c.req.json());
  const supabase = c.get('supabase');
  const entryRepo = new SupabaseEntryRepository(supabase);
  const snapshotRepo = new SupabaseEntrySnapshotRepository(supabase);
  const usecase = new CreateEntryUsecase(entryRepo, snapshotRepo, generateId);

  const entry = await usecase.execute(c.get('userId'), body);
  return c.json(entry, 201);
});

entries.get('/', async (c) => {
  const cursor = c.req.query('cursor');
  const limit = c.req.query('limit');
  const supabase = c.get('supabase');
  const entryRepo = new SupabaseEntryRepository(supabase);
  const usecase = new ListEntriesUsecase(entryRepo);

  const result = await usecase.execute(c.get('userId'), cursor, limit ? Number(limit) : undefined);
  return c.json(result);
});

entries.get('/:id', async (c) => {
  const supabase = c.get('supabase');
  const entryRepo = new SupabaseEntryRepository(supabase);
  const snapshotRepo = new SupabaseEntrySnapshotRepository(supabase);
  const usecase = new GetEntryUsecase(entryRepo, snapshotRepo);

  const result = await usecase.execute(c.req.param('id'));
  if (!result) return c.json({ error: 'Not found' }, 404);
  return c.json(result);
});

entries.put('/:id', async (c) => {
  const body = updateEntrySchema.parse(await c.req.json());
  const supabase = c.get('supabase');
  const entryRepo = new SupabaseEntryRepository(supabase);
  const snapshotRepo = new SupabaseEntrySnapshotRepository(supabase);
  const usecase = new UpdateEntryUsecase(entryRepo, snapshotRepo, generateId);

  const result = await usecase.execute(c.req.param('id'), body);
  return c.json(result);
});

entries.delete('/:id', async (c) => {
  const supabase = c.get('supabase');
  const entryRepo = new SupabaseEntryRepository(supabase);
  const usecase = new DeleteEntryUsecase(entryRepo);

  await usecase.execute(c.req.param('id'));
  return c.json({ ok: true });
});
