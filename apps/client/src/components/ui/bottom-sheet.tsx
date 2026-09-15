'use client';

import { verifyAttrs } from '@oryzae/verify';
import { type ReactNode, useRef, useState } from 'react';
import { useSpChrome } from '@/lib/sp-chrome-context';
import { Sheet, type SheetDetent } from './sheet';
import { CONTROL_FONT } from './surface';

export interface BottomSheetProps {
  /** 開いているか。呼び出し側が持つ（中身が無くなったら false）。 */
  open: boolean;
  /**
   * 閉じたいとき（閉じる・暗幕）。**押した時点で呼ぶ**ので、呼び出し側はここで `open` を false にする。
   * 引っ込む動きの間は、最後に開いていたときの中身を部品が描き続ける。指でシートを下げても閉じない
   * （指は高さだけ。実機レビュー）。
   */
  onClose: () => void;
  /** 引っ込む動きが終わって消えたとき。 */
  onClosed?: () => void;
  /** 読み上げ用の名前。 */
  ariaLabel: string;
  /** 見出し（左上の小さなラベル）。 */
  label?: string;
  /** 閉じるボタンと暗幕の名前。 */
  closeLabel: string;
  /**
   * 見出しの右に閉じるボタンを出すか。中身の操作の行（`ActionRow`）に「キャンセル」を固めるシートは出さない
   * （閉じるが見出しと操作の行の 2 か所に散らないように）。
   */
  closeInHeader?: boolean;
  /** 止まる段。既定は半分と全画面。中身が短いシートは `['content']`。 */
  detents?: readonly SheetDetent[];
  /** 最初に止まる段。 */
  initialDetent?: SheetDetent;
  children: ReactNode;
}

/**
 * 下から出る**モーダル**のシート（暗幕あり・外を押すと閉じる）。動きは `Sheet`（出入りは CSS の transition、
 * 高さはネイティブのスクロールと CSS scroll-snap）。SP の殻の中なら殻の overlay の席に出る。
 *
 * **開いているかは呼び出し側が持ち、部品は常に描いておく**（`<BottomSheet open={item !== null}>`）。
 * 引っ込む途中で `open` が true に戻れば、その場から出し直す。
 */
export function BottomSheet({
  open,
  onClose,
  onClosed,
  ariaLabel,
  label,
  closeLabel,
  closeInHeader = true,
  detents = ['half', 'full'],
  initialDetent = 'half',
  children,
}: BottomSheetProps) {
  const { overlaySlot } = useSpChrome();
  const [detent, setDetent] = useState<SheetDetent>(initialDetent);
  // 開くたびに最初の段から（開いた描画のうちに戻す。effect で戻すと、前の段に置いてから動き直す）。
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDetent(initialDetent);
  }

  // 引っ込む動きの間は、最後に開いていたときの中身と見出しを描く（呼び出し側の中身はもう無い）。
  const shown = useRef({ children, label, ariaLabel });
  if (open) shown.current = { children, label, ariaLabel };

  return (
    <Sheet
      open={open}
      detents={detents}
      detent={detent}
      onDetentChange={setDetent}
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
          <div className="flex min-h-[40px] w-full items-center justify-between gap-3">
            <span
              className="min-w-0 truncate text-[11px] uppercase tracking-[0.14em]"
              style={{ ...CONTROL_FONT, color: 'var(--accent)' }}
            >
              {shown.current.label ?? ''}
            </span>
            {closeInHeader ? (
              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] shrink-0 rounded-full border px-4 text-[13px]"
                style={{ ...CONTROL_FONT, color: 'var(--fg)', borderColor: 'var(--border-subtle)' }}
              >
                {closeLabel}
              </button>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="px-6 pb-8">{shown.current.children}</div>
    </Sheet>
  );
}
