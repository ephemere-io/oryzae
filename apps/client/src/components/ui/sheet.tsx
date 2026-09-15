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

export interface SheetProps {
  /** 出したいか。false にすると下へ引っ込む動きのあとで消える（`onClosed`）。 */
  open: boolean;
  /** 使う段（低い順）。 */
  detents: readonly SheetDetent[];
  /** いまの段（制御）。変えるとその段へスクロールで動く。 */
  detent: SheetDetent;
  /** 指で動かして別の段に止まったとき。 */
  onDetentChange: (detent: SheetDetent) => void;
  /** 暗幕を押したとき（モーダル）。呼び出し側は `open` を false にする。 */
  onRequestClose?: () => void;
  /** 引っ込む動きが終わって消えたとき。 */
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

/**
 * - `entering`: 描いた直後。容器の下に隠したまま、頼まれた段へ置く
 * - `open`: 出ている
 * - `closing`: 下へ引っ込む動きの途中
 */
type Phase = 'entering' | 'open' | 'closing';

/**
 * 下から出るシートの**唯一の構造**（`BottomSheet` / `DockSheet` はこの上の包み）。
 *
 * ### 役割を分ける: 出す／消すはボタン、高さは指
 *
 * - **指（スクロール）は高さだけを変える。** 一番低い段より下には止まれない。下まで引いても、離せばブラウザの吸着で
 *   一番低い段へ戻る。以前は閉の位置（容器の下）も吸着先に持ち、そこへ着いたら閉じる（閉じられない板は JS で
 *   送り返す）作りで、iOS では送り返しが効かずに消えたまま残った。パレットは緑のままなのに結果が無い、になった
 *   （実機レビュー: 押す／押さないで出す／出さない、指では高さ）
 * - **出す／消すは `open`**（パレットや歯車のボタン、暗幕、キャンセル）。動きはシートの容器を下へずらす CSS の
 *   transition（`.oz-sheet-scroller[data-shown]`）。消える動きの終わりは transition の完了で知る
 *
 * ### 高さはネイティブのスクロールと CSS scroll-snap で動かす
 *
 * 画面いっぱいのスクロール容器（`scroll-snap-type: y mandatory`）の中に、容器の高さの空き（spacer）と
 * シートを縦に積む。指の追従・慣性・減速・段への吸着は**ブラウザのスクロールそのもの**で、JS は指の動きを
 * 受けない。
 *
 * 段は**要素の位置**が決める（数値を持たない）:
 * - 半分: 容器の子の印（`top: 50%`）
 * - 覗く: 見出しの行と同じ升の中の印（`top: calc(100% - 100cqh)`、上端揃え）＝見出しの行の高さ
 * - 中身: シートの中の印（`top: calc(min(100%, 100cqh) - 100cqh)`、上端揃え）＝中身の高さ、容器より高ければ
 *   全画面。上端揃えにしているのは、WebKit が「高さ 0 の要素の下端揃え」を吸着先として数えないため
 * - 全画面: シートの上端。シートは容器より高いので、そこから先は自由にスクロールでき（CSS scroll-snap の
 *   仕様: 容器より大きい snap 領域の中は自由）、Google マップと同じく同じ指で中身が流れる
 *
 * **吸着先の組は描いている間に変えない。** WebKit は吸着先の組が変わると、いまの段に居ても別の段へ吸着し直す。
 *
 * 見出しの行は `position: sticky` で、全画面の先へ流れても上に残る。止まった段は見張り（スクロールが 2 フレーム
 * 動かず、その位置が段の位置と一致する）で知る。非モーダルは容器を `pointer-events: none` にしてシートだけ押せる
 * （iOS Safari の回避策は `globals.css` の `.oz-sheet-pass`）。
 */
export function Sheet({
  open,
  detents,
  detent,
  onDetentChange,
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
  const [phase, setPhase] = useState<Phase>('entering');
  const presentRef = useRef(present);
  presentRef.current = present;
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  /**
   * スクロール容器の要素（state）。席（殻のドックの層）が後から用意されると、シートは同じ部品のまま**別の要素に
   * 描き直される**（その場 → portal）。ref だけで持っていた頃は、見張りが古い要素に付いたままで、止まった段も
   * 本文の余白（`--sp-dock-inset`）も知らせず、最初から出ている発酵の結果の下に本文の末尾が隠れていた。
   */
  const [scrollerEl, setScrollerEl] = useState<HTMLDivElement | null>(null);
  const attachScroller = useCallback((element: HTMLDivElement | null) => {
    scrollerRef.current = element;
    setScrollerEl(element);
  }, []);
  const sheetRef = useRef<HTMLElement | null>(null);
  const halfRef = useRef<HTMLDivElement | null>(null);
  const peekRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLButtonElement | null>(null);
  /** 最後に止まった段（指で止めたものも、呼び出し側が頼んだものも）。 */
  const settledRef = useRef<SheetDetent | null>(null);
  const latest = useRef({
    detent,
    detents,
    onDetentChange,
    onRequestClose,
    onClosed,
    onSettle,
    phase,
  });
  latest.current = { detent, detents, onDetentChange, onRequestClose, onClosed, onSettle, phase };

  // 出す／消す。消すときは消さずに引っ込む動きへ。引っ込む途中で出せば、その場から戻る（transition が折り返す）。
  useEffect(() => {
    if (open) {
      if (presentRef.current) {
        // 引っ込む途中なら戻す。描いた直後（段へ置く前）はそのまま（置いてから出す）。
        setPhase((current) => (current === 'closing' ? 'open' : current));
      } else {
        setPresent(true);
        setPhase('entering');
      }
    } else if (presentRef.current) {
      setPhase('closing');
    }
  }, [open]);

  /** 段 → そこに止まるときの scrollTop。印の位置を測る。 */
  const targetOf = useCallback((position: SheetDetent): number => {
    const scroller = scrollerRef.current;
    if (!scroller) return 0;
    // 印はすべて上端揃え（WebKit は下端揃えの吸着先を数え落とすことがある）。上端の位置を測る。
    // 容器ごと下へずらしている間も測れるよう、容器からの相対で測る。
    const top = scroller.getBoundingClientRect().top;
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

  const scrollToDetent = useCallback(
    (position: SheetDetent, behavior: 'smooth' | 'instant') => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const top = targetOf(position);
      if (typeof scroller.scrollTo !== 'function') {
        scroller.scrollTop = top;
        return;
      }
      const reduced =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      scroller.scrollTo({
        top,
        behavior: behavior === 'smooth' && !reduced ? 'smooth' : 'instant',
      });
    },
    [targetOf],
  );

  // 描いた直後: 容器の下に隠したまま頼まれた段へ置き、それから出す（容器が下からずれて上がる）。
  useLayoutEffect(() => {
    if (!present || phase !== 'entering' || !scrollerEl) return;
    // 段の印を測る（この読み取りで、隠れた位置の見た目が確定する。確定する前に出すと transition が始まらず、
    // いきなり出る）。
    scrollToDetent(latest.current.detent, 'instant');
    settledRef.current = latest.current.detent;
    setPhase('open');
  }, [present, phase, scrollToDetent, scrollerEl]);

  // 出ている間に別の要素へ描き直された（席が後から用意された）ら、止まっていた段へ置き直す。
  useLayoutEffect(() => {
    if (!scrollerEl || latest.current.phase !== 'open') return;
    scrollToDetent(settledRef.current ?? latest.current.detent, 'instant');
  }, [scrollerEl, scrollToDetent]);

  // 引っ込む: transition が終わったら消す。動きが無い（動きを減らす設定・配置の無い環境）ならすぐ消す。
  // 途中で出し直したら transition が差し替わり、待っていた完了は来ない（取り消される）。
  useEffect(() => {
    if (!present || phase !== 'closing') return;
    const scroller = scrollerRef.current;
    const finish = () => {
      if (latest.current.phase !== 'closing') return;
      settledRef.current = null;
      setPresent(false);
      latest.current.onClosed?.();
    };
    const running = scroller?.getAnimations?.() ?? [];
    if (running.length === 0) {
      finish();
      return;
    }
    let cancelled = false;
    Promise.all(running.map((animation) => animation.finished)).then(
      () => {
        if (!cancelled) finish();
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [present, phase]);

  // 呼び出し側が段を変えたら、その段へ動く（指で止めた段の通知の折り返しでは動かない）。
  useEffect(() => {
    if (!present || phase !== 'open') return;
    if (settledRef.current === detent) return;
    scrollToDetent(detent, 'smooth');
  }, [detent, present, phase, scrollToDetent]);

  // スクロールを見て、暗幕の濃さを書き、止まった段を知らせる。止まった＝2 フレーム続けて同じ位置で、
  // その位置がどれかの段の位置と一致する（時間のしきい値を持たない）。
  useEffect(() => {
    const scroller = scrollerEl;
    if (!present || !scroller) return;
    let frame = 0;
    let lastTop = Number.NaN;

    /** 見えている高さ。容器のずれ（出す／消す動き）は含めない。 */
    const visibleOf = () => {
      const sheet = sheetRef.current;
      if (!sheet) return 0;
      const sheetTop = sheet.offsetTop - scroller.scrollTop;
      return Math.max(0, Math.min(scroller.clientHeight, scroller.clientHeight - sheetTop));
    };

    const check = () => {
      frame = 0;
      const top = scroller.scrollTop;
      const visible = visibleOf();
      if (backdropRef.current && scroller.clientHeight > 0) {
        backdropRef.current.style.opacity = String(Math.min(1, visible / scroller.clientHeight));
      }
      if (top !== lastTop) {
        lastTop = top;
        frame = requestAnimationFrame(check);
        return;
      }
      const current = latest.current;
      if (current.phase === 'closing') return;
      let settled: SheetDetent | null = null;
      for (const candidate of current.detents) {
        // 1px 未満の差は同じ位置（スクロール位置は小数になる）。
        if (Math.abs(targetOf(candidate) - top) < 1) {
          settled = candidate;
          break;
        }
      }
      // 全画面の先（中身を読み進めた位置）も全画面の段に居る。
      if (!settled && current.detents.includes('full') && top > targetOf('full')) settled = 'full';
      if (!settled) return;
      // 知らせるのは指で**別の段へ**動かしたときだけ。前に止まっていた段にまだ居るだけ（頼まれた段へ送り始める
      // 前の一瞬）を「指で戻した」と取り違えると、頼まれた段を打ち消してしまう。
      const previous = settledRef.current;
      settledRef.current = settled;
      if (current.phase === 'open' && settled !== current.detent && settled !== previous) {
        current.onDetentChange(settled);
      }
      current.onSettle?.(visible);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    // 容器の大きさが変わった（キーボード・回転・描いた直後の配置）ら、止まっていた段へ置き直し、見えている高さを
    // 知らせ直す。段の位置は容器の高さで変わるので、置き直さないとブラウザの吸着が近い別の段へ寄せてしまう
    // （全画面の先を読み進めている間は動かさない）。
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            const settled = settledRef.current;
            const readingOn = settled === 'full' && scroller.scrollTop >= targetOf('full') - 1;
            if (latest.current.phase === 'open' && settled && !readingOn) {
              scrollToDetent(settled, 'instant');
            }
            onScroll();
          });
    observer?.observe(scroller);
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [present, targetOf, scrollerEl, scrollToDetent]);

  if (!present) return null;

  const has = (d: SheetDetent) => detents.includes(d);
  // 見た目の段階は `open` から即座に決める（消すと決めた描画のうちに引っ込み始め、押せなくなる。effect を待たない）。
  const visualPhase: Phase = !open ? 'closing' : phase === 'closing' ? 'open' : phase;
  const shown = visualPhase === 'open';

  return placeInSlot(
    <div
      {...contract}
      data-sheet-phase={visualPhase}
      // isolate: シートごとに重なりの文脈を閉じる。同じ席に 2 枚居るとき（発酵の結果と設定）、上に貼り付く
      // 見出しの z-index が隣のシートの上へ漏れず、後から出た 1 枚が丸ごと上に来る。
      className="pointer-events-none absolute inset-0 isolate overflow-hidden"
    >
      {modal ? (
        <div className="oz-sheet-backdrop absolute inset-0" data-shown={shown}>
          <button
            ref={backdropRef}
            type="button"
            aria-label={backdropLabel ?? ariaLabel}
            onClick={() => latest.current.onRequestClose?.()}
            // 出ている間だけ押せる。引っ込む動きの間は指を下の画面へ通す。
            className={`${shown ? 'pointer-events-auto' : 'pointer-events-none'} absolute inset-0`}
            style={{ background: 'color-mix(in srgb, var(--fg) 28%, transparent)', opacity: 0 }}
          />
        </div>
      ) : null}
      <div
        ref={attachScroller}
        data-shown={shown}
        className="oz-sheet-scroller absolute inset-0 overflow-y-auto"
        style={{
          scrollSnapType: 'y mandatory',
          overscrollBehavior: 'contain',
          containerType: 'size',
        }}
      >
        {/* 容器の高さの空き。吸着先ではない（ここに止まれない＝指では消えない）。 */}
        <div aria-hidden="true" style={{ height: '100%' }} />
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
          className={`${visualPhase === 'closing' ? 'pointer-events-none' : 'pointer-events-auto'} relative flex flex-col rounded-t-3xl border-t`}
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
                高さぶん上」に置き、上端揃えで吸着する＝見出しの行だけが見える。 */}
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
          {/* 中身の下の空き（全画面の段を持つシートで、中身が短いとき）。ここも指を容器へ通す。iOS は
              `pointer-events: none` の容器へ、ふつうの要素に触れた指のスクロールを渡さない。
              中身の高さの印を狂わせないよう、中身の箱とは別の兄弟で埋める。 */}
          <div aria-hidden="true" data-sheet-fill className="oz-sheet-pass min-h-0 flex-1" />
        </section>
      </div>
    </div>,
    slot,
  );
}
