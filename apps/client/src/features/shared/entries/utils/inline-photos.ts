import {
  type EditorEffectsState,
  INLINE_IMAGE_PLACEHOLDER,
  type InlineImage,
} from '@oryzae/shared';
import type { AttachedPhoto, InlinePhoto } from '../types';

/**
 * 本文の中の写真（端末非依存の純関数）。
 *
 * 保存形式は PC と同じ（`docs/entry-photo-guide.md`）: 本文の中の写真は U+FFFC 1 文字の
 * プレースホルダで、その位置と写真の対応は `effects.inlineImages[{ offset, storagePath, … }]`。
 * SP の本文は PC と同じ contentEditable で、DOM との往復は `inline-image-codec.ts`。ここは
 * 保存形式（本文 + `effects`）と、置き順の写真の一覧との往復。
 */

const PHOTO_PLACEHOLDER = INLINE_IMAGE_PLACEHOLDER;

/** SP で置いた写真の既定（全幅の 1 枚）。PC で開いても同じ位置に block として出る。 */
const SP_INLINE_DEFAULTS = { widthRatio: 1, layout: 'block', align: 'start' } as const;

/** 添えた写真を、本文の中の 1 枚（既定の見た目）にする。 */
export function toInlinePhoto(photo: AttachedPhoto): InlinePhoto {
  return { ...photo, ...SP_INLINE_DEFAULTS };
}

/** 本文の中のプレースホルダの位置（昇順）。 */
export function photoOffsets(body: string): number[] {
  const offsets: number[] = [];
  for (let i = 0; i < body.length; i++) {
    if (body[i] === PHOTO_PLACEHOLDER) offsets.push(i);
  }
  return offsets;
}

/**
 * 開いたときの復元: 本文（プレースホルダ入り）と保存された `effects` から、置き順の写真を出す。
 *
 * プレースホルダに対応する写真が無ければ（本文と effects が食い違っている）そのプレースホルダを
 * 本文から落とす（PC と同じで、写真を落として本文を守る）。写真の表示 URL は添えた写真の一覧から引く。
 */
export function restoreInlinePhotos(
  body: string,
  effects: EditorEffectsState | null | undefined,
  photos: readonly AttachedPhoto[],
): { body: string; images: InlinePhoto[] } {
  const byOffset = new Map<number, InlineImage>();
  for (const image of effects?.inlineImages ?? []) byOffset.set(image.offset, image);
  const signedByPath = new Map(photos.map((photo) => [photo.storagePath, photo.signedUrl]));

  let out = '';
  const images: InlinePhoto[] = [];
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch !== PHOTO_PLACEHOLDER) {
      out += ch;
      continue;
    }
    const image = byOffset.get(i);
    if (!image) continue; // 対応の無いプレースホルダは落とす
    images.push({
      storagePath: image.storagePath,
      signedUrl: signedByPath.get(image.storagePath) ?? '',
      widthRatio: image.widthRatio,
      layout: image.layout,
      align: image.align,
      ...(image.aspect ? { aspect: image.aspect } : {}),
    });
    out += PHOTO_PLACEHOLDER;
  }
  return { body: out, images };
}

/**
 * 保存形式を組む: 本文のプレースホルダの位置を数え直し、置き順の写真と対にする。
 *
 * 写真の見た目（`widthRatio` / `layout` / `align` / `aspect`）は写真自身が持つ（PC で置いたものは
 * 復元のときに写してある）。`previous` の他の項目（`textSpans` 等）は触らず持ち越す
 * （SP は装飾を描かないが、消してはいけない）。写真も装飾も無ければ null。
 */
export function buildEffectsWithPhotos(
  body: string,
  images: readonly InlinePhoto[],
  previous: EditorEffectsState | null | undefined,
): EditorEffectsState | null {
  const offsets = photoOffsets(body);

  const inlineImages: InlineImage[] = [];
  offsets.forEach((offset, index) => {
    const photo = images[index];
    if (!photo) return;
    inlineImages.push({
      offset,
      storagePath: photo.storagePath,
      widthRatio: photo.widthRatio,
      layout: photo.layout,
      align: photo.align,
      ...(photo.aspect ? { aspect: photo.aspect } : {}),
    });
  });

  const rest: Omit<EditorEffectsState, 'version' | 'inlineImages'> = {};
  if (previous?.eraserTraces?.length) rest.eraserTraces = previous.eraserTraces;
  if (previous?.textSpans?.length) rest.textSpans = previous.textSpans;

  if (inlineImages.length === 0 && !rest.eraserTraces && !rest.textSpans) return null;
  return {
    version: 1,
    ...rest,
    ...(inlineImages.length > 0 ? { inlineImages } : {}),
  };
}

/**
 * 本文から、置き順の写真の数と食い違うプレースホルダを正す（写真が先に消えた等）。
 * 数が合っていればそのまま。多ければ末尾から落とす。
 */
export function trimOrphanPlaceholders(body: string, imageCount: number): string {
  const offsets = photoOffsets(body);
  if (offsets.length <= imageCount) return body;
  let out = body;
  for (const offset of offsets.slice(imageCount).reverse()) {
    out = out.slice(0, offset) + out.slice(offset + 1);
  }
  return out;
}
