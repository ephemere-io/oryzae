import { INLINE_IMAGE_PLACEHOLDER } from '@oryzae/shared';
import { describe, expect, it } from 'vitest';
import {
  buildEffectsWithPhotos,
  insertPhotoAt,
  joinBodySegments,
  photoOffsets,
  removePhotoAt,
  restoreInlinePhotos,
  splitBodyAtPhotos,
  trimOrphanPlaceholders,
} from '@/features/shared/entries/utils/inline-photos';

const P = INLINE_IMAGE_PLACEHOLDER;

describe('inline-photos（本文の中の写真、PC と同じ保存形式）', () => {
  it('切って繋ぐと元に戻る（空の文も残す）', () => {
    const body = `一行目${P}二行目${P}`;
    const segments = splitBodyAtPhotos(body);
    expect(segments).toEqual(['一行目', '二行目', '']);
    expect(joinBodySegments(segments)).toBe(body);
  });

  it('プレースホルダの位置を昇順で返す', () => {
    expect(photoOffsets(`ab${P}c${P}`)).toEqual([2, 4]);
    expect(photoOffsets('abc')).toEqual([]);
  });

  it('カーソル位置に差すと文が 2 つに割れ、写真はその間', () => {
    const { segments, imageIndex } = insertPhotoAt(['今日は雨。明日は晴れ。'], 0, 5);
    expect(segments).toEqual(['今日は雨。\n', '明日は晴れ。']);
    expect(imageIndex).toBe(0);
    expect(joinBodySegments(segments)).toBe(`今日は雨。\n${P}明日は晴れ。`);
  });

  it('文末に差すと後ろの文は空。直前の改行は増やさない', () => {
    const { segments } = insertPhotoAt(['書き終えた\n'], 0, 6);
    expect(segments).toEqual(['書き終えた\n', '']);
  });

  it('2 枚目は前の写真の後の文に差せる', () => {
    const first = insertPhotoAt(['ab', 'cd'], 1, 1);
    expect(first.segments).toEqual(['ab', 'c\n', 'd']);
    expect(first.imageIndex).toBe(1);
  });

  it('写真を抜くと前後の文が繋がる（改行を 1 つ挟む）', () => {
    expect(removePhotoAt(['前', '後'], 0)).toEqual(['前\n後']);
    expect(removePhotoAt(['前\n', '後'], 0)).toEqual(['前\n後']);
    expect(removePhotoAt(['', '後'], 0)).toEqual(['後']);
    expect(removePhotoAt(['a', 'b', 'c'], 1)).toEqual(['a', 'b\nc']);
  });

  it('範囲外の写真を抜こうとしても文は変わらない', () => {
    expect(removePhotoAt(['a', 'b'], 5)).toEqual(['a', 'b']);
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
    expect(images).toEqual([{ storagePath: 'p/1.jpg', signedUrl: 'https://signed/1' }]);
  });

  it('復元: effects が無ければプレースホルダを全部落とす', () => {
    expect(restoreInlinePhotos(`a${P}b`, null, [])).toEqual({ body: 'ab', images: [] });
  });

  it('保存形式: 位置を数え直し、SP で置いた写真は全幅の block', () => {
    const effects = buildEffectsWithPhotos(
      `一${P}二`,
      [{ storagePath: 'p/new.jpg', signedUrl: '' }],
      null,
    );
    expect(effects).toEqual({
      version: 1,
      inlineImages: [
        { offset: 1, storagePath: 'p/new.jpg', widthRatio: 1, layout: 'block', align: 'start' },
      ],
    });
  });

  it('保存形式: PC で置いた写真の見た目と、装飾（textSpans）は持ち越す', () => {
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
      [{ storagePath: 'p/pc.jpg', signedUrl: '' }],
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
