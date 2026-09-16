import { ENTRY_PHOTO_MAX_EDGE_PX } from '@oryzae/shared';

/**
 * アップロード前に画像を縮めて JPEG に正規化する。
 *
 * なぜ必要か:
 * - スマホの写真は長辺 4000px 級。そのまま文字起こしに回すと画像トークンが桁で増え、
 *   コストも往復時間も跳ね上がる（docs/entry-photo-guide.md）。
 * - canvas を通すことで HEIC など Anthropic が受理しない形式も JPEG に揃う。
 * - EXIF の向き情報は `imageOrientation: 'from-image'` でピクセルに焼き込む。これをしないと
 *   横倒しの写真をそのまま送ることになり、文字起こしの精度が落ちる。
 *
 * 長辺が既に上限以下でも、形式と向きを揃えるため必ず canvas を通す。
 */
const JPEG_QUALITY = 0.85;
const OUTPUT_TYPE = 'image/jpeg';

export class ImageDecodeError extends Error {
  constructor() {
    super('Failed to decode image');
    this.name = 'ImageDecodeError';
  }
}

export async function resizeImageForUpload(file: File): Promise<File> {
  const bitmap = await decode(file);

  const scale = Math.min(1, ENTRY_PHOTO_MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new ImageDecodeError();
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, OUTPUT_TYPE, JPEG_QUALITY);
  });
  if (!blob) throw new ImageDecodeError();

  return new File([blob], toJpegName(file.name), { type: OUTPUT_TYPE });
}

async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageDecodeError();
  }
}

/**
 * 表示用 URL から写真の実寸を測る。**測れなければ null。**
 *
 * 置く大きさを写真の向きから決めるのに要る（縦長か横長かで、行に対する割合を変える）。
 * 署名切れや通信の失敗で読めないことがあるので、そのときは呼ぶ側が既定に倒せるように
 * 例外ではなく null を返す——写真が貼れないより、大きさが既定のほうがましである。
 */
export async function measureImageSize(
  url: string,
): Promise<{ width: number; height: number } | null> {
  if (!url) return null;
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    if (!(image.naturalWidth > 0) || !(image.naturalHeight > 0)) return null;
    return { width: image.naturalWidth, height: image.naturalHeight };
  } catch {
    return null;
  }
}

/** 拡張子を .jpg に揃える（中身が JPEG になっているため）。 */
function toJpegName(original: string): string {
  const base = original.replace(/\.[^./\\]+$/, '');
  return `${base || 'photo'}.jpg`;
}
