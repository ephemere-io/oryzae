import { describe, expect, it } from 'vitest';
import { canDragSheet, contentScrolls } from '@/components/ui/sheet-gesture';

// シートの外側（板の段）と内側（中身の送り）の段階構造。実機で 20 回以上壊れたところなので、
// 表のまま固める（`sheet-gesture.ts` の表と 1 対 1）。
describe('canDragSheet — この指で板を動かしてよいか', () => {
  it('いちばん高い段でなければ、どこに触れても板が動く', () => {
    expect(canDragSheet({ atHighest: false, onContent: true, scrollTop: 0 })).toBe(true);
    // 中身が送られた跡が残っていても、段が最大でなければ板が動く。
    expect(canDragSheet({ atHighest: false, onContent: true, scrollTop: 400 })).toBe(true);
    expect(canDragSheet({ atHighest: false, onContent: false, scrollTop: 0 })).toBe(true);
  });

  it('いちばん高い段では、見出しの行はいつでも板を動かす', () => {
    expect(canDragSheet({ atHighest: true, onContent: false, scrollTop: 400 })).toBe(true);
  });

  it('いちばん高い段で、読んでいる途中の指は板を動かさない', () => {
    expect(canDragSheet({ atHighest: true, onContent: true, scrollTop: 1 })).toBe(false);
    expect(canDragSheet({ atHighest: true, onContent: true, scrollTop: 400 })).toBe(false);
  });

  it('いちばん高い段で、上端に置いた指は板を動かす（＝一度離せば縮められる）', () => {
    expect(canDragSheet({ atHighest: true, onContent: true, scrollTop: 0 })).toBe(true);
  });
});

describe('contentScrolls — 中身を送れるのはいちばん高い段だけ', () => {
  it('最大なら送れる', () => {
    expect(contentScrolls(true)).toBe(true);
  });

  it('途中の段では送れない（板の伸縮と混ざらない）', () => {
    expect(contentScrolls(false)).toBe(false);
  });
});
