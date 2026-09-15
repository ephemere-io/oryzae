'use client';

import { verifyAttrs } from '@oryzae/verify';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useSpChrome } from '@/lib/sp-chrome-context';
import { Sheet, type SheetDetent } from './sheet';
import { CONTROL_FONT } from './surface';

export interface BottomSheetProps {
  /** 開いているか。呼び出し側が持つ（中身が無くなったら false）。 */
  open: boolean;
  /**
   * 閉じたいとき（閉じる・暗幕・払いきり）。**押した時点で呼ぶ**ので、呼び出し側はここで `open` を
   * false にする。閉じる動きの間は、最後に開いていたときの中身を部品が描き続ける。
   */
  onClose: () => void;
  /** 閉じる動きが終わって消えたとき。 */
  onClosed?: () => void;
  /** 読み上げ用の名前。 */
  ariaLabel: string;
  /** 見出し（左上の小さなラベル）。 */
  label?: string;
  closeLabel: string;
  /**
   * 見出しの右、閉じるの隣に並べる主の操作（保存など）。やめる・決めるを同じ場所・同じ大きさで並べる
   * （iOS のシートの見出しと同じ）。キーボードが出ていても隠れない。
   */
  action?: ReactNode;
  /** 止まる段。既定は半分と全画面。中身が短いシートは `['content']`。 */
  detents?: readonly SheetDetent[];
  /** 最初に止まる段。 */
  initialDetent?: SheetDetent;
  children: ReactNode;
}

/**
 * 下から出る**モーダル**のシート（暗幕あり・外を押すと閉じる）。動きは `Sheet`（ネイティブのスクロールと
 * CSS scroll-snap）。SP の殻の中なら殻の overlay の席に出る。
 *
 * **開いているかは呼び出し側が持ち、部品は常に描いておく**（`<BottomSheet open={item !== null}>`）。
 * 以前は「中身があるときだけ描き、閉じる動きのあとで onClose」だったため、閉じる動きの間にもう一度
 * 押すと、閉じ終わりの onClose が新しく開いた中身まで消していた（実機レビュー: 閉じたあと開けない）。
 * いまは閉じる途中で `open` が true に戻れば、その場から開き直す。
 */
export function BottomSheet({
  open,
  onClose,
  onClosed,
  ariaLabel,
  label,
  closeLabel,
  action,
  detents = ['half', 'full'],
  initialDetent = 'half',
  children,
}: BottomSheetProps) {
  const { overlaySlot } = useSpChrome();
  const [detent, setDetent] = useState<SheetDetent>(initialDetent);

  // 閉じる動きの間は、最後に開いていたときの中身と見出しを描く（呼び出し側の中身はもう無い）。
  const shown = useRef({ children, label, ariaLabel, action });
  if (open) shown.current = { children, label, ariaLabel, action };

  useEffect(() => {
    if (open) setDetent(initialDetent);
  }, [open, initialDetent]);

  return (
    <Sheet
      open={open}
      detents={detents}
      detent={detent}
      onDetentChange={setDetent}
      dismissible
      onRequestClose={onClose}
      onClosed={onClosed}
      modal
      backdropLabel={closeLabel}
      ariaLabel={shown.current.ariaLabel}
      slot={overlaySlot}
      contract={verifyAttrs({ unit: 'BottomSheet', detent, open })}
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
              {shown.current.label ?? ''}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] shrink-0 rounded-full border px-4 text-[13px]"
                style={{ ...CONTROL_FONT, color: 'var(--fg)', borderColor: 'var(--border-subtle)' }}
              >
                {closeLabel}
              </button>
              {shown.current.action}
            </div>
          </div>
        </div>
      }
    >
      <div className="px-6 pb-8">{shown.current.children}</div>
    </Sheet>
  );
}
