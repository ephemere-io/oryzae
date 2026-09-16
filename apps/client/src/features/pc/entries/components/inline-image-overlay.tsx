'use client';

import type { InlineImage } from '@oryzae/shared';
import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import type { ResizeHandle } from '../utils/inline-image-resize';

/**
 * 選択中の写真に重ねる枠と、大きさを変える 8 点。
 *
 * **本文（contentEditable）の中には描かない。** 中に React の要素を混ぜると、
 * ブラウザが編集で書き換えた DOM と React の管理が食い違って本文が壊れる。
 * `position: fixed` で画面座標に重ねるだけにしてある（`rect` は呼び出し側が測る）。
 *
 * **操作（幅・寄せ・回り込み・外す）はここに置かない。** 以前は写真の右横に小さな面が
 * 浮いていて、本文に被るうえ、同じ「道具」が画面に 2 か所（パレットとこの面）できていた。
 * 写真を選んでいるあいだは**パレットの中身がその写真の操作に入れ替わる**（SP と同じ）。
 * ここに残すのは、掴んで直に変えるもの＝大きさだけ。
 */

/**
 * 画面上の位置。**箱に対する割合**で置く（0% / 50% / 100%）。丸はそこから自分の半分だけ
 * 戻して中心を合わせる（`-translate-x-1/2 -translate-y-1/2`）。
 *
 * 以前は端からの固定値 `-4px` と、その戻しの両方が効いていて、**8点すべてが左上へ
 * きっかり 4px ずれていた**（実測）。位置を数字で持たず、箱の割合から出す。
 */
const HANDLES: { handle: ResizeHandle; left: string; top: string; cursor: string }[] = [
  { handle: 'nw', left: '0%', top: '0%', cursor: 'nwse-resize' },
  { handle: 'n', left: '50%', top: '0%', cursor: 'ns-resize' },
  { handle: 'ne', left: '100%', top: '0%', cursor: 'nesw-resize' },
  { handle: 'e', left: '100%', top: '50%', cursor: 'ew-resize' },
  { handle: 'se', left: '100%', top: '100%', cursor: 'nwse-resize' },
  { handle: 's', left: '50%', top: '100%', cursor: 'ns-resize' },
  { handle: 'sw', left: '0%', top: '100%', cursor: 'nesw-resize' },
  { handle: 'w', left: '0%', top: '50%', cursor: 'ew-resize' },
];

interface InlineImageOverlayProps {
  /** 選択中の写真の画面上の位置。null なら何も描かない。 */
  rect: DOMRect | null;
  /** 選択中の写真の設定。 */
  image: InlineImage | null;
  onResizeStart: (handle: ResizeHandle, e: React.PointerEvent) => void;
}

export function InlineImageOverlay({ rect, image, onResizeStart }: InlineImageOverlayProps) {
  const t = useTranslations('photo');
  if (!rect || !image) return null;

  return (
    <div
      className="pointer-events-none fixed z-50"
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
      {...verifyAttrs({
        unit: 'InlineImageOverlay',
        layout: image.layout,
        align: image.align,
        widthRatio: image.widthRatio,
      })}
    >
      {/* 選択枠 */}
      <div className="absolute inset-0 border-2 border-[var(--accent,#3b82f6)]" />

      {HANDLES.map(({ handle, left, top, cursor }) => (
        <button
          key={handle}
          type="button"
          aria-label={t(`resize_${handle}`)}
          data-handle={handle}
          onPointerDown={(e) => onResizeStart(handle, e)}
          className="pointer-events-auto absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-[var(--accent,#3b82f6)]"
          style={{ left, top, cursor }}
        />
      ))}
    </div>
  );
}
