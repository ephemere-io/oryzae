import { createEntrySchema } from '@oryzae/shared';
import { Hono } from 'hono';
import { CreateEntryUsecase } from '../../application/usecases/create-entry.usecase.js';
import { DeleteEntryUsecase } from '../../application/usecases/delete-entry.usecase.js';
import { GetEntryUsecase } from '../../application/usecases/get-entry.usecase.js';
import { ListEntriesUsecase } from '../../application/usecases/list-entries.usecase.js';
import { ListEntryMonthlyCountsUsecase } from '../../application/usecases/list-entry-monthly-counts.usecase.js';
import { SearchEntriesUsecase } from '../../application/usecases/search-entries.usecase.js';
import { UpdateEntryUsecase } from '../../application/usecases/update-entry.usecase.js';
import { SupabaseEntryRepository } from '../../infrastructure/repositories/supabase-entry.repository.js';
import { SupabaseEntryLinkedQuestionsViewRepository } from '../../infrastructure/repositories/supabase-entry-linked-questions-view.repository.js';
import { SupabaseEntrySnapshotRepository } from '../../infrastructure/repositories/supabase-entry-snapshot.repository.js';
import { parseMonth, parseTzOffsetMinutes } from '../params.js';

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
    // Issue #331: 指定された問いに紐づく entry のみで絞り込む
    const questionId = c.req.query('questionId');
    // 作成日のソート順。未知の値は既定の 'newest'（新しい順）に丸める。
    const order = c.req.query('order') === 'oldest' ? 'oldest' : 'newest';
    // 書斎の一覧（docs/oryzae-study）用の月絞り。tzOffset は件数（monthly-counts）と
    // 同じものを受ける — 切り方が違うと手帳の厚みと一覧の件数が食い違う。
    const monthKey = parseMonth(c.req.query('month'));
    const month = monthKey
      ? { month: monthKey, tzOffsetMinutes: parseTzOffsetMinutes(c.req.query('tzOffset')) }
      : undefined;
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
          month,
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
  // 書斎の手帳（docs/oryzae-study）が読む月ごとの件数。
  //
  // **`/:id` より前に置くこと。** Hono は登録順に照合するので、後ろに置くと
  // id="monthly-counts" の 1 件取得として食われ、必ず 404 になる。
  .get('/monthly-counts', async (c) => {
    const supabase = c.get('supabase');
    const usecase = new ListEntryMonthlyCountsUsecase(new SupabaseEntryRepository(supabase));

    // created_at は UTC 保存、「月」は利用者のローカル暦月。オフセットを受けないと
    // JST の月初 00:00〜09:00 に書いた記録が前月の冊に落ちる。
    const counts = await usecase.execute(
      c.get('userId'),
      parseTzOffsetMinutes(c.req.query('tzOffset')),
    );
    return c.json(counts);
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
