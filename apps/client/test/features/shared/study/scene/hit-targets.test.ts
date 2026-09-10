import { describe, expect, it, vi } from 'vitest';
import {
  buildHitRegistry,
  HitRegistry,
  HOVER_SCALE,
  resolveClickTarget,
} from '@/features/shared/study/scene/hit-targets';
import type { Notebook } from '@/features/shared/study/types';

function notebook(month: string, current = false): Notebook {
  return { month, entryCount: 3, current };
}

const DESK = [notebook('2026-09', true), notebook('2026-08'), notebook('2026-07')];
const SHELF = [notebook('2026-06'), notebook('2026-05')];

describe('HitRegistry', () => {
  it('知らない id では null（未定義で落ちない）', () => {
    const registry = new HitRegistry();
    expect(registry.get('nope')).toBeNull();
    expect(registry.get(undefined)).toBeNull();
    expect(registry.get(null)).toBeNull();
  });

  it('clear で空になる', () => {
    const registry = buildHitRegistry({
      desk: DESK,
      shelf: SHELF,
      shelfAsSingleTarget: false,
    });
    registry.clear();
    expect(registry.ids()).toEqual([]);
  });
});

describe('buildHitRegistry', () => {
  const pc = buildHitRegistry({
    desk: DESK,
    shelf: SHELF,
    shelfAsSingleTarget: false,
  });

  it('瓶・机の冊・背表紙・ボードがすべて的になる', () => {
    expect(pc.get('jar')?.target).toEqual({ kind: 'jar' });
    expect(pc.get('board')?.target).toEqual({ kind: 'board' });
    expect(pc.get('notebook-0')).not.toBeNull();
    expect(pc.get('spine-0')).not.toBeNull();
  });

  it('当月の手帳は新規執筆、過去月はその月の一覧', () => {
    expect(pc.get('notebook-0')?.target).toEqual({ kind: 'journal-new' });
    expect(pc.get('notebook-1')?.target).toEqual({ kind: 'journal-month', month: '2026-08' });
  });

  it('背表紙はその月の一覧へ行く', () => {
    expect(pc.get('spine-0')?.target).toEqual({ kind: 'journal-month', month: '2026-06' });
    expect(pc.get('spine-1')?.target).toEqual({ kind: 'journal-month', month: '2026-05' });
  });

  it('封は的にしない（書斎から手紙の通知を外した）', () => {
    expect(pc.get('seal')).toBeNull();
  });

  it('SP は棚ごと 1 つの的（背表紙 1 本は指より細い）', () => {
    const sp = buildHitRegistry({
      desk: DESK,
      shelf: SHELF,
      shelfAsSingleTarget: true,
    });
    expect(sp.get('shelf')?.target).toEqual({ kind: 'archive' });
    // 背表紙単位の的は作らない（当たりを広げると隣の月を拾う）。
    expect(sp.get('spine-0')).toBeNull();
  });

  it('机が空でも瓶とボードは的として残る', () => {
    const empty = buildHitRegistry({
      desk: [],
      shelf: [],
      shelfAsSingleTarget: false,
    });
    expect(empty.get('jar')).not.toBeNull();
    expect(empty.get('board')).not.toBeNull();
  });

  it('冊にはツールチップ用の月が付く', () => {
    expect(pc.get('notebook-1')?.month).toBe('2026-08');
    expect(pc.get('spine-0')?.month).toBe('2026-06');
    expect(pc.get('jar')?.month).toBeNull();
  });

  it('ラベルの対応づけが対象と一致する', () => {
    expect(pc.get('jar')?.label).toBe('jar');
    expect(pc.get('notebook-0')?.label).toBe('journal');
    expect(pc.get('board')?.label).toBe('board');
    expect(pc.get('spine-0')?.label).toBe('archive');
  });

  it('id が重複しない', () => {
    const ids = pc.ids();
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('resolveClickTarget', () => {
  it('タッチで hovered が空でも、click 内の再レイキャストで拾う', () => {
    // pointermove が click より先に来ない端末がある。ここが本題。
    expect(resolveClickTarget(null, () => 'jar')).toBe('jar');
  });

  it('再レイキャストの結果を hovered より優先する', () => {
    // 指を滑らせて別の的の上で離した場合、hovered は古い。
    expect(resolveClickTarget('jar', () => 'board')).toBe('board');
  });

  it('再レイキャストが外れたら hovered に落とす', () => {
    expect(resolveClickTarget('jar', () => null)).toBe('jar');
  });

  it('どちらも無ければ null（何も起きない）', () => {
    expect(resolveClickTarget(null, () => null)).toBeNull();
  });

  it('必ず再レイキャストする（hovered に頼らない）', () => {
    const reRaycast = vi.fn(() => 'board');
    resolveClickTarget('jar', reRaycast);
    expect(reRaycast).toHaveBeenCalledTimes(1);
  });
});

describe('HOVER_SCALE', () => {
  it('ホバーはごく僅かに持ち上げるだけ', () => {
    expect(HOVER_SCALE).toBeGreaterThan(1);
    expect(HOVER_SCALE).toBeLessThan(1.1);
  });
});
