import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { SupabaseEntryRepository } from '@/contexts/entry/infrastructure/repositories/supabase-entry.repository.js';

const JST = -540;
const PAGE_SIZE = 1000;

interface Row {
  id: string;
  created_at: string;
}

/**
 * PostgREST の `.gt('id', cursor).order('id').limit(n)` を再現する最小スタブ。
 *
 * 本物と同じく **1 ページの上限を超えた分は返さない**。ここを再現しないと、
 * このテストが守りたい「1000 行で黙って打ち切られる」バグをそもそも再現できない。
 */
function createSupabase(rows: Row[], onQuery?: (cursor: string | null) => void) {
  const sorted = [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  function makeQuery(cursor: string | null) {
    const builder = {
      gt(_column: string, value: string) {
        return makeQuery(value);
      },
      order(_column: string, _opts: { ascending: boolean }) {
        return builder;
      },
      limit(n: number) {
        onQuery?.(cursor);
        const after = cursor === null ? sorted : sorted.filter((r) => r.id > cursor);
        return Promise.resolve({ data: after.slice(0, n), error: null });
      },
    };
    return builder;
  }

  const client = {
    from(_table: string) {
      return {
        select(_columns: string) {
          return {
            eq(_column: string, _value: string) {
              return makeQuery(null);
            },
          };
        },
      };
    },
  };
  // @type-assertion-allowed: SupabaseClient 全体は実装できないため、この経路が使う from/select/eq/gt/order/limit だけを持つスタブを渡す
  return client as unknown as SupabaseClient;
}

function rowsForMonth(month: string, count: number, startIndex: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    // id は時系列に並ばない前提だが、カーソル順を決めるためゼロ埋めの連番にする。
    id: `${startIndex + i}`.padStart(6, '0'),
    created_at: `${month}-15T03:00:00.000Z`,
  }));
}

describe('SupabaseEntryRepository.countByMonth', () => {
  it('月ごとに数え、新しい月から並べて返す', async () => {
    const repo = new SupabaseEntryRepository(
      createSupabase([
        ...rowsForMonth('2026-07', 2, 0),
        ...rowsForMonth('2026-09', 3, 100),
        ...rowsForMonth('2026-08', 1, 200),
      ]),
    );

    expect(await repo.countByMonth('u1')).toEqual([
      { month: '2026-09', count: 3 },
      { month: '2026-08', count: 1 },
      { month: '2026-07', count: 2 },
    ]);
  });

  it('記録が無ければ空配列（机が空になるだけで壊れない）', async () => {
    const repo = new SupabaseEntryRepository(createSupabase([]));
    expect(await repo.countByMonth('u1')).toEqual([]);
  });

  it('1000 行を超えても打ち切らずに全件数える', async () => {
    // 1 ページ目で終わったと誤判定すると 1000 になる。
    const rows = rowsForMonth('2026-09', PAGE_SIZE + 7, 0);
    const repo = new SupabaseEntryRepository(createSupabase(rows));

    expect(await repo.countByMonth('u1')).toEqual([{ month: '2026-09', count: 1007 }]);
  });

  it('ページングを id のカーソルで進める（offset ではない）', async () => {
    const cursors: (string | null)[] = [];
    const rows = rowsForMonth('2026-09', PAGE_SIZE + 1, 0);
    const repo = new SupabaseEntryRepository(createSupabase(rows, (c) => cursors.push(c)));

    await repo.countByMonth('u1');

    // 1 ページ目は cursor 無し、2 ページ目は直前ページの最大 id から続ける。
    expect(cursors).toEqual([null, '000999']);
  });

  it('tzOffset で月の境界がローカル暦月になる', async () => {
    // JST 2026-09-01 00:50 = 2026-08-31T15:50Z
    const repo = new SupabaseEntryRepository(
      createSupabase([{ id: '000001', created_at: '2026-08-31T15:50:00.000Z' }]),
    );

    expect(await repo.countByMonth('u1')).toEqual([{ month: '2026-08', count: 1 }]);
    expect(await repo.countByMonth('u1', JST)).toEqual([{ month: '2026-09', count: 1 }]);
  });

  it('壊れた created_at の行だけを捨てて集計を続ける', async () => {
    const repo = new SupabaseEntryRepository(
      createSupabase([
        { id: '000001', created_at: '2026-09-01T00:00:00.000Z' },
        { id: '000002', created_at: 'not-a-date' },
        { id: '000003', created_at: '2026-09-02T00:00:00.000Z' },
      ]),
    );

    expect(await repo.countByMonth('u1')).toEqual([{ month: '2026-09', count: 2 }]);
  });
});
