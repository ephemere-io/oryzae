'use client';

/**
 * 送信前の画像の縮小と採寸。
 *
 * ドメインを知らない横断インフラなので lib に置く（PC のボードと SP のボードが同じものを
 * 使う。片方に閉じたままだと、もう片方が同じコードを書き写すことになる）。
 */

export interface ResizedImage {
  blob: Blob;
  width: number;
  height: number;
}

/**
 * 上限より小さい画像は**一切触らない**。
 *
 * ここで再エンコードすると荒くなるだけで得るものが無い（元が JPEG なら二重圧縮、
 * PNG なら不可逆になる）。
 */
export function resizeImage(file: File, maxWidth: number, quality: number): Promise<ResizedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      // JPEG は透明を持てない。canvas の初期値は透明な黒なので、そのまま JPEG に
      // すると PNG の透明部分が**黒く潰れる**。ロゴやスクリーンショットのように背景が
      // 抜けている画像だと、貼った瞬間に黒い板になって出てくる。先に白で塗る。
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
      }
      canvas.toBlob(
        (blob) => resolve({ blob: blob ?? file, width, height }),
        'image/jpeg',
        quality,
      );
    };
    // onerror が無いと、デコードできない画像（iPhone の HEIC を Chrome で開いた等）で
    // onload が永遠に来ず、この Promise が解決しないまま呼び出し側が待ち続ける。
    // 「アップロード中…」のまま固まり、閉じることもできなくなっていた。
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to decode image'));
    };
    img.src = objectUrl;
  });
}

/** 元画像の寸法。カードの縦横比を決めるのに使う。 */
export function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };
    img.src = objectUrl;
  });
}
