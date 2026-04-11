import {
  boardCardUpdateSchema,
  boardQuerySchema,
  boardSnippetCreateSchema,
  boardSnippetUpdateSchema,
} from '@oryzae/shared';
import { Hono } from 'hono';
import { SupabaseEntryRepository } from '../../../entry/infrastructure/repositories/supabase-entry.repository.js';
import { CreateBoardSnippetUsecase } from '../../application/usecases/create-board-snippet.usecase.js';
import { DeleteBoardSnippetUsecase } from '../../application/usecases/delete-board-snippet.usecase.js';
import { DeleteCardUsecase } from '../../application/usecases/delete-card.usecase.js';
import { LoadBoardUsecase } from '../../application/usecases/load-board.usecase.js';
import { SaveCardPositionsUsecase } from '../../application/usecases/save-card-positions.usecase.js';
import { UpdateBoardSnippetUsecase } from '../../application/usecases/update-board-snippet.usecase.js';
import { SupabaseBoardCardRepository } from '../../infrastructure/repositories/supabase-board-card.repository.js';
import { SupabaseBoardSnippetRepository } from '../../infrastructure/repositories/supabase-board-snippet.repository.js';

type Env = {
  Variables: {
    userId: string;
    supabase: import('@supabase/supabase-js').SupabaseClient;
  };
};

const generateId = () => crypto.randomUUID();

export const board = new Hono<Env>()
  // GET /api/v1/board?dateKey=YYYY-MM-DD
  .get('/', async (c) => {
    const { dateKey } = boardQuerySchema.parse({
      dateKey: c.req.query('dateKey'),
    });
    const supabase = c.get('supabase');
    const boardCardRepo = new SupabaseBoardCardRepository(supabase);
    const boardSnippetRepo = new SupabaseBoardSnippetRepository(supabase);
    const entryRepo = new SupabaseEntryRepository(supabase);
    const usecase = new LoadBoardUsecase(boardCardRepo, boardSnippetRepo, entryRepo, generateId);

    const result = await usecase.execute(c.get('userId'), dateKey);
    return c.json(result);
  })

  // PUT /api/v1/board/cards
  .put('/cards', async (c) => {
    const body = boardCardUpdateSchema.parse(await c.req.json());
    const supabase = c.get('supabase');
    const boardCardRepo = new SupabaseBoardCardRepository(supabase);
    const usecase = new SaveCardPositionsUsecase(boardCardRepo);

    await usecase.execute(body.cards);
    return c.json({ ok: true });
  })

  // DELETE /api/v1/board/cards/:id
  .delete('/cards/:id', async (c) => {
    const supabase = c.get('supabase');
    const boardCardRepo = new SupabaseBoardCardRepository(supabase);
    const usecase = new DeleteCardUsecase(boardCardRepo);

    await usecase.execute(c.req.param('id'), c.get('userId'));
    return c.json({ ok: true });
  })

  // POST /api/v1/board/snippets
  .post('/snippets', async (c) => {
    const body = boardSnippetCreateSchema.parse(await c.req.json());
    const supabase = c.get('supabase');
    const boardSnippetRepo = new SupabaseBoardSnippetRepository(supabase);
    const boardCardRepo = new SupabaseBoardCardRepository(supabase);
    const usecase = new CreateBoardSnippetUsecase(boardSnippetRepo, boardCardRepo, generateId);

    const result = await usecase.execute(c.get('userId'), body);
    return c.json(result, 201);
  })

  // PUT /api/v1/board/snippets/:id
  .put('/snippets/:id', async (c) => {
    const body = boardSnippetUpdateSchema.parse(await c.req.json());
    const supabase = c.get('supabase');
    const boardSnippetRepo = new SupabaseBoardSnippetRepository(supabase);
    const usecase = new UpdateBoardSnippetUsecase(boardSnippetRepo);

    await usecase.execute(c.req.param('id'), body.text);
    return c.json({ ok: true });
  })

  // DELETE /api/v1/board/snippets/:id
  .delete('/snippets/:id', async (c) => {
    const supabase = c.get('supabase');
    const boardSnippetRepo = new SupabaseBoardSnippetRepository(supabase);
    const boardCardRepo = new SupabaseBoardCardRepository(supabase);
    const usecase = new DeleteBoardSnippetUsecase(boardSnippetRepo, boardCardRepo);

    await usecase.execute(c.req.param('id'), c.get('userId'));
    return c.json({ ok: true });
  });
