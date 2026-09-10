import {
  boardCardUpdateSchema,
  boardSnippetCreateSchema,
  boardSnippetUpdateSchema,
  MAX_OCR_IMAGE_BYTES,
  MAX_PHOTO_CAPTION_LENGTH,
} from '@oryzae/shared';
import { Hono } from 'hono';
import { rateLimitOcr } from '../../../shared/presentation/middleware/rate-limit.js';
import { CreateBoardPhotoUsecase } from '../../application/usecases/create-board-photo.usecase.js';
import { CreateBoardSnippetUsecase } from '../../application/usecases/create-board-snippet.usecase.js';
import { DeleteBoardPhotoUsecase } from '../../application/usecases/delete-board-photo.usecase.js';
import { DeleteBoardSnippetUsecase } from '../../application/usecases/delete-board-snippet.usecase.js';
import { DeleteCardUsecase } from '../../application/usecases/delete-card.usecase.js';
import { ExtractTextFromImageUsecase } from '../../application/usecases/extract-text-from-image.usecase.js';
import { LoadBoardUsecase } from '../../application/usecases/load-board.usecase.js';
import { SaveCardPositionsUsecase } from '../../application/usecases/save-card-positions.usecase.js';
import { SummarizeBoardUsecase } from '../../application/usecases/summarize-board.usecase.js';
import { UpdateBoardSnippetUsecase } from '../../application/usecases/update-board-snippet.usecase.js';
import { AnthropicOcrGateway } from '../../infrastructure/ocr/anthropic-ocr.gateway.js';
import { SupabaseBoardCardRepository } from '../../infrastructure/repositories/supabase-board-card.repository.js';
import { SupabaseBoardPhotoRepository } from '../../infrastructure/repositories/supabase-board-photo.repository.js';
import { SupabaseBoardSnippetRepository } from '../../infrastructure/repositories/supabase-board-snippet.repository.js';
import { SupabaseBoardStorageGateway } from '../../infrastructure/storage/supabase-board-storage.gateway.js';
import { parseDimension, parseWorldCoord } from '../params.js';

type Env = {
  Variables: {
    userId: string;
    supabase: import('@supabase/supabase-js').SupabaseClient;
  };
};

const generateId = () => crypto.randomUUID();

/** multipart の境界文字列・ヘッダ分の余裕。Content-Length は本文より必ず少し大きい。 */
const MULTIPART_OVERHEAD_BYTES = 8 * 1024;
const MAX_OCR_UPLOAD_BYTES = MAX_OCR_IMAGE_BYTES + MULTIPART_OVERHEAD_BYTES;

/** 書斎の壁に描くカードの上限（client の RENDER_LIMITS.maxBoardCards と同じ）。 */
const SUMMARY_LIMIT = 30;

export const board = new Hono<Env>()
  /**
   * 書斎の壁が読む「いま貼ってあるもの」。**`/:...` より前に置くこと。**
   *
   * 盤面（`GET /`）が全部を重なり順に返すのに対し、こちらは新しい順に上限まで。
   */
  .get('/summary', async (c) => {
    const supabase = c.get('supabase');
    const usecase = new SummarizeBoardUsecase(
      new SupabaseBoardCardRepository(supabase),
      new SupabaseBoardSnippetRepository(supabase),
      new SupabaseBoardPhotoRepository(supabase),
      new SupabaseBoardStorageGateway(supabase),
    );
    return c.json(await usecase.execute(c.get('userId'), SUMMARY_LIMIT));
  })
  // GET /api/v1/board — その人のボード（1 人に 1 枚。日付・表示単位では絞らない）
  .get('/', async (c) => {
    const supabase = c.get('supabase');
    const boardCardRepo = new SupabaseBoardCardRepository(supabase);
    const boardSnippetRepo = new SupabaseBoardSnippetRepository(supabase);
    const boardPhotoRepo = new SupabaseBoardPhotoRepository(supabase);
    const boardStorage = new SupabaseBoardStorageGateway(supabase);
    const usecase = new LoadBoardUsecase(
      boardCardRepo,
      boardSnippetRepo,
      boardPhotoRepo,
      boardStorage,
    );

    const result = await usecase.execute(c.get('userId'));
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

  // POST /api/v1/board/snippets/ocr (multipart/form-data)
  // 画像を読み取って本文だけ返す。スニペットはまだ作らない（ユーザーが確認・編集してから
  // POST /snippets を叩く）。
  .post('/snippets/ocr', rateLimitOcr(), async (c) => {
    // parseBody() は multipart 全体をメモリに載せるので、その前に Content-Length で
    // 明らかに大きいものを落とす。ヘッダは自己申告なので **早期打ち切りであって保証
    // ではない**（実サイズの判定は下の file.size と usecase 側）。境界文字列などの
    // multipart オーバーヘッド分だけ上限に余裕を持たせる。
    const declaredLength = Number(c.req.header('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_OCR_UPLOAD_BYTES) {
      return c.json({ error: `Image must be ${MAX_OCR_IMAGE_BYTES} bytes or less` }, 400);
    }

    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) {
      return c.json({ error: 'File is required' }, 400);
    }

    // arrayBuffer() で複製する前に実サイズで弾く。
    if (file.size > MAX_OCR_IMAGE_BYTES) {
      return c.json({ error: `Image must be ${MAX_OCR_IMAGE_BYTES} bytes or less` }, 400);
    }

    const usecase = new ExtractTextFromImageUsecase(new AnthropicOcrGateway());
    const result = await usecase.execute({
      image: await file.arrayBuffer(),
      mediaType: file.type,
    });
    return c.json(result);
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
    const imageWidth = parseDimension(body.imageWidth);
    const imageHeight = parseDimension(body.imageHeight);
    // 配置位置（world 座標）。multipart なので文字列で届く。
    // 壊れた値は無視してサーバー既定のランダム配置に落とす。
    const x = parseWorldCoord(body.x);
    const y = parseWorldCoord(body.y);
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
      imageWidth,
      imageHeight,
      x,
      y,
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
