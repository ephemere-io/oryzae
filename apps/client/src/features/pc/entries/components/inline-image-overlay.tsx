'use client';

import type { InlineImage } from '@oryzae/shared';
import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import type { ResizeHandle } from '../utils/inline-image-resize';

/**
 * 選択中の写真に重ねる操作 UI。
 *
 * **本文（contentEditable）の中には描かない。** 中に React の要素を混ぜると、
 * ブラウザが編集で書き換えた DOM と React の管理が食い違って本文が壊れる。
 * `position: fixed` で画面座標に重ねるだけにしてある（`rect` は呼び出し側が測る）。
 *
 * 操作は **サイズ・回転・削除** の 3 つだけに絞ってある。回り込み（float）と寄せの
 * 細かい指定は一度入れたが、項目が多く「全部試さないと意味が分からない」状態になった。
 * 写真は Notion / Medium と同じく独立した行の中央に置く、と決め打ちにしている。
 */

/** ハンドルの画面上の位置。書字方向によらず見た目どおりに置く。 */
const HANDLES: { handle: ResizeHandle; style: React.CSSProperties; cursor: string }[] = [
  { handle: 'nw', style: { left: 0, top: 0 }, cursor: 'nwse-resize' },
  { handle: 'n', style: { left: '50%', top: 0 }, cursor: 'ns-resize' },
  { handle: 'ne', style: { left: '100%', top: 0 }, cursor: 'nesw-resize' },
  { handle: 'e', style: { left: '100%', top: '50%' }, cursor: 'ew-resize' },
  { handle: 'se', style: { left: '100%', top: '100%' }, cursor: 'nwse-resize' },
  { handle: 's', style: { left: '50%', top: '100%' }, cursor: 'ns-resize' },
  { handle: 'sw', style: { left: 0, top: '100%' }, cursor: 'nesw-resize' },
  { handle: 'w', style: { left: 0, top: '50%' }, cursor: 'ew-resize' },
];

interface InlineImageOverlayProps {
  /** 選択中の写真の画面上の位置。null なら何も描かない。 */
  rect: DOMRect | null;
  /** 選択中の写真の設定。 */
  image: InlineImage | null;
  onResizeStart: (handle: ResizeHandle, e: React.PointerEvent) => void;
  onRotateStart: (e: React.PointerEvent) => void;
  onRemove: () => void;
}

export function InlineImageOverlay({
  rect,
  image,
  onResizeStart,
  onRotateStart,
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
        widthRatio: image.widthRatio,
        rotation: image.rotation ?? 0,
      })}
    >
      <div className="absolute inset-0 border-2 border-[var(--accent,#3b82f6)]" />

      {HANDLES.map(({ handle, style, cursor }) => (
        <button
          key={handle}
          type="button"
          aria-label={t(`resize_${handle}`)}
          data-handle={handle}
          onPointerDown={(e) => onResizeStart(handle, e)}
          className="pointer-events-auto absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-[var(--accent,#3b82f6)] shadow"
          style={{ ...style, cursor }}
        />
      ))}

      {/* 削除は board と同じく右上のバツ印。 */}
      <button
        type="button"
        onClick={onRemove}
        aria-label={t('remove_inline')}
        data-testid="inline-image-remove"
        className="pointer-events-auto absolute -right-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full border border-white bg-black/70 text-xs text-white shadow"
      >
        ×
      </button>

      {/* 回転は下辺の外側。リサイズハンドルと掴み間違えない距離を空けてある。 */}
      <button
        type="button"
        onPointerDown={onRotateStart}
        aria-label={t('rotate')}
        data-testid="inline-image-rotate"
        className="pointer-events-auto absolute left-1/2 top-full mt-4 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border border-white bg-[var(--accent,#3b82f6)] text-xs text-white shadow"
        style={{ cursor: 'grab' }}
      >
        ↻
      </button>
    </div>
  );
}
