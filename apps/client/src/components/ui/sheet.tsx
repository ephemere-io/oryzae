'use client';

import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { placeInSlot } from '@/lib/sp-chrome-context';

/**
 * シートの段。
 * - `peek`: 見出しの行だけが見える（見出しの行の下端が容器の下端）
 * - `half`: シートの上端が容器の半分
 * - `content`: 中身の高さぶん（容器より高ければ全画面）
 * - `full`: シートの上端が容器の上端。そこから先は同じ指のまま中身が流れる
 */
export type SheetDetent = 'peek' | 'half' | 'content' | 'full';

type Position = SheetDetent | 'closed';

export interface SheetProps {
  /** 出したいか。false にすると閉じる動きのあとで消える（`onClosed`）。 */
  open: boolean;
  /** 使う段。 */
  detents: readonly SheetDetent[];
  /** いまの段（制御）。変えるとその段へスクロールで動く。 */
  detent: SheetDetent;
  /** 指で動かして別の段に止まったとき。 */
  onDetentChange: (detent: SheetDetent) => void;
  /** 指で下へ払いきって閉じられるか。 */
  dismissible: boolean;
  /** 指で閉じた（払いきった）とき。呼び出し側は `open` を false にする。 */
  onRequestClose?: () => void;
  /** 閉じる動きが終わって消えたとき。 */
  onClosed?: () => void;
  /** モーダル（暗幕あり・外を押すと閉じる）か。 */
  modal: boolean;
  /** 暗幕のボタンの読み上げ名（モーダルのとき）。 */
  backdropLabel?: string;
  ariaLabel: string;
  /** 上に貼り付く見出しの行（つまみを含めて呼び出し側が描く）。 */
  header: ReactNode;
  /** 見出しの行を押したとき（中のボタンを押したときは呼ばない）。 */
  onHeaderTap?: () => void;
  children: ReactNode;
  /** 描く席（殻の overlay / ドックの層）。無ければその場に描く。 */
  slot: HTMLElement | null;
  /** 段に止まったとき、見えている高さ（px）。本文の余白に使う。 */
  onSettle?: (visiblePx: number) => void;
  /** 検証の契約（根に付ける）。 */
  contract?: Record<string, string>;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 下から出るシートの**唯一の構造**（`BottomSheet` / `DockSheet` はこの上の包み）。
 *
 * ### ネイティブのスクロールと CSS scroll-snap で動かす
 *
 * 画面いっぱいのスクロール容器（`scroll-snap-type: y mandatory`）の中に、容器の高さの空き（spacer）と
 * シートを縦に積む。指の追従・慣性・減速・段への吸着は**ブラウザのスクロールそのもの**で、JS は指の動きを
 * 受けない。以前は指の動きを JS で受けて transform と scrollTop を書いていて、慣性の係数や段を選ぶ速さの
 * しきい値を数値で持っていた。ブラウザのスクロールと手触りが違い、カクつき・減衰・一瞬で消える、に
 * なっていた（実機レビュー）。
 *
 * 段は**要素の位置**が決める（数値を持たない）:
 * - 閉: spacer の上端（scrollTop 0 でシートは容器の下に隠れる）
 * - 半分: 容器の子の印（`top: 50%`）
 * - 覗く: 見出しの行と同じ升の中の印（`top: calc(100% - 100cqh)`、上端揃え）＝見出しの行の高さ
 * - 中身: シートの中の印（`top: calc(min(100%, 100cqh) - 100cqh)`、上端揃え）＝中身の高さ、容器より高ければ
 *   全画面。上端揃えにしているのは、WebKit が「高さ 0 の要素の下端揃え」を吸着先として数えないため
 *   （Chromium は数える。下端揃えで書いていた頃、Safari では中身の段が無く全画面へ吸い寄せられた）
 * - 全画面: シートの上端。シートは容器より高いので、そこから先は自由にスクロールでき（CSS scroll-snap の
 *   仕様: 容器より大きい snap 領域の中は自由）、Google マップと同じく同じ指で中身が流れる
 *
 * 見出しの行は `position: sticky` で、全画面の先へ流れても上に残る。
 *
 * 開く・段を変える・閉じるは `scrollTo({ behavior: 'smooth' })`（位置は印を測る）。止まった位置も閉じ終わりも
 * 同じ見張り（スクロールが 2 フレーム動かず、その位置が段か閉の位置と一致する）で知る。
 * `IntersectionObserver` は使わない: 容器の下端にちょうど接したシートは仕様上「交差している」扱いで、
 * 払いきっても閉じ終わりが来なかった。非モーダルは容器を `pointer-events: none` にしてシートだけ押せる
 * （iOS Safari の回避策は `globals.css` の `.oz-sheet-pass`）。
 */
export function Sheet({
  open,
  detents,
  detent,
  onDetentChange,
  dismissible,
  onRequestClose,
  onClosed,
  modal,
  backdropLabel,
  ariaLabel,
  header,
  onHeaderTap,
  children,
  slot,
  onSettle,
  contract,
}: SheetProps) {
  const [present, setPresent] = useState(open);
  const [phase, setPhase] = useState<'opening' | 'open' | 'closing'>('opening');
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLElement | null>(null);
  const halfRef = useRef<HTMLDivElement | null>(null);
  const peekRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLButtonElement | null>(null);
  /** 最後に止まった位置（指で止めたものも、呼び出し側が頼んだものも）。 */
  const settledRef = useRef<Position | null>(null);
  /** 閉じる動き: 閉じ直しを 1 回使ったか、（閉じ直してから）動いたか。 */
  const closingRef = useRef<{ retried: boolean; moved: boolean } | null>(null);
  /** 閉じる動きの途中から開き直しているか（開くときに閉の位置へ戻さない）。 */
  const resumingRef = useRef(false);
  /** スクロールの見張りを 1 回走らせる（閉じる動きを頼んだ直後に、止まっていても気づけるように）。 */
  const kickRef = useRef<(() => void) | null>(null);
  const latest = useRef({
    detent,
    detents,
    onDetentChange,
    onRequestClose,
    onClosed,
    onSettle,
    phase,
    dismissible,
  });
  latest.current = {
    detent,
    detents,
    onDetentChange,
    onRequestClose,
    onClosed,
    onSettle,
    phase,
    dismissible,
  };

  // 開く／閉じるの切り替え。閉じるときは消さずに閉じる動きへ。閉じる途中で開けば、その場から開き直す。
  useEffect(() => {
    if (open) {
      // 閉じる動きの途中から開き直すなら、いまの位置から上がる（下まで落としてから上げ直さない）。
      resumingRef.current = closingRef.current !== null;
      closingRef.current = null;
      setPresent(true);
      setPhase('opening');
    } else {
      setPhase((current) => (current === 'closing' ? current : 'closing'));
    }
  }, [open]);

  /** 位置 → そこに止まるときの scrollTop。印の位置を測る。 */
  const targetOf = useCallback((position: Position): number => {
    const scroller = scrollerRef.current;
    if (!scroller) return 0;
    if (position === 'closed') return 0;
    const top = scroller.getBoundingClientRect().top;
    // 印はすべて上端揃え（WebKit は下端揃えの吸着先を数え落とすことがある）。上端の位置を測る。
    const inContent = (el: Element | null) => {
      if (!el) return 0;
      return el.getBoundingClientRect().top - top + scroller.scrollTop;
    };
    switch (position) {
      case 'half':
        return inContent(halfRef.current);
      case 'peek':
        return inContent(peekRef.current);
      case 'content':
        return inContent(contentRef.current);
      case 'full':
        return inContent(sheetRef.current);
    }
  }, []);

  const scrollToPosition = useCallback(
    (position: Position) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const top = targetOf(position);
      if (typeof scroller.scrollTo !== 'function') {
        scroller.scrollTop = top;
        return;
      }
      scroller.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    },
    [targetOf],
  );

  const finishClose = useCallback(() => {
    settledRef.current = null;
    setPresent(false);
    latest.current.onClosed?.();
  }, []);

  // 開く: 閉の位置（scrollTop 0）から頼まれた段へスクロールで上がる。閉じる途中で開き直したときは、
  // いまの位置から上がる（下まで落としてから上げ直さない）。
  useLayoutEffect(() => {
    if (!present || phase !== 'opening') return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    // 新しく開くときは閉の位置から。WebKit は吸着の容器を描いた直後に、自分で選んだ吸着先（半分など）へ
    // 置くことがあり、そこから段へ送ると覗く段に届かず半分で止まった。
    if (!resumingRef.current) scroller.scrollTop = 0;
    resumingRef.current = false;
    const frame = requestAnimationFrame(() => scrollToPosition(latest.current.detent));
    return () => cancelAnimationFrame(frame);
  }, [present, phase, scrollToPosition]);

  // 閉じる: 閉の位置へスクロールで下がる。閉じ終わりはスクロールの見張りが知る。
  useEffect(() => {
    if (!present || phase !== 'closing') return;
    const scroller = scrollerRef.current;
    // 配置の無い環境（テスト）、または既に閉の位置（指で払いきった直後）なら、そのまま消す。
    if (!scroller || scroller.clientHeight === 0 || scroller.scrollTop <= targetOf('closed')) {
      finishClose();
      return;
    }
    closingRef.current = { retried: false, moved: false };
    scrollToPosition('closed');
    kickRef.current?.();
  }, [present, phase, scrollToPosition, targetOf, finishClose]);

  // 呼び出し側が段を変えたら、その段へ動く（指で止めた段の通知の折り返しでは動かない）。
  useEffect(() => {
    if (!present || phase !== 'open') return;
    if (settledRef.current === detent) return;
    scrollToPosition(detent);
  }, [detent, present, phase, scrollToPosition]);

  // スクロールを見て、暗幕の濃さを書き、止まった段を知らせる。止まった＝2 フレーム続けて同じ位置で、
  // その位置がどれかの段の位置と一致する（時間のしきい値を持たない）。
  useEffect(() => {
    if (!present) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let frame = 0;
    let lastTop = Number.NaN;

    const visibleOf = () => {
      const sheet = sheetRef.current;
      if (!sheet) return 0;
      const box = scroller.getBoundingClientRect();
      return Math.max(0, Math.min(box.height, box.bottom - sheet.getBoundingClientRect().top));
    };

    const check = () => {
      frame = 0;
      const top = scroller.scrollTop;
      const visible = visibleOf();
      if (backdropRef.current && scroller.clientHeight > 0) {
        backdropRef.current.style.opacity = String(Math.min(1, visible / scroller.clientHeight));
      }
      if (top !== lastTop) {
        if (!Number.isNaN(lastTop) && closingRef.current) closingRef.current.moved = true;
        lastTop = top;
        frame = requestAnimationFrame(check);
        return;
      }
      const current = latest.current;
      if (current.phase === 'closing') {
        // 1px 未満の差は同じ位置（スクロール位置は小数になる）。
        if (Math.abs(targetOf('closed') - top) < 1) {
          finishClose();
          return;
        }
        // 閉の位置に届かずに止まった（指で止めた・吸着に引き戻された・滑らかな送りが途切れた）。
        // 1 回だけ閉じ直す。閉じ直しても動いたあとで止まるなら、その場で閉じ終える（閉じると
        // 決まったシートが画面に残り続けるのが最悪なので）。まだ一度も動いていないなら待つ。
        const closing = closingRef.current;
        if (!closing) return;
        if (!closing.retried) {
          closing.retried = true;
          closing.moved = false;
          scrollToPosition('closed');
          lastTop = Number.NaN;
          frame = requestAnimationFrame(check);
          return;
        }
        if (closing.moved) {
          scroller.scrollTop = targetOf('closed');
          finishClose();
        }
        return;
      }
      // 閉の位置は開き終わってから止まる先として数える（開く前の scrollTop 0 を「閉じた」と取り違えない）。
      // 閉じる動きの最中は上で済ませている。
      const candidates: Position[] =
        current.phase === 'open' ? ['closed', ...current.detents] : [...current.detents];
      let settled: Position | null = null;
      for (const candidate of candidates) {
        // 1px 未満の差は同じ位置（スクロール位置は小数になる）。
        if (Math.abs(targetOf(candidate) - top) < 1) {
          settled = candidate;
          break;
        }
      }
      // 全画面の先（中身を読み進めた位置）も全画面の段に居る。
      if (!settled && current.detents.includes('full') && top > targetOf('full')) settled = 'full';
      if (!settled) return;
      if (settled === 'closed') {
        // 払って閉じられるシートは閉じる。閉じられない板（発酵の結果）は、いちばん低い段へ戻す。
        if (current.dismissible) current.onRequestClose?.();
        else scrollToPosition(current.detents[0] ?? 'peek');
        return;
      }
      settledRef.current = settled;
      if (current.phase === 'opening' && settled === current.detent) setPhase('open');
      if (current.phase === 'open' && settled !== current.detent) {
        current.onDetentChange(settled);
      }
      current.onSettle?.(visible);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    kickRef.current = onScroll;
    scroller.addEventListener('scroll', onScroll, { passive: true });
    // 容器の大きさが変わった（キーボード・回転）ときも、止まっている段の見えている高さを知らせ直す。
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => onScroll());
    observer?.observe(scroller);
    return () => {
      kickRef.current = null;
      scroller.removeEventListener('scroll', onScroll);
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [present, targetOf, finishClose, scrollToPosition]);

  if (!present) return null;

  const has = (d: SheetDetent) => detents.includes(d);

  return placeInSlot(
    <div
      {...contract}
      data-sheet-phase={phase}
      // isolate: シートごとに重なりの文脈を閉じる。同じ席に 2 枚居るとき（発酵の結果と設定）、上に貼り付く
      // 見出しの z-index が隣のシートの上へ漏れず、後から出た 1 枚が丸ごと上に来る。
      className="pointer-events-none absolute inset-0 isolate overflow-hidden"
    >
      {modal ? (
        <button
          ref={backdropRef}
          type="button"
          aria-label={backdropLabel ?? ariaLabel}
          onClick={() => latest.current.onRequestClose?.()}
          // 閉じる動きの間は指を下の画面へ通す。閉じ終わりが遅れても、見えない暗幕が押下を吸わない。
          className={`${phase === 'closing' ? 'pointer-events-none' : 'pointer-events-auto'} absolute inset-0`}
          style={{ background: 'color-mix(in srgb, var(--fg) 28%, transparent)', opacity: 0 }}
        />
      ) : null}
      <div
        ref={scrollerRef}
        className="oz-sheet-scroller absolute inset-0 overflow-y-auto"
        style={{
          scrollSnapType: 'y mandatory',
          overscrollBehavior: 'contain',
          containerType: 'size',
        }}
      >
        {/* 閉の位置。scrollTop 0 でシートは容器の下に隠れている。**吸着先の組は開いている間に変えない。**
            WebKit は吸着先の組が変わると、いまの段に居ても別の段（半分）へ吸着し直す（最小の再現で確認）。
            閉じられない板でも閉の位置は吸着先のままにし、そこへ払われたら低い段へ戻す。 */}
        <div aria-hidden="true" style={{ height: '100%', scrollSnapAlign: 'start' }} />
        {/* 半分の段の印。容器の子の `top: 50%` は容器の高さの半分。 */}
        <div
          ref={halfRef}
          aria-hidden="true"
          className="absolute left-0 h-px w-px"
          style={{ top: '50%', scrollSnapAlign: has('half') ? 'start' : 'none' }}
        />
        <section
          ref={sheetRef}
          role="dialog"
          aria-modal={modal ? true : undefined}
          aria-label={ariaLabel}
          className="pointer-events-auto relative rounded-t-3xl border-t"
          style={{
            // 全画面の段を持つシートは容器と同じ高さを持つ（全画面で面が下まで届く）。
            minHeight: has('full') ? '100%' : undefined,
            background: 'var(--surface-raised)',
            borderColor: 'var(--surface-raised-border)',
            boxShadow: '0 -8px 32px rgba(140,133,126,0.18)',
            scrollSnapAlign: has('full') ? 'start' : 'none',
          }}
        >
          <div className="relative grid">
            {/* 覗く段の印。見出しの行と同じ升（高さ＝見出しの行）に置いた箱の中で、「見出しの行の下端から容器の
                高さぶん上」に置き、上端揃えで吸着する＝見出しの行だけが見える。下端揃えにしていた頃、WebKit は
                吸着の候補が変わったとき（開き終わり）の吸着し直しでこの段を数えず、半分へ跳ねた。 */}
            <div aria-hidden="true" className="relative" style={{ gridArea: '1 / 1' }}>
              <div
                ref={peekRef}
                className="absolute left-0 h-0 w-px"
                style={{
                  top: 'calc(100% - 100cqh)',
                  scrollSnapAlign: has('peek') ? 'start' : 'none',
                }}
              />
            </div>
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: 見出しの行を押すのは段の切り替えの近道。同じことはつまみを引いてもできる */}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: 同上（中のボタンは各自のキーボード操作を持つ） */}
            <div
              data-sheet-header
              className="oz-sheet-pass sticky top-0 z-[1] rounded-t-3xl"
              style={{ gridArea: '1 / 1', background: 'var(--surface-raised)' }}
              onClick={(event) => {
                if (!onHeaderTap) return;
                if (event.target instanceof Element && event.target.closest('button, a, input'))
                  return;
                onHeaderTap();
              }}
            >
              {header}
            </div>
            <div className="oz-sheet-pass" style={{ gridRow: 2 }}>
              {children}
            </div>
            {/* 中身の段の印。「中身の下端（容器より高ければ容器の高さ）から容器の高さぶん上」に置き、上端揃えで
                吸着する＝シートの中身の下端が容器の下端に来る。 */}
            <div
              ref={contentRef}
              aria-hidden="true"
              className="absolute left-0 h-0 w-px"
              style={{
                top: 'calc(min(100%, 100cqh) - 100cqh)',
                scrollSnapAlign: has('content') ? 'start' : 'none',
              }}
            />
          </div>
        </section>
      </div>
    </div>,
    slot,
  );
}
