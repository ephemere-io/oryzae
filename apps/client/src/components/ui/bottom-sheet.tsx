'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useEffect, useState } from 'react';
import { useSpChrome } from '@/lib/sp-chrome-context';
import { Sheet, type SheetDetent } from './sheet';
import { CONTROL_FONT } from './surface';

export interface BottomSheetProps {
  open: boolean;
  /** 閉じ終わったとき（閉じる動きのあと）。呼び出し側はここで消す。 */
  onClose: () => void;
  /** 読み上げ用の名前。 */
  ariaLabel: string;
  /** 見出し（左上の小さなラベル）。 */
  label?: string;
  closeLabel: string;
  /** 止まる段。既定は半分と全画面。中身が短いシートは `['content']`。 */
  detents?: readonly SheetDetent[];
  /** 最初に止まる段。 */
  initialDetent?: SheetDetent;
  children: React.ReactNode;
}

/**
 * 下から出る**モーダル**のシート（暗幕あり・外を押すと閉じる）。動きは `Sheet`（ネイティブのスクロールと
 * CSS scroll-snap）。「閉じる」・暗幕・払いきり、どの閉じ方でも閉じる動きのあとで `onClose` を呼ぶので、
 * 呼び出し側が条件付きで描いていても一瞬で消えない。SP の殻の中なら殻の overlay の席に出る。
 */
export function BottomSheet({
  open,
  onClose,
  ariaLabel,
  label,
  closeLabel,
  detents = ['half', 'full'],
  initialDetent = 'half',
  children,
}: BottomSheetProps) {
  const { overlaySlot } = useSpChrome();
  const [detent, setDetent] = useState<SheetDetent>(initialDetent);
  /** 閉じる動きの最中か（呼び出し側の `open` はまだ true のまま）。 */
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setDetent(initialDetent);
      setClosing(false);
    }
  }, [open, initialDetent]);

  return (
    <Sheet
      open={open && !closing}
      detents={detents}
      detent={detent}
      onDetentChange={setDetent}
      dismissible
      onRequestClose={() => setClosing(true)}
      onClosed={onClose}
      modal
      backdropLabel={closeLabel}
      ariaLabel={ariaLabel}
      slot={overlaySlot}
      contract={verifyAttrs({ unit: 'BottomSheet', detent, closing })}
      header={
        <div
          className="flex select-none flex-col items-center px-5 pt-2 pb-2"
          style={{ cursor: 'grab' }}
        >
          <span
            aria-hidden="true"
            className="mb-2 block h-1.5 w-9 rounded-full"
            style={{ background: 'color-mix(in srgb, var(--fg) 18%, transparent)' }}
          />
          <div className="flex w-full items-center justify-between gap-3">
            <span
              className="min-w-0 truncate text-[11px] uppercase tracking-[0.14em]"
              style={{ ...CONTROL_FONT, color: 'var(--accent)' }}
            >
              {label ?? ''}
            </span>
            <button
              type="button"
              onClick={() => setClosing(true)}
              className="min-h-[40px] shrink-0 rounded-full border px-4 text-[13px]"
              style={{ ...CONTROL_FONT, color: 'var(--fg)', borderColor: 'var(--border-subtle)' }}
            >
              {closeLabel}
            </button>
          </div>
        </div>
      }
    >
      <div className="px-6 pb-8">{children}</div>
    </Sheet>
  );
}
