/**
 * いま描いたフレームを 1 枚の画像（data URL）にする。
 *
 * 書斎が出ていくときと、扉から書斎へ受け渡すときの両方が使う。**画面が入れ替わる間も
 * 部屋を見せ続ける**ための地で、3D を裏で回し続けずに済むよう静止画に畳んで持つ。
 *
 * ### 撮り方の約束
 *
 * - **描画の直後に呼ぶこと。** WebGL の描画バッファは既定で描画のたびに破棄されるので
 *   （`preserveDrawingBuffer` を立てていない）、別のタイミングで読むと真っ白が返る
 * - **拡大も縮小もしない。** 部屋は 1px の細線で出来ていて、線画は縮小 → 拡大の往復に
 *   耐えない（線が破線と粒に割れる）。`renderer.domElement.width` は既にデバイス画素
 *   （pixelRatio 込み）で、敷く先も同じ画面なので、そのままの大きさなら再標本化が起きない
 * - **形式は PNG。** JPEG の周波数変換は白地に細い黒線という形が最も苦手で、線の周りに
 *   リンギングが出る。白地が大半なので PNG でもよく縮む
 *
 * 画素を取るのは同期、符号化は非同期。描画バッファは次のフレームで捨てられるので
 * `drawImage` でこの場に写し取り（GPU の転送なので速い）、重い PNG の符号化だけを
 * `toBlob` に渡して後回しにする。
 */

import type { WebGLRenderer } from 'three';

/** 撮る大きさの上限（px）。ごく大きな画面（4K 超）だけは縮めて諦める。 */
const MAX_WIDTH = 3840;

/**
 * `sessionStorage` に置ける 1 枚の上限（文字数）。
 *
 * 超えたら**憶えない**。地が無くても遷移は成立するので、保存に失敗して他の憶えごとを
 * 押し出すより、諦めるほうが安全。
 */
const MAX_CHARS = 3_000_000;

/**
 * 直前に描いたフレームを data URL にして渡す。
 *
 * 撮れない環境（2D コンテキストが取れない・canvas が 0 幅・符号化に失敗・容量超過）では
 * `null` を渡す。地が無くても遷移そのものは成立するので、諦めても失うものは無い。
 */
export function captureRenderedFrame(
  renderer: WebGLRenderer,
  /** 透明な部分に先に塗る地の色。塗らずに敷くと、敷いた先の画面が透けて二重写しになる。 */
  background: string,
  done: (dataUrl: string | null) => void,
): void {
  const source = renderer.domElement;
  if (source.width === 0 || source.height === 0) {
    done(null);
    return;
  }

  const width = Math.min(source.width, MAX_WIDTH);
  const flat = document.createElement('canvas');
  flat.width = width;
  flat.height = Math.max(1, Math.round((source.height / source.width) * width));
  const context = flat.getContext('2d');
  if (context === null) {
    done(null);
    return;
  }

  context.fillStyle = background;
  context.fillRect(0, 0, flat.width, flat.height);
  context.drawImage(source, 0, 0, flat.width, flat.height);

  try {
    flat.toBlob((blob) => {
      if (blob === null) {
        done(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const url = typeof reader.result === 'string' ? reader.result : null;
        done(url !== null && url.length <= MAX_CHARS ? url : null);
      };
      reader.onerror = () => done(null);
      reader.readAsDataURL(blob);
    }, 'image/png');
  } catch {
    // 汚れた canvas（外部テクスチャ）なら諦める。いまは自前の描画だけなので通常は来ない。
    done(null);
  }
}
