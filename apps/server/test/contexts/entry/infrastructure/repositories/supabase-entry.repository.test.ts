import { describe, expect, it } from 'vitest';
import { SupabaseEntryRepository } from '@/contexts/entry/infrastructure/repositories/supabase-entry.repository.js';

/**
 * countCharsByQuestionIdSince の「取りこぼさない」性質を、Supabase を模したスタブで固定する。
 *
 * なぜ実 DB でなくスタブか: 確かめたいのは SQL の意味ではなく **ページングと分割の算数**
 * （1000 行で止まっていないか / range が進むか / .in() を刻んでいるか）で、これは
 * リクエストの並びを見れば分かる。#502 で焼かれた「PostgREST 既定の 1000 行で黙って
 * 切られ、件数が増えるほど静かに過少になる」型は、まさにここでしか捕まらない。
 */

interface Recorded {
  table: string;
  range?: [number, number];
  inIds?: string[];
  gt?: [string, string];
  ordered?: string;
}

/**
 * 最小の Supabase スタブ。実装が使うメソッドだけ生やし、await されたら行を返す。
 * `linkRows` は問いに紐づく entry_id、`contentById` は entry の本文。
 */
function buildSupabase(linkRows: string[], contentById: Map<string, string>) {
  const calls: Recorded[] = [];

  function builder(table: string) {
    const rec: Recorded = { table };
    calls.push(rec);

    const resolve = () => {
      if (table === 'entry_question_links') {
        const [from, to] = rec.range ?? [0, linkRows.length - 1];
        return { data: linkRows.slice(from, to + 1).map((id) => ({ entry_id: id })), error: null };
      }
      const ids = rec.inIds ?? [];
      const rows = ids
        .filter((id) => contentById.has(id))
        .map((id) => ({ content: contentById.get(id) ?? null }));
      return { data: rows, error: null };
    };

    const chain = {
      select: () => chain,
      eq: () => chain,
      gt: (col: string, value: string) => {
        rec.gt = [col, value];
        return chain;
      },
      in: (_col: string, ids: string[]) => {
        rec.inIds = ids;
        return chain;
      },
      order: (col: string) => {
        rec.ordered = col;
        return chain;
      },
      range: (from: number, to: number) => {
        rec.range = [from, to];
        return chain;
      },
      // await されたときに解決する。本物の PostgrestBuilder も鎖のどの段でも await でき、
      // 実装は `.in()` の後にも `.gt()` の後にも await するので、thenable でないと模せない。
      // biome-ignore lint/suspicious/noThenProperty: Supabase の query builder を模すため thenable が必要
      then: (
        onfulfilled: (value: { data: unknown; error: unknown }) => unknown,
        onrejected?: (reason: unknown) => unknown,
      ) => Promise.resolve(resolve()).then(onfulfilled, onrejected),
    };
    return chain;
  }

  // @type-assertion-allowed: SupabaseClient の全面実装は不要。実装が呼ぶ from だけ備えたスタブ。
  const client = { from: (table: string) => builder(table) } as unknown as Parameters<
    typeof SupabaseEntryRepository.prototype.constructor
  >[0];
  return { client, calls };
}

function buildRepo(linkCount: number, charsPerEntry: number) {
  const linkRows = Array.from(
    { length: linkCount },
    (_, i) => `entry-${String(i).padStart(6, '0')}`,
  );
  const contentById = new Map(linkRows.map((id) => [id, 'あ'.repeat(charsPerEntry)]));
  const { client, calls } = buildSupabase(linkRows, contentById);
  return { repo: new SupabaseEntryRepository(client), calls, linkRows };
}

describe('SupabaseEntryRepository#countCharsByQuestionIdSince', () => {
  it('1000 件までは 1 ページで数える', async () => {
    const { repo, calls } = buildRepo(300, 10);

    expect(await repo.countCharsByQuestionIdSince('u1', 'q1', null)).toBe(3000);

    const linkCalls = calls.filter((c) => c.table === 'entry_question_links');
    expect(linkCalls).toHaveLength(1);
    expect(linkCalls[0].range).toEqual([0, 999]);
  });

  it('1000 件を超えても取りこぼさない（#502 と同じ暗黙の打ち切りを起こさない）', async () => {
    const { repo, calls } = buildRepo(2500, 10);

    // 打ち切られていれば 1000 件ぶん = 10,000 字で止まる。
    expect(await repo.countCharsByQuestionIdSince('u1', 'q1', null)).toBe(25_000);

    const linkCalls = calls.filter((c) => c.table === 'entry_question_links');
    // 1000 / 1000 / 500 の 3 ページ。最後が満杯でないので打ち止め。
    expect(linkCalls.map((c) => c.range)).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it('ちょうど 1000 件のときは次ページを引いて空を確認する（取りこぼし防止）', async () => {
    const { repo, calls } = buildRepo(1000, 1);

    expect(await repo.countCharsByQuestionIdSince('u1', 'q1', null)).toBe(1000);

    const linkCalls = calls.filter((c) => c.table === 'entry_question_links');
    // 1 ページ目が満杯なので、そこで止めると「実は 1001 件目があった」を見逃す。
    expect(linkCalls).toHaveLength(2);
  });

  it('ページングは順序を固定して引く（range だけでは行が重複・欠落しうる）', async () => {
    const { repo, calls } = buildRepo(1500, 1);
    await repo.countCharsByQuestionIdSince('u1', 'q1', null);

    for (const call of calls.filter((c) => c.table === 'entry_question_links')) {
      expect(call.ordered).toBe('entry_id');
    }
  });

  it('id は分割して投げる（URL のクエリ文字列に載るため）', async () => {
    const { repo, calls } = buildRepo(1200, 1);
    await repo.countCharsByQuestionIdSince('u1', 'q1', null);

    const entryCalls = calls.filter((c) => c.table === 'entries');
    expect(entryCalls.map((c) => c.inIds?.length)).toEqual([500, 500, 200]);
    // 分割しても全 id を一度ずつ問い合わせている（重複・欠落なし）。
    const asked = entryCalls.flatMap((c) => c.inIds ?? []);
    expect(new Set(asked).size).toBe(1200);
  });

  it('sinceIso を渡すと各チャンクに時刻の絞り込みが乗る', async () => {
    const { repo, calls } = buildRepo(600, 1);
    const since = '2026-09-01T00:00:00.000Z';
    await repo.countCharsByQuestionIdSince('u1', 'q1', since);

    const entryCalls = calls.filter((c) => c.table === 'entries');
    expect(entryCalls).toHaveLength(2);
    for (const call of entryCalls) {
      expect(call.gt).toEqual(['created_at', since]);
    }
  });

  it('紐づくエントリが無ければ entries を引かない', async () => {
    const { repo, calls } = buildRepo(0, 0);

    expect(await repo.countCharsByQuestionIdSince('u1', 'q1', null)).toBe(0);
    expect(calls.filter((c) => c.table === 'entries')).toHaveLength(0);
  });
});
