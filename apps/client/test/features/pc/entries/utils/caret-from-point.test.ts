import { afterEach, describe, expect, it, vi } from 'vitest';
import { caretRangeFromPoint } from '@/features/pc/entries/utils/caret-from-point';

/**
 * 「落とした場所に入れる」ための座標→キャレット変換。**API 名がブラウザで割れている**ので、
 * 片方だけを見ていると、もう片方では落とした位置が無視されて直前のキャレットに入る
 * （Chromium/WebKit: caretRangeFromPoint / Firefox: caretPositionFromPoint）。
 * ここで見張るのは「どちらの名前でも拾える」「無ければ黙って null」。
 */
describe('caretRangeFromPoint', () => {
  // jsdom はどちらの API も持たないので、テストのたびに生やして消す。
  // Document 型に無いプロパティを触るため、Reflect で名前を指定して出し入れする
  // （`as` を使わずに済む）。
  function stub(name: string, impl: unknown) {
    Reflect.set(document, name, impl);
  }
  function unstub(name: string) {
    Reflect.deleteProperty(document, name);
  }

  afterEach(() => {
    unstub('caretRangeFromPoint');
    unstub('caretPositionFromPoint');
    vi.restoreAllMocks();
  });

  function makeTextNode(text: string) {
    const node = document.createTextNode(text);
    document.body.append(node);
    return node;
  }

  it('Chromium 系（caretRangeFromPoint）の Range をそのまま返す', () => {
    const range = document.createRange();
    const spy = vi.fn().mockReturnValue(range);
    stub('caretRangeFromPoint', spy);

    expect(caretRangeFromPoint(10, 20)).toBe(range);
    expect(spy).toHaveBeenCalledWith(10, 20);
  });

  it('Firefox（caretPositionFromPoint）は node + offset から Range を組み立てる', () => {
    const node = makeTextNode('あいうえお');
    stub('caretPositionFromPoint', vi.fn().mockReturnValue({ offsetNode: node, offset: 3 }));

    const range = caretRangeFromPoint(10, 20);

    expect(range).not.toBeNull();
    expect(range?.startContainer).toBe(node);
    expect(range?.startOffset).toBe(3);
    expect(range?.collapsed).toBe(true);
    node.remove();
  });

  it('どちらも無ければ null（呼び出し側はいまのキャレットに倒す）', () => {
    expect(caretRangeFromPoint(10, 20)).toBeNull();
  });

  it('Chromium 系が位置を返せなかったら Firefox 側を試す', () => {
    const node = makeTextNode('あいうえお');
    stub('caretRangeFromPoint', vi.fn().mockReturnValue(null));
    stub('caretPositionFromPoint', vi.fn().mockReturnValue({ offsetNode: node, offset: 1 }));

    const range = caretRangeFromPoint(10, 20);

    expect(range?.startOffset).toBe(1);
    node.remove();
  });
});
