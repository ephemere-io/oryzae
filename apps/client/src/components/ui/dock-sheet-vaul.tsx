'use client';

// verify-exempt: 試作。Vaul（shadcn/ui の Drawer の中身）で板を作り、`?sheet=vaul` のときだけ差し替わる。
// 実機で手触りを見て全面移行を決める。決まったら `DockSheet` / `Sheet` を置き換えるか、この部品を消す。

import * as Dialog from '@radix-ui/react-dialog';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Drawer } from 'vaul';
import { useSpChrome } from '@/lib/sp-chrome-context';
import type { DockDetent, DockSheetProps } from './dock-sheet';
import { canDragSheet, contentScrolls } from './sheet-gesture';

const PEEK_FIRST: readonly DockDetent[] = ['peek', 'half', 'full'];

/** ここまでの動きは「押した」と見なす（px）。これを超えたら払いとして Vaul に任せる。 */
const TAP_SLOP_PX = 8;

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
 * - Vaul の面は Radix の Dialog なので、**非モーダルの文脈で包む**（下の `Dialog.Root` の注を見よ）
 *
 * ### 外側（板の段）と内側（中身の送り）の段階構造
 *
 * ネイティブのシート（Google マップ・Apple の地図）は、外と内を**同時には**動かさない。
 * オーナーの言葉どおりに書くと:
 *
 * 1. 板がいちばん高い段になるまで、**内側は送れない**。指は必ず板を動かす
 * 2. いちばん高い段でだけ中身が読める
 * 3. 中身を送っている指は、上端に着いても板を動かさない。**一度離す**と、次の指が板を動かす
 *
 * 表と言葉は `sheet-gesture.ts` に置いた（`canDragSheet` / `contentScrolls`）。ここはそれを
 * 次の 4 つで実際の指に当てる。どれも「指を置いた瞬間に決めて、離すまで変えない」:
 *
 * - **内側の `overflow-y` は段で決まる**（いちばん高い段だけ `auto`、それ以外は `hidden`）。
 *   1 と 2 はこれだけで決まる。判定も待ち時間も要らない
 * - **触れた瞬間の `scrollTop` で、その指の持ち主を決める**。0 より大きい（＝読んでいる途中）なら
 *   その指のあいだ `data-vaul-no-drag` を立て、板には渡さない。離せば消える（3）
 * - **`touch-action: pan-y` / `user-select: none`**。Vaul は面に `touch-action: none` を当てるので、
 *   そのままだと内側の箱を指で送れない（実機: 全画面なのに中身が送れないことがある）。長押しで文字が
 *   選ばれると Vaul は drag をやめるので、選択も切る（実機: 強く押してから引くと中身が動いた）
 * - **見出しの行を押して段を変えるのは、指が動かなかったときだけ**。払いは Vaul の drag に任せる。
 *   動いた指でも `click` は出るので、少し引いただけで一気に段が飛んでいた（実機: ちょっと触ると一気に変わる）。
 *   押したときも動くのは **1 段だけ**
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
  /** 見出しの行に指を置いた場所。押した（動かなかった）かどうかの判定に使う。 */
  const tapStart = useRef<{ x: number; y: number } | null>(null);
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
  /**
   * いま止まる段。**`snapPoints` の要素そのもの**を渡す（別に作った同じ文字列ではなく）。
   * 一致しないと Vaul の `activeSnapPointIndex` が -1 になり、面の位置が段から外れる
   * （層の高さが変わった瞬間に起きうる。実機: 全画面なのに中身が送れないことがある）。
   */
  const activeIndex = Math.max(0, detents.indexOf(detent));
  const active = snapPoints[activeIndex] ?? snapPoints[0];
  /** いちばん高い段に居るか。内側を読めるのはこのときだけ。 */
  const atHighest = activeIndex === detents.length - 1;

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
          // 入力欄の位置合わせは殻が担う（殻がビジュアルビューポートに追従する）。Vaul の `isInput` は
          // contentEditable も数えるので、本文にフォーカスしてキーボードが出ると「板の中の入力欄が隠れる」と
          // 誤認して板の高さと位置を書き換え、本文を覆った（実機: そもそも入力できない）。
          repositionInputs={false}
          noBodyStyles
          container={clip}
          snapPoints={snapPoints}
          snapToSequentialPoint
          activeSnapPoint={active}
          setActiveSnapPoint={(point) => {
            // 返ってくるのは `snapPoints` の要素そのもの。位置で引く（文字列を作り直して比べない）。
            const next = detents[snapPoints.indexOf(String(point))];
            if (next && next !== detent) onDetentChange(next);
          }}
        >
          {/*
            Vaul は中で Radix の Dialog を **`modal` を渡さずに** 作る（`vaul/dist/index.mjs` の
            `DialogPrimitive.Root` には `defaultOpen` / `onOpenChange` / `open` しか渡っていない）。
            つまり Vaul の `modal={false}` は Vaul 自身（暗幕・body の後始末）にしか効かず、Radix から
            見た面は**常にモーダル**で、`DialogContentModal` が次の 3 つを付ける:

            1. 焦点の檻（`FocusScope` の `trapped`）— 面の外に焦点が移ると面へ引き戻す
            2. 面以外を `aria-hidden="true"`（`hideOthers`）— 本文が支援技術から消える
            3. `body` の `pointer-events` を止める（Vaul が rAF で戻す）

            板は**本文の隣で読むもの**で、モーダルではない。実機の「発酵の結果が出ていると本文が
            書けない」は 1 そのもの: 本文を押した瞬間に焦点が板へ戻るのでキーボードが出ない
            （WebKit で再現: `.tmp/scripts/r34-vaul-body-focus.mjs`）。

            Radix の `Content` は**いちばん近い Dialog の文脈**を読むので、Vaul の中に非モーダルの
            文脈を置いて上書きする。これで 3 つとも外れる。Vaul と同じ実体の Radix を読んでいることは
            `test/architecture/vaul-dialog-is-shared.test.ts` が守る（別実体になるとこの上書きは
            黙って効かなくなるため）。
          */}
          <Dialog.Root modal={false} open={open}>
            <Drawer.Portal container={clip}>
              <Drawer.Content
                {...contract}
                data-sheet-engine="vaul"
                aria-label={ariaLabel}
                aria-describedby={undefined}
                // 閉じるときに焦点を動かさない（本文で書いている最中にキーボードが出て板が消える）。
                onCloseAutoFocus={(event) => event.preventDefault()}
                className="pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col rounded-t-3xl border-t outline-none"
                style={{
                  height: layerHeight,
                  background: 'var(--surface-raised)',
                  borderColor: 'var(--surface-raised-border)',
                  boxShadow: '0 -8px 32px rgba(140,133,126,0.18)',
                }}
              >
                <Drawer.Title className="sr-only">{ariaLabel}</Drawer.Title>
                <div
                  ref={attachHeader}
                  data-dock-peek
                  className="flex w-full shrink-0 select-none flex-col items-center px-5 pt-2 pb-2"
                  style={{ cursor: 'grab' }}
                  onPointerDown={(event) => {
                    tapStart.current = { x: event.clientX, y: event.clientY };
                  }}
                  onPointerUp={(event) => {
                    const start = tapStart.current;
                    tapStart.current = null;
                    if (!start || !second) return;
                    if (event.target instanceof Element && event.target.closest('button, a, input'))
                      return;
                    // 動いた指は「払い」。段は Vaul が決めるので、ここでは何もしない。
                    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_SLOP_PX)
                      return;
                    // 押したら 1 段だけ動く。いちばん低い段からは開き、それ以外は 1 つ下げる。
                    const index = detents.indexOf(detent);
                    if (detent === lowest) {
                      onPeekTap?.();
                      onDetentChange(second);
                      return;
                    }
                    onDetentChange(detents[Math.max(0, index - 1)] ?? lowest);
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="mb-2 block h-1.5 w-9 rounded-full"
                    style={{ background: 'color-mix(in srgb, var(--fg) 18%, transparent)' }}
                  />
                  {peek ? <div className="flex w-full min-w-0 items-center">{peek}</div> : null}
                </div>
                {/* 中身。いちばん高い段でだけ読める（上の「段階構造」を見よ）。
                  - overscroll-behavior: none — iOS は上端で下へ引くとネイティブの跳ね返りが指を奪い
                    （pointercancel）、板に渡らない。跳ね返りを切れば指は板へ届く
                  - user-select: none — 長押しで文字が選ばれると Vaul は drag をやめる（選択を優先する）。
                    実機の「強く押してから引くと中身が動く」はこれ */}
                <div
                  className="min-h-0 min-w-0 flex-1 px-5 pb-6 [overflow-wrap:anywhere]"
                  style={{
                    overflowY: contentScrolls(atHighest) ? 'auto' : 'hidden',
                    touchAction: contentScrolls(atHighest) ? 'pan-y' : 'none',
                    overscrollBehaviorY: 'none',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                  }}
                  onTouchStart={(event) => {
                    const box = event.currentTarget;
                    // iOS は減速の末に 0.3px などの端数で止まる。0 に揃えてから持ち主を決める。
                    if (box.scrollTop > 0 && box.scrollTop < 1) box.scrollTop = 0;
                    // 読んでいる途中の指は、上端に着いても板を動かさない（離すまで）。
                    // `data-vaul-no-drag` は Vaul が「この指は板に渡さない」と読む印。
                    const mayDrag = canDragSheet({
                      atHighest,
                      onContent: true,
                      scrollTop: box.scrollTop,
                    });
                    if (mayDrag) box.removeAttribute('data-vaul-no-drag');
                    else box.setAttribute('data-vaul-no-drag', '');
                  }}
                  onTouchEnd={(event) => event.currentTarget.removeAttribute('data-vaul-no-drag')}
                  onTouchCancel={(event) =>
                    event.currentTarget.removeAttribute('data-vaul-no-drag')
                  }
                >
                  {children}
                </div>
              </Drawer.Content>
            </Drawer.Portal>
          </Dialog.Root>
        </Drawer.Root>
      ) : null}
    </>
  );
}
