'use client';

import { verifyAttrs } from '@oryzae/verify';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { useSpChrome } from '@/lib/sp-chrome-context';
import { Sheet, type SheetDetent } from './sheet';

export type DockDetent = SheetDetent;

export interface DockSheetProps {
  /** 出ているか（パレットのボタンが決める）。false にすると引っ込む動きのあとで消える。指では消えない。 */
  open: boolean;
  detent: DockDetent;
  onDetentChange: (detent: DockDetent) => void;
  ariaLabel: string;
  /** 使う段（低い順）。既定は覗く・半分・全画面。 */
  detents?: readonly DockDetent[];
  /** 上に貼り付く見出しの行の中身（つまみは部品が描く）。 */
  peek?: ReactNode;
  /** いちばん低い段で見出しの行を押したとき（呼び出し側がフォーカスを外す、等）。 */
  onPeekTap?: () => void;
  /** 検証の契約。渡せば部品の契約（DockSheet）の代わりに根に付ける（呼び出し側の単位で読まれるように）。 */
  contract?: Record<string, string>;
  children: ReactNode;
}

const PEEK_FIRST: readonly DockDetent[] = ['peek', 'half', 'full'];

/** 層ごとの、シートごとの見えている高さ。 */
const INSETS = new WeakMap<HTMLElement, Map<symbol, number>>();

/**
 * 本文の上に重なる**非モーダル**のシート（Google マップの「場所」のシート）。動きは `Sheet`。
 *
 * - 暗転しない。シートの外（容器の空き）は指を通すので、上の本文はそのまま触れて読める
 * - **出す／消すはボタン、指は高さだけ**（一番低い段より下へは引っ込まない）
 * - 殻のドックの層（本文と同じ箱。下端の操作の列は覆わない）に出る
 * - 段に止まるたびに、見えている高さを本文の `padding-bottom` / `scroll-padding-bottom` に渡す
 *   （CSS 変数 `--sp-dock-inset`）。本文の末尾やカーソルの行がシートの下に隠れない
 * - 見出しの行を押すと、いちばん低い段とその次の段を行き来する
 */
export function DockSheet({
  open,
  detent,
  onDetentChange,
  ariaLabel,
  detents = PEEK_FIRST,
  peek,
  onPeekTap,
  contract,
  children,
}: DockSheetProps) {
  const { dockSlot } = useSpChrome();
  const lowest = detents[0] ?? 'peek';
  const second = detents[1];

  // ドックの層には複数のシート（発酵の結果と設定）が同時に居ることがある。本文の余白はいちばん高いものに合わせる。
  const [key] = useState(() => Symbol('dock'));
  const setInset = useCallback(
    (px: number) => {
      const layer = dockSlot?.parentElement;
      if (!layer) return;
      const byLayer = INSETS.get(layer) ?? new Map<symbol, number>();
      INSETS.set(layer, byLayer);
      if (px > 0) byLayer.set(key, px);
      else byLayer.delete(key);
      const max = Math.max(0, ...byLayer.values());
      layer.style.setProperty('--sp-dock-inset', `${Math.round(max)}px`);
    },
    [dockSlot, key],
  );
  // 消えたら本文の余白を戻す。
  useEffect(() => () => setInset(0), [setInset]);

  return (
    <Sheet
      open={open}
      detents={detents}
      detent={detent}
      onDetentChange={onDetentChange}
      onClosed={() => setInset(0)}
      modal={false}
      ariaLabel={ariaLabel}
      slot={dockSlot}
      onSettle={setInset}
      contract={contract ?? verifyAttrs({ unit: 'DockSheet', detent })}
      onHeaderTap={
        second
          ? () => {
              if (detent === lowest) {
                onPeekTap?.();
                onDetentChange(second);
              } else {
                onDetentChange(lowest);
              }
            }
          : undefined
      }
      header={
        <div
          data-dock-peek
          className="flex w-full select-none flex-col items-center px-5 pt-2 pb-2"
          style={{ cursor: 'grab' }}
        >
          <span
            aria-hidden="true"
            className="mb-2 block h-1.5 w-9 rounded-full"
            style={{ background: 'color-mix(in srgb, var(--fg) 18%, transparent)' }}
          />
          {peek ? <div className="flex w-full min-w-0 items-center">{peek}</div> : null}
        </div>
      }
    >
      <div className="px-5 pb-6">{children}</div>
    </Sheet>
  );
}
