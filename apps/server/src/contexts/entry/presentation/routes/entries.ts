import {
  ACCEPTED_IMAGE_MIME_TYPES,
  createEntrySchema,
  MAX_ENTRY_PHOTO_BYTES,
} from '@oryzae/shared';
import { Hono } from 'hono';
import { CreateEntryUsecase } from '../../application/usecases/create-entry.usecase.js';
import { DeleteEntryUsecase } from '../../application/usecases/delete-entry.usecase.js';
import { GetEntryUsecase } from '../../application/usecases/get-entry.usecase.js';
import { ListEntriesUsecase } from '../../application/usecases/list-entries.usecase.js';
import { SearchEntriesUsecase } from '../../application/usecases/search-entries.usecase.js';
import { TranscribeEntryPhotoUsecase } from '../../application/usecases/transcribe-entry-photo.usecase.js';
import { UpdateEntryUsecase } from '../../application/usecases/update-entry.usecase.js';
import { UploadEntryPhotoUsecase } from '../../application/usecases/upload-entry-photo.usecase.js';
import { AnthropicPhotoTranscriptionGateway } from '../../infrastructure/llm/anthropic-photo-transcription.gateway.js';
import { SupabaseEntryRepository } from '../../infrastructure/repositories/supabase-entry.repository.js';
import { SupabaseEntryLinkedQuestionsViewRepository } from '../../infrastructure/repositories/supabase-entry-linked-questions-view.repository.js';
import { SupabaseEntrySnapshotRepository } from '../../infrastructure/repositories/supabase-entry-snapshot.repository.js';
import { SupabaseEntryStorageGateway } from '../../infrastructure/storage/supabase-entry-storage.gateway.js';

type Env = {
  Variables: {
    userId: string;
    supabase: import('@supabase/supabase-js').SupabaseClient;
  };
};

const generateId = () => crypto.randomUUID();

/** 受理する画像形式か。Anthropic の vision が受理するものに合わせてある。 */
function isAcceptedImageType(contentType: string): boolean {
  return ACCEPTED_IMAGE_MIME_TYPES.some((accepted) => accepted === contentType);
}

type ImageFormResult = { ok: true; file: File } | { ok: false; message: string };

/**
 * multipart の `file` を取り出し、形式とサイズを検証する。
 * 画像は Anthropic に送られる（文字起こし）ので、素通しさせない。
 */
function parseImageForm(value: unknown): ImageFormResult {
  if (!(value instanceof File)) {
    return { ok: false, message: 'File is required' };
  }
  if (!isAcceptedImageType(value.type)) {
    return {
      ok: false,
      message: `Unsupported image type: ${value.type || 'unknown'}. Accepted: ${ACCEPTED_IMAGE_MIME_TYPES.join(', ')}`,
    };
  }
  if (value.size > MAX_ENTRY_PHOTO_BYTES) {
    return { ok: false, message: `Image must be ${MAX_ENTRY_PHOTO_BYTES} bytes or less` };
  }
  return { ok: true, file: value };
}

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
  // POST /api/v1/entries/photos (multipart/form-data)
  // 写真を Storage に保管して公開 URL を返すだけ。エントリへの紐づけは、本文の保存時に
  // クライアントが mediaUrls として送ることで行う（下書き中の写真で孤児エントリを作らない）。
  .post('/photos', async (c) => {
    const body = await c.req.parseBody();
    const parsed = parseImageForm(body.file);
    if (!parsed.ok) return c.json({ error: parsed.message }, 400);

    const usecase = new UploadEntryPhotoUsecase(new SupabaseEntryStorageGateway(c.get('supabase')));
    // storagePath を entries.media_urls に保存し、signedUrl は表示だけに使う。
    const result = await usecase.execute(c.get('userId'), {
      file: await parsed.file.arrayBuffer(),
      fileName: parsed.file.name,
      contentType: parsed.file.type,
    });
    return c.json(result, 201);
  })
  // POST /api/v1/entries/photos/transcribe (multipart/form-data)
  // 写真から文字を起こして返す。保存はしない（ユーザーが確認してから本文に入れる）。
  // 1リクエストが実費なので app.ts で ocr ティアのレート制限を重ねている。
  .post('/photos/transcribe', async (c) => {
    const body = await c.req.parseBody();
    const parsed = parseImageForm(body.file);
    if (!parsed.ok) return c.json({ error: parsed.message }, 400);

    const language = typeof body.language === 'string' && body.language ? body.language : 'ja';
    const usecase = new TranscribeEntryPhotoUsecase(new AnthropicPhotoTranscriptionGateway());
    const result = await usecase.execute({
      file: await parsed.file.arrayBuffer(),
      contentType: parsed.file.type,
      language,
    });

    return c.json({ text: result.text });
  })
  .get('/', async (c) => {
    const cursor = c.req.query('cursor');
    const limit = c.req.query('limit');
    const q = c.req.query('q');
    // Issue #331: 指定された問いに紐づく entry のみで絞り込む
    const questionId = c.req.query('questionId');
    // 作成日のソート順。未知の値は既定の 'newest'（新しい順）に丸める。
    const order = c.req.query('order') === 'oldest' ? 'oldest' : 'newest';
    const supabase = c.get('supabase');
    const entryRepo = new SupabaseEntryRepository(supabase);
    const parsedLimit = limit ? Number(limit) : undefined;

    const entries = q
      ? await new SearchEntriesUsecase(entryRepo).execute(
          c.get('userId'),
          q,
          cursor,
          parsedLimit,
          questionId,
          order,
        )
      : await new ListEntriesUsecase(entryRepo).execute(
          c.get('userId'),
          cursor,
          parsedLimit,
          questionId,
          order,
        );

    // Issue #323: 一覧に紐づく問いを表示。entry-context-isolation を守るため
    // question テーブルへの問い合わせは entry/infrastructure の view repository が
    // 直接 supabase から読み出す (user-me が UserActivityStatsRepository で取る
    // のと同じ Bounded Context の妥協パターン)。
    const linkedQuestionsView = new SupabaseEntryLinkedQuestionsViewRepository(supabase);
    const linkedByEntry = await linkedQuestionsView.listByEntryIds(entries.map((e) => e.id));

    const result = entries.map((entry) => ({
      ...entry,
      linkedQuestions: linkedByEntry[entry.id] ?? [],
    }));
    return c.json(result);
  })
  .get('/:id', async (c) => {
    const supabase = c.get('supabase');
    const entryRepo = new SupabaseEntryRepository(supabase);
    const snapshotRepo = new SupabaseEntrySnapshotRepository(supabase);
    const usecase = new GetEntryUsecase(
      entryRepo,
      snapshotRepo,
      new SupabaseEntryStorageGateway(supabase),
    );

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
