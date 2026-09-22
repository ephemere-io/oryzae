'use client';

// verify-exempt: 試作。Vaul（shadcn/ui の Drawer の中身）で板を作り、`?sheet=vaul` のときだけ差し替わる。
// 実機で手触りを見て全面移行を決める。決まったら `DockSheet` / `Sheet` を置き換えるか、この部品を消す。

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Drawer } from 'vaul';
import { useSpChrome } from '@/lib/sp-chrome-context';
import type { DockDetent, DockSheetProps } from './dock-sheet';

const PEEK_FIRST: readonly DockDetent[] = ['peek', 'half', 'full'];

/**
 * 非モーダルの板（発酵の結果）を Vaul で。
 *
 * 現行の `Sheet` は「段の切り替え＝ネイティブの scroll-snap」「中身の読み＝別のスクロール容器」で、どちらの指かを
 * スクロールの通知の順番で決めていた（`overflow` / `overscroll-behavior` の切り替え）。これはイベントの順番と
 * 時間に依存し、iOS で毎回違う形で破れた（実機レビュー 20 回超）。Vaul は指を JS の状態機械で持ち、触れた瞬間に
 * 中身の `scrollTop` を読んで「上端に居て下へ引く指だけをシートに渡す」。同じ指の続きで判断が変わらない。
 *
 * - 段は `snapPoints`（px）。殻のドックの層の高さから決める（覗く＝見出しの行、半分＝層の半分、全画面＝層いっぱい）
 * - 段は 1 回の払いで 1 つずつ（`snapToSequentialPoint`）
 * - 板なので `modal={false}`（後ろは触れる・暗転しない）、`dismissible={false}`（指では消えない）
 * - 殻のドックの層に出す。層の中に**切り取る包み**（`overflow: hidden`）を置き、そこへ Vaul の面を出す
 *   （`container`）。面は包みの中の `position: absolute`。低い段では面の下半分が層の外にはみ出すので、切らないと
 *   その部分がパレットを覆う（実機: パレットが消えた）。`fixed` にして層に `transform` で閉じ込める作りは、
 *   実機（iOS の PWA）で効かず、画面の下端を基準に置かれた
 * - 段に止まるたびに見えている高さを `--sp-dock-inset` に渡す（本文の末尾が板の下に隠れない）
 */
export function DockSheetVaul({
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
  /** 層の中の切り取る包み。Vaul はここへ出す。 */
  const [clip, setClip] = useState<HTMLDivElement | null>(null);
  const [layerHeight, setLayerHeight] = useState(0);
  const [peekHeight, setPeekHeight] = useState(0);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const lowest = detents[0] ?? 'peek';
  const second = detents[1];

  // 層の高さを測る（段の px はここから決まる）。
  useEffect(() => {
    if (!dockSlot) return;
    const measure = () => setLayerHeight(Math.round(dockSlot.clientHeight));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(dockSlot);
    return () => observer.disconnect();
  }, [dockSlot]);

  // 見出しの行の高さ（覗く段）。
  const attachHeader = useCallback((element: HTMLDivElement | null) => {
    headerRef.current = element;
    if (element) setPeekHeight(Math.round(element.getBoundingClientRect().height));
  }, []);
  useEffect(() => {
    const header = headerRef.current;
    if (!header || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() =>
      setPeekHeight(Math.round(header.getBoundingClientRect().height)),
    );
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  const pxOf = useCallback(
    (position: DockDetent): number => {
      switch (position) {
        case 'peek':
          return peekHeight || 56;
        case 'half':
          return Math.round(layerHeight / 2);
        default:
          return layerHeight;
      }
    },
    [peekHeight, layerHeight],
  );
  const snapPoints = detents.map((position) => `${pxOf(position)}px`);
  const active = `${pxOf(detent)}px`;

  // 見えている高さを本文の余白へ。
  useEffect(() => {
    const layer = dockSlot?.parentElement;
    if (!layer) return;
    layer.style.setProperty('--sp-dock-inset', open ? `${pxOf(detent)}px` : '0px');
    return () => layer.style.setProperty('--sp-dock-inset', '0px');
  }, [dockSlot, open, detent, pxOf]);

  if (!dockSlot) return null;

  return (
    <>
      {createPortal(
        <div ref={setClip} className="pointer-events-none absolute inset-0 overflow-hidden" />,
        dockSlot,
      )}
      {clip && layerHeight > 0 ? (
        <Drawer.Root
          open={open}
          modal={false}
          dismissible={false}
          noBodyStyles
          container={clip}
          snapPoints={snapPoints}
          snapToSequentialPoint
          activeSnapPoint={active}
          setActiveSnapPoint={(point) => {
            const next = detents.find((position) => `${pxOf(position)}px` === point);
            if (next && next !== detent) onDetentChange(next);
          }}
        >
          <Drawer.Portal container={clip}>
            <Drawer.Content
              {...contract}
              data-sheet-engine="vaul"
              aria-label={ariaLabel}
              aria-describedby={undefined}
              className="pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col rounded-t-3xl border-t outline-none"
              style={{
                height: layerHeight,
                background: 'var(--surface-raised)',
                borderColor: 'var(--surface-raised-border)',
                boxShadow: '0 -8px 32px rgba(140,133,126,0.18)',
              }}
            >
              <Drawer.Title className="sr-only">{ariaLabel}</Drawer.Title>
              {/* biome-ignore lint/a11y/useKeyWithClickEvents: 見出しの行を押すのは段の切り替えの近道。同じことはつまみを引いてもできる */}
              {/* biome-ignore lint/a11y/noStaticElementInteractions: 同上 */}
              <div
                ref={attachHeader}
                data-dock-peek
                className="flex w-full shrink-0 select-none flex-col items-center px-5 pt-2 pb-2"
                style={{ cursor: 'grab' }}
                onClick={(event) => {
                  if (!second) return;
                  if (event.target instanceof Element && event.target.closest('button, a, input'))
                    return;
                  if (detent === lowest) {
                    onPeekTap?.();
                    onDetentChange(second);
                  } else {
                    onDetentChange(lowest);
                  }
                }}
              >
                <span
                  aria-hidden="true"
                  className="mb-2 block h-1.5 w-9 rounded-full"
                  style={{ background: 'color-mix(in srgb, var(--fg) 18%, transparent)' }}
                />
                {peek ? <div className="flex w-full min-w-0 items-center">{peek}</div> : null}
              </div>
              {/* 中身。いちばん高い段で読める。上端に居て下へ引けば板が縮む（Vaul が指の向きと scrollTop で決める）。 */}
              <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-5 pb-6 [overflow-wrap:anywhere]">
                {children}
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      ) : null}
    </>
  );
}
