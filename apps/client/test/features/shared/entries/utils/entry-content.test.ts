import { type EditorEffectsState, INLINE_IMAGE_PLACEHOLDER } from '@oryzae/shared';
import { describe, expect, it } from 'vitest';
import { splitEntryContent } from '@/features/shared/entries/utils/entry-content';
import { restoreInlinePhotos } from '@/features/shared/entries/utils/inline-photos';

const P = INLINE_IMAGE_PLACEHOLDER;

/** 本文の中のプレースホルダの位置に、写真を 1 枚ずつ置いた effects（PC が保存する形）。 */
function effectsFor(editorBody: string): EditorEffectsState {
  const offsets = [...editorBody].flatMap((ch, i) => (ch === P ? [i] : []));
  return {
    version: 1,
    inlineImages: offsets.map((offset, i) => ({
      offset,
      storagePath: `u/${i}.jpg`,
      widthRatio: 0.6,
      layout: 'block',
      align: 'center',
    })),
  };
}

describe('splitEntryContent（保存された content を題と本文に分ける）', () => {
  it('題を付けて保存した記録: 1 行目が題、写真の位置は本文の頭から', () => {
    const body = `一段落目。${P}\n二段落目。`;
    const content = `題\n${body}`;
    expect(splitEntryContent(content, effectsFor(body))).toEqual({ title: '題', body });
  });

  it('題を付けずに保存した記録（PC の自動保存）: 題は空、本文は content 全体（実機レビュー #616）', () => {
    // PC は題が空のまま自動保存すると content = 本文。写真の位置は本文＝content の頭から数えてある。
    // 1 行目を題として切り離すと、全部の写真が 1 行目の長さ + 1 だけずれて本文から外れていた。
    const body = `一段落目の文章です。\n${P}\n二段落目の文章です。\n${P}\n三段落目。`;
    const effects = effectsFor(body);
    const split = splitEntryContent(body, effects);
    expect(split).toEqual({ title: '', body });

    // その分け方で復元すれば、写真は 2 枚とも本文の中に戻る。
    const photos = effects.inlineImages?.map((image) => ({
      storagePath: image.storagePath,
      signedUrl: `https://signed/${image.storagePath}`,
    }));
    const restored = restoreInlinePhotos(split.body, effects, photos ?? []);
    expect(restored.images.map((image) => image.storagePath)).toEqual(['u/0.jpg', 'u/1.jpg']);
    expect(restored.body).toBe(body);
  });

  it('1 行目に写真がある記録は、題を持たない（題の欄に写真は入らない）', () => {
    const body = `一段落目に${P}写真。\n二段落目。`;
    expect(splitEntryContent(body, effectsFor(body))).toEqual({ title: '', body });
    // effects が壊れて無くても、題に U+FFFC を入れない。
    expect(splitEntryContent(body, null)).toEqual({ title: '', body });
  });

  it('写真が無ければこれまでどおり 1 行目を題に（題の無い記録は 1 行目を題として扱う設計）', () => {
    expect(splitEntryContent('一行目\n二行目', null)).toEqual({ title: '一行目', body: '二行目' });
    expect(splitEntryContent('一行目\n二行目', { version: 1 })).toEqual({
      title: '一行目',
      body: '二行目',
    });
  });

  it('1 行しか無ければ題は空', () => {
    expect(splitEntryContent(`ひとこと${P}`, null)).toEqual({ title: '', body: `ひとこと${P}` });
  });

  it('どちらの数え方でも一部しか当たらないときは、多く当たるほうを取る', () => {
    // 題つきで保存したあと、写真の 1 枚だけ位置が壊れた記録。
    const body = `a${P}b\nc${P}d`;
    const effects = effectsFor(body);
    const broken: EditorEffectsState = {
      ...effects,
      inlineImages: [
        ...(effects.inlineImages ?? []),
        { offset: 99, storagePath: 'u/x.jpg', widthRatio: 0.6, layout: 'block', align: 'center' },
      ],
    };
    expect(splitEntryContent(`題\n${body}`, broken)).toEqual({ title: '題', body });
  });

  it('保存し直すと同じ形に戻る（題が空なら content = 本文）', () => {
    const body = `一段落目。\n${P}\n二段落目。`;
    const { title, body: read } = splitEntryContent(body, effectsFor(body));
    const composed = title.trim() ? `${title.trim()}\n${read}` : read;
    expect(composed).toBe(body);
  });
});
