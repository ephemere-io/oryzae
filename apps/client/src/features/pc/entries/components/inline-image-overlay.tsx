'use client';

import type { InlineImage } from '@oryzae/shared';
import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import type { ResizeHandle } from '../utils/inline-image-resize';

/**
 * 選択中の写真に重ねる操作 UI。8 ハンドルと削除だけ。
 *
 * **回り込みの設定は置かない。** 以前は「行内 / ブロック / 回り込み」×「先頭 / 中央 / 末尾」の
 * 6 つを並べていたが、全部試さないと意味が分からない道具になっていた。写真は
 * **独立した行の中央**に置く、と決め打つ（差し込み時の既定も同じ）。
 * ここでできるのは「大きさを変える」「消す」「掴んで動かす」の3つだけ。
 *
 * **本文（contentEditable）の中には描かない。** 中に React の要素を混ぜると、
 * ブラウザが編集で書き換えた DOM と React の管理が食い違って本文が壊れる。
 * `position: fixed` で画面座標に重ねるだけにしてある（`rect` は呼び出し側が測る）。
 */

/** 画面上の位置。書字方向によらず見た目どおりに置く。 */
const HANDLES: { handle: ResizeHandle; style: React.CSSProperties; cursor: string }[] = [
  { handle: 'nw', style: { insetInlineStart: -4, insetBlockStart: -4 }, cursor: 'nwse-resize' },
  { handle: 'n', style: { insetInlineStart: '50%', insetBlockStart: -4 }, cursor: 'ns-resize' },
  { handle: 'ne', style: { insetInlineEnd: -4, insetBlockStart: -4 }, cursor: 'nesw-resize' },
  { handle: 'e', style: { insetInlineEnd: -4, insetBlockStart: '50%' }, cursor: 'ew-resize' },
  { handle: 'se', style: { insetInlineEnd: -4, insetBlockEnd: -4 }, cursor: 'nwse-resize' },
  { handle: 's', style: { insetInlineStart: '50%', insetBlockEnd: -4 }, cursor: 'ns-resize' },
  { handle: 'sw', style: { insetInlineStart: -4, insetBlockEnd: -4 }, cursor: 'nesw-resize' },
  { handle: 'w', style: { insetInlineStart: -4, insetBlockStart: '50%' }, cursor: 'ew-resize' },
];

interface InlineImageOverlayProps {
  /** 選択中の写真の画面上の位置。null なら何も描かない。 */
  rect: DOMRect | null;
  /** 選択中の写真の設定。 */
  image: InlineImage | null;
  onResizeStart: (handle: ResizeHandle, e: React.PointerEvent) => void;
  onRemove: () => void;
}

export function InlineImageOverlay({
  rect,
  image,
  onResizeStart,
  onRemove,
}: InlineImageOverlayProps) {
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

      {HANDLES.map(({ handle, style, cursor }) => (
        <button
          key={handle}
          type="button"
          aria-label={t(`resize_${handle}`)}
          data-handle={handle}
          onPointerDown={(e) => onResizeStart(handle, e)}
          className="pointer-events-auto absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-[var(--accent,#3b82f6)]"
          style={{ ...style, cursor }}
        />
      ))}

      {/* 操作は削除だけ。大きさはハンドル、位置は本文の中で掴んで動かす。 */}
      <div className="pointer-events-auto absolute top-0 left-full ml-2 flex flex-col gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg)] p-1 shadow-md">
        <button
          type="button"
          onClick={onRemove}
          className="rounded px-1.5 py-1 text-[11px] whitespace-nowrap text-red-500 hover:bg-[var(--hover-wash)]"
        >
          {t('remove_inline')}
        </button>
      </div>
    </div>
  );
}
