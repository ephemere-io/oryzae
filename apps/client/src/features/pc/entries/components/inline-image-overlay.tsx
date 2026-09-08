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
 * 座標は **スクロールする箱の内容座標**（`position: absolute`）。viewport 座標に固定すると
 * スクロールのたびに測り直しが要り、測り直しを取りこぼすと枠だけが取り残される
 * （実際にそうなっていた）。同じ箱の中に同じ座標系で描けば、追従は構造的に保証される。
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

/**
 * ドラッグ中に「ここに入る」を示す線。
 *
 * キャレットの矩形をそのまま描く。横書きなら縦棒、縦書きなら横棒になり、
 * 書字方向の分岐を書かずに正しい向きになる。
 */
export function InlineImageDropIndicator({ rect }: { rect: DOMRect | null }) {
  if (!rect) return null;
  return (
    <div
      aria-hidden="true"
      data-testid="inline-image-drop-indicator"
      className="pointer-events-none absolute z-50 bg-[var(--accent,#3b82f6)]"
      style={{
        left: rect.left,
        top: rect.top,
        // 潰れた矩形でも見えるように、細い側に最低の太さを与える。
        width: Math.max(rect.width, 2),
        height: Math.max(rect.height, 2),
      }}
    />
  );
}

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
      className="pointer-events-none absolute z-50"
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
