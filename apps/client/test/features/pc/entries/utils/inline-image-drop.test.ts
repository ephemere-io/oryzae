import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { serializeEditorText } from '@/features/pc/entries/utils/inline-image-codec';
import { applyDrop, findDropTarget } from '@/features/pc/entries/utils/inline-image-drop';

/**
 * ドラッグで写真を運んだときの落下先。
 *
 * `findDropTarget` は座標 → キャレット位置の解決を含むので jsdom では通しきれない
 * （`caretPositionFromPoint` が無い）。ここでは **落下先が決まった後**の `applyDrop` と、
 * 落としてはいけない場所を弾く判定を検証する。座標解決そのものは実機での確認になる。
 */

function makeEditor(html: string): { editor: HTMLDivElement; img: HTMLImageElement } {
  const editor = document.createElement('div');
  editor.innerHTML = html;
  document.body.appendChild(editor);
  const img = editor.querySelector('img');
  if (!img) throw new Error('fixture に img が無い');
  return { editor, img };
}

let hosts: HTMLElement[] = [];

beforeEach(() => {
  hosts = [];
});

afterEach(() => {
  for (const h of hosts) h.remove();
  document.body.innerHTML = '';
});

describe('applyDrop', () => {
  it('テキストの途中に落とすと、その位置へ割り込む', () => {
    const { editor, img } = makeEditor(
      '<img class="inline-photo" data-storage-path="p1">あいうえお',
    );
    hosts.push(editor);
    const text = editor.childNodes[1];

    const moved = applyDrop(img, { node: text, offset: 3, rect: new DOMRect() });

    expect(moved).toBe(true);
    // 写真は「あいう」と「えお」の間へ。
    expect(serializeEditorText(editor)).toBe('あいう￼えお');
  });

  it('テキストの先頭に落とすと分割しない', () => {
    const { editor, img } = makeEditor('あいう<img class="inline-photo" data-storage-path="p1">');
    hosts.push(editor);
    const text = editor.childNodes[0];

    applyDrop(img, { node: text, offset: 0, rect: new DOMRect() });

    expect(serializeEditorText(editor)).toBe('￼あいう');
  });

  // 同じ場所に落としたときに true を返すと、動いていないのに保存が走る。
  it('動かなかった場合は false を返す', () => {
    const { editor, img } = makeEditor('あいう<img class="inline-photo" data-storage-path="p1">');
    hosts.push(editor);
    const text = editor.childNodes[0];

    const moved = applyDrop(img, { node: text, offset: 3, rect: new DOMRect() });

    expect(moved).toBe(false);
    expect(serializeEditorText(editor)).toBe('あいう￼');
  });

  it('要素ノードに落とすと、その子の位置へ入る', () => {
    const { editor, img } = makeEditor(
      '<div>ひとつめ</div><div>ふたつめ</div><img class="inline-photo" data-storage-path="p1">',
    );
    hosts.push(editor);

    applyDrop(img, { node: editor, offset: 1, rect: new DOMRect() });

    // 1 つめの div と 2 つめの div の間。写真自体は改行を作らない（1 文字ぶんの
    // プレースホルダなので）ため、直前の div のあとに続く形になる。
    expect(serializeEditorText(editor)).toBe('ひとつめ￼\nふたつめ');
  });

  it('複数枚あっても運んだ 1 枚だけが動く', () => {
    const { editor } = makeEditor(
      'あ<img class="inline-photo" data-storage-path="p1">い<img class="inline-photo" data-storage-path="p2">う',
    );
    hosts.push(editor);
    const images = editor.querySelectorAll('img');
    const first = images[0];
    const lastText = editor.childNodes[editor.childNodes.length - 1];

    applyDrop(first, { node: lastText, offset: 1, rect: new DOMRect() });

    // p1 が末尾へ移り、p2 の位置は変わらない。
    expect(serializeEditorText(editor)).toBe('あい￼う￼');
    expect(editor.querySelectorAll('img')[1].dataset.storagePath).toBe('p1');
  });
});

describe('findDropTarget が落とさない場所', () => {
  it('本文の外は差し込み先にしない', () => {
    const { editor, img } = makeEditor('<img class="inline-photo" data-storage-path="p1">本文');
    const outside = document.createElement('div');
    outside.textContent = 'ツールバー';
    document.body.appendChild(outside);
    hosts.push(editor, outside);

    // jsdom に caretPositionFromPoint が無いので、解決できない＝null になることを見る。
    // 「解決できないときに何かに落とす」実装だと、本文の外へ落ちてしまう。
    expect(findDropTarget(editor, img, 0, 0)).toBeNull();
  });
});
