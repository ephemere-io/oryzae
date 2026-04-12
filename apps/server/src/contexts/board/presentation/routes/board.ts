import {
  boardCardUpdateSchema,
  boardQuerySchema,
  boardSnippetCreateSchema,
  boardSnippetUpdateSchema,
  MAX_PHOTO_CAPTION_LENGTH,
} from '@oryzae/shared';
import { Hono } from 'hono';
import { SupabaseEntryRepository } from '../../../entry/infrastructure/repositories/supabase-entry.repository.js';
import { CreateBoardPhotoUsecase } from '../../application/usecases/create-board-photo.usecase.js';
import { CreateBoardSnippetUsecase } from '../../application/usecases/create-board-snippet.usecase.js';
import { DeleteBoardPhotoUsecase } from '../../application/usecases/delete-board-photo.usecase.js';
import { DeleteBoardSnippetUsecase } from '../../application/usecases/delete-board-snippet.usecase.js';
import { DeleteCardUsecase } from '../../application/usecases/delete-card.usecase.js';
import { LoadBoardUsecase } from '../../application/usecases/load-board.usecase.js';
import { SaveCardPositionsUsecase } from '../../application/usecases/save-card-positions.usecase.js';
import { UpdateBoardSnippetUsecase } from '../../application/usecases/update-board-snippet.usecase.js';
import { SupabaseBoardCardRepository } from '../../infrastructure/repositories/supabase-board-card.repository.js';
import { SupabaseBoardPhotoRepository } from '../../infrastructure/repositories/supabase-board-photo.repository.js';
import { SupabaseBoardSnippetRepository } from '../../infrastructure/repositories/supabase-board-snippet.repository.js';
import { SupabaseBoardStorageGateway } from '../../infrastructure/storage/supabase-board-storage.gateway.js';

type Env = {
  Variables: {
    userId: string;
    supabase: import('@supabase/supabase-js').SupabaseClient;
  };
};

const generateId = () => crypto.randomUUID();

export const board = new Hono<Env>()
  // GET /api/v1/board?dateKey=YYYY-MM-DD&viewType=daily|weekly
  .get('/', async (c) => {
    const { dateKey } = boardQuerySchema.parse({
      dateKey: c.req.query('dateKey'),
    });
    const viewType = c.req.query('viewType') === 'weekly' ? 'weekly' : 'daily';
    const supabase = c.get('supabase');
    const boardCardRepo = new SupabaseBoardCardRepository(supabase);
    const boardSnippetRepo = new SupabaseBoardSnippetRepository(supabase);
    const boardPhotoRepo = new SupabaseBoardPhotoRepository(supabase);
    const boardStorage = new SupabaseBoardStorageGateway(supabase);
    const entryRepo = new SupabaseEntryRepository(supabase);
    const usecase = new LoadBoardUsecase(
      boardCardRepo,
      boardSnippetRepo,
      boardPhotoRepo,
      boardStorage,
      entryRepo,
      generateId,
    );

    const result = await usecase.execute(c.get('userId'), dateKey, viewType);
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
  })

  // POST /api/v1/board/photos (multipart/form-data)
  .post('/photos', async (c) => {
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) {
      return c.json({ error: 'File is required' }, 400);
    }

    const caption = typeof body.caption === 'string' ? body.caption : '';
    const dateKey = typeof body.dateKey === 'string' ? body.dateKey : '';
    const viewType = body.viewType === 'weekly' ? 'weekly' : 'daily';
    if (!dateKey.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return c.json({ error: 'Invalid dateKey' }, 400);
    }
    if (caption.length > MAX_PHOTO_CAPTION_LENGTH) {
      return c.json(
        { error: `Caption must be ${MAX_PHOTO_CAPTION_LENGTH} characters or less` },
        400,
      );
    }

    const supabase = c.get('supabase');
    const boardPhotoRepo = new SupabaseBoardPhotoRepository(supabase);
    const boardCardRepo = new SupabaseBoardCardRepository(supabase);
    const boardStorage = new SupabaseBoardStorageGateway(supabase);
    const usecase = new CreateBoardPhotoUsecase(
      boardPhotoRepo,
      boardCardRepo,
      boardStorage,
      generateId,
    );

    const arrayBuffer = await file.arrayBuffer();
    const result = await usecase.execute(c.get('userId'), {
      file: arrayBuffer,
      fileName: file.name,
      contentType: file.type,
      caption,
      dateKey,
      viewType,
    });
    return c.json(result, 201);
  })

  // DELETE /api/v1/board/photos/:id
  .delete('/photos/:id', async (c) => {
    const supabase = c.get('supabase');
    const boardPhotoRepo = new SupabaseBoardPhotoRepository(supabase);
    const boardCardRepo = new SupabaseBoardCardRepository(supabase);
    const boardStorage = new SupabaseBoardStorageGateway(supabase);
    const usecase = new DeleteBoardPhotoUsecase(boardPhotoRepo, boardCardRepo, boardStorage);

    await usecase.execute(c.req.param('id'), c.get('userId'));
    return c.json({ ok: true });
  });
