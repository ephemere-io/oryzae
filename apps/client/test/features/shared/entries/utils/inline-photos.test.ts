import { INLINE_IMAGE_PLACEHOLDER } from '@oryzae/shared';
import { describe, expect, it } from 'vitest';
import {
  buildEffectsWithPhotos,
  photoOffsets,
  restoreInlinePhotos,
  toInlinePhoto,
  trimOrphanPlaceholders,
} from '@/features/shared/entries/utils/inline-photos';

const P = INLINE_IMAGE_PLACEHOLDER;

describe('inline-photos（本文の中の写真、PC と同じ保存形式）', () => {
  it('プレースホルダの位置を昇順で返す', () => {
    expect(photoOffsets(`ab${P}c${P}`)).toEqual([2, 4]);
    expect(photoOffsets('abc')).toEqual([]);
  });

  it('復元: effects の offset と一致するプレースホルダだけ写真になり、対応の無いものは落ちる', () => {
    const body = `x${P}y${P}z`;
    const { body: restored, images } = restoreInlinePhotos(
      body,
      {
        version: 1,
        inlineImages: [
          { offset: 1, storagePath: 'p/1.jpg', widthRatio: 0.4, layout: 'inline', align: 'start' },
        ],
      },
      [{ storagePath: 'p/1.jpg', signedUrl: 'https://signed/1' }],
    );
    expect(restored).toBe(`x${P}yz`);
    expect(images).toEqual([
      {
        storagePath: 'p/1.jpg',
        signedUrl: 'https://signed/1',
        widthRatio: 0.4,
        layout: 'inline',
        align: 'start',
      },
    ]);
  });

  it('復元: effects が無ければプレースホルダを全部落とす', () => {
    expect(restoreInlinePhotos(`a${P}b`, null, [])).toEqual({ body: 'ab', images: [] });
  });

  it('保存形式: 位置を数え直し、SP で置いた写真は全幅の block', () => {
    const effects = buildEffectsWithPhotos(
      `一${P}二`,
      [toInlinePhoto({ storagePath: 'p/new.jpg', signedUrl: '' })],
      null,
    );
    expect(effects).toEqual({
      version: 1,
      inlineImages: [
        { offset: 1, storagePath: 'p/new.jpg', widthRatio: 1, layout: 'block', align: 'start' },
      ],
    });
  });

  it('保存形式: 写真自身の見た目（PC で置いたもの）と、装飾（textSpans）は持ち越す', () => {
    const previous = {
      version: 1 as const,
      textSpans: [{ start: 0, end: 1, kind: 'eblock', payload: {} }],
      inlineImages: [
        {
          offset: 0,
          storagePath: 'p/pc.jpg',
          widthRatio: 0.4,
          layout: 'wrap' as const,
          align: 'end' as const,
          aspect: 1.5,
        },
      ],
    };
    // 本文を書き足して写真が後ろへずれた
    const effects = buildEffectsWithPhotos(
      `追記${P}`,
      [
        {
          storagePath: 'p/pc.jpg',
          signedUrl: '',
          widthRatio: 0.4,
          layout: 'wrap',
          align: 'end',
          aspect: 1.5,
        },
      ],
      // @type-assertion-allowed: テストの前回 effects。textSpans の payload 型は共有スキーマの詳細で、ここでは持ち越されることだけを見る
      previous as never,
    );
    expect(effects?.inlineImages).toEqual([
      {
        offset: 2,
        storagePath: 'p/pc.jpg',
        widthRatio: 0.4,
        layout: 'wrap',
        align: 'end',
        aspect: 1.5,
      },
    ]);
    expect(effects?.textSpans).toEqual(previous.textSpans);
  });

  it('保存形式: 写真も装飾も無ければ null', () => {
    expect(buildEffectsWithPhotos('本文だけ', [], null)).toBeNull();
    expect(buildEffectsWithPhotos('本文だけ', [], { version: 1 })).toBeNull();
  });

  it('写真の数より多いプレースホルダは末尾から落とす', () => {
    expect(trimOrphanPlaceholders(`a${P}b${P}c`, 1)).toBe(`a${P}bc`);
    expect(trimOrphanPlaceholders(`a${P}b`, 1)).toBe(`a${P}b`);
  });
});
