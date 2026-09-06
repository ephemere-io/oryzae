'use client';

import type { InlineImage } from '@oryzae/shared';
import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import type { ResizeHandle } from '../utils/inline-image-resize';

/**
 * 選択中の写真に重ねる操作 UI。Word の画像選択に倣って 8 ハンドルとレイアウト切替を出す。
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

const LAYOUTS: InlineImage['layout'][] = ['inline', 'block', 'wrap'];
const ALIGNS: InlineImage['align'][] = ['start', 'center', 'end'];

interface InlineImageOverlayProps {
  /** 選択中の写真の画面上の位置。null なら何も描かない。 */
  rect: DOMRect | null;
  /** 選択中の写真の設定。 */
  image: InlineImage | null;
  onResizeStart: (handle: ResizeHandle, e: React.PointerEvent) => void;
  onLayoutChange: (patch: Partial<Pick<InlineImage, 'layout' | 'align'>>) => void;
  onRemove: () => void;
}

export function InlineImageOverlay({
  rect,
  image,
  onResizeStart,
  onLayoutChange,
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

      {/* レイアウト操作。Word の「レイアウトオプション」に相当する位置（右上の外側）に置く。 */}
      <div className="pointer-events-auto absolute left-full top-0 ml-2 flex flex-col gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg)] p-1 shadow-md">
        <div className="flex gap-1">
          {LAYOUTS.map((layout) => (
            <button
              key={layout}
              type="button"
              onClick={() => onLayoutChange({ layout })}
              aria-pressed={image.layout === layout}
              className={`rounded px-1.5 py-1 text-[11px] whitespace-nowrap ${
                image.layout === layout
                  ? 'bg-[var(--toolbar-hover)] text-[var(--fg)]'
                  : 'text-[var(--date-color)]'
              }`}
            >
              {t(`layout_${layout}`)}
            </button>
          ))}
        </div>

        {/* 寄せは行内では効かない（文字の流れが位置を決める）ので出さない。 */}
        {image.layout !== 'inline' && (
          <div className="flex gap-1">
            {ALIGNS.map((align) => (
              <button
                key={align}
                type="button"
                onClick={() => onLayoutChange({ align })}
                aria-pressed={image.align === align}
                className={`rounded px-1.5 py-1 text-[11px] whitespace-nowrap ${
                  image.align === align
                    ? 'bg-[var(--toolbar-hover)] text-[var(--fg)]'
                    : 'text-[var(--date-color)]'
                }`}
              >
                {t(`align_${align}`)}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onRemove}
          className="rounded px-1.5 py-1 text-[11px] text-red-500 hover:bg-[var(--toolbar-hover)]"
        >
          {t('remove_inline')}
        </button>
      </div>
    </div>
  );
}
