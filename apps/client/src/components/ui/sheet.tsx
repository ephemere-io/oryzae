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
  /**
   * 閉じたいとき（暗幕を押した・いちばん低い段からさらに下へ引いた）。呼び出し側は `open` を false にする。
   */
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
 * いちばん低い段より上に積む空きの高さ（容器の高さ − 段の高さ）。段の高さは要素で決まる:
 * 覗く＝見出しの行、中身＝見出し + 中身（容器より高ければ容器）、半分＝容器の半分、全画面＝容器。
 * 測る高さは容器の CSS 変数（`--oz-sheet-header` / `--oz-sheet-content`）から継ぐ。
 * `detents` は低い順に並べる約束（DockSheet も `detents[0]` を最低の段として扱う）。
 */
function spaceAbove(lowest: SheetDetent | undefined): string {
  switch (lowest) {
    case 'peek':
      return 'calc(100cqh - var(--oz-sheet-header, 0px))';
    case 'content':
      return 'calc(100cqh - min(var(--oz-sheet-content, 100cqh), 100cqh))';
    case 'half':
      return '50cqh';
    default:
      return '0px';
  }
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
 * - **指（スクロール）は高さを変えるだけ。指では閉じない。** 段だけが吸着先で、閉の位置は吸着先ではない。
 *   一番低い段より下に止まれない（下まで引いても離せば戻る）。板もモーダルも同じ 1 つの動き方。
 *   「いちばん低い段から引いて閉じる」は作らない: 閉の位置を一瞬でも吸着先にすると iOS はそこへ飛び
 *   （出た瞬間・触れた瞬間の両方で実機に起きた）、離した位置で判定する形はブラウザや OS ごとの
 *   イベントの順序・位置の読みに依存する。閉じる手はボタン・暗幕・キャンセルで足りる（オーナーの判断）
 * - **出す／消すは `open`**（パレットや歯車のボタン、暗幕、キャンセル）。動きはシートの容器を下へずらす CSS の
 *   transition（`.oz-sheet-scroller[data-shown]`）。消える動きの終わりは transition の完了で知る
 *
 * ### 高さはネイティブのスクロールと CSS scroll-snap で動かす
 *
 * 画面いっぱいのスクロール容器（`scroll-snap-type: y mandatory`）の中に、空き（spacer）とシートを縦に積む。
 * 空きの高さは**「容器 − いちばん低い段」**なので、スクロール位置 0 ＝ いちばん低い段。それより下は無い
 * （閉の位置はスクロール空間に存在しない）。指の追従・慣性・減速・段への吸着は**ブラウザのスクロールそのもの**で、
 * JS は指の動きを受けない。
 *
 * 段は**要素の位置**が決める（数値を持たない）:
 * - 半分: シートの中の印（`top: -50cqh`、上端揃え）＝シートの上端が容器の半分に来る
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
  /**
   * 段の位置が決まった（中身の高さを測って空きの高さが確定した）か。**決まるまで吸着を入れない。**
   * 測る前は空きが 0 で、中身の段の印と全画面の面が同じ位置 0 に重なる。そこで吸着が効いていると、ブラウザは
   * 全画面の面を吸着相手として覚え、空きが伸びたときにその相手を追いかけて全画面まで動く（仕様どおりの
   * 再吸着）。実測: 位置の指定が効かない環境では出た瞬間に全画面になった。
   */
  const [measured, setMeasured] = useState(false);
  const presentRef = useRef(present);
  presentRef.current = present;
  /** 出したいか（`open`）。state の phase より 1 拍早い。容器の大きさが変わったときの判断に使う。 */
  const openRef = useRef(open);
  openRef.current = open;
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
  /**
   * 中身の箱（シートの中でスクロールするところ）。**高さを変える指と、中身を読む指を分ける**ために、容器とは別の
   * スクロール容器にしてある。1 つの容器で両方を担っていた頃は、中身を読み終えて下へ戻すとそのままシートが縮んだ
   * （実機レビュー: 内部のスクロールが尽きた瞬間に連動して小さくなる）。
   */
  const [innerEl, setInnerEl] = useState<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const attachInner = useCallback((element: HTMLDivElement | null) => {
    innerRef.current = element;
    setInnerEl(element);
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
  latest.current = {
    detent,
    detents,
    onDetentChange,
    onRequestClose,
    onClosed,
    onSettle,
    phase,
  };

  // 出す／消す。消すときは消さずに引っ込む動きへ。引っ込む途中で出せば、その場から戻る（transition が折り返す）。
  useEffect(() => {
    if (open) {
      if (presentRef.current) {
        // 引っ込む途中なら戻す。描いた直後（段へ置く前）はそのまま（置いてから出す）。
        setPhase((current) => (current === 'closing' ? 'open' : current));
      } else {
        setPresent(true);
        setPhase('entering');
        setMeasured(false);
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
    // 位置は測ったまま返す。**0 は正当な位置**（いちばん低い段。空きが「容器 − いちばん低い段」なので）。
    // 以前ここにあった「0 なら測れていないとみなして全画面へ逃がす」保険は、0 ＝ 閉の位置だった頃のもの。
    // 残したままだと、覗く段（位置 0）の板を全画面へ送ってしまう（実測: 発酵の結果が開いた瞬間に全画面）。
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
      if (behavior === 'instant' || reduced) {
        // 直接代入がいちばん確実（`scrollTo` は吸着やアニメーションの都合で効かないことがある）。
        scroller.scrollTop = top;
        return;
      }
      scroller.scrollTo({ top, behavior: 'smooth' });
    },
    [targetOf],
  );

  // 描いた直後: 容器の下に隠したまま頼まれた段へ置き、それから出す（容器が下からずれて上がる）。
  useLayoutEffect(() => {
    if (!present || phase !== 'entering' || !scrollerEl) return;
    // 段の印を測る（この読み取りで、隠れた位置の見た目が確定する。確定する前に出すと transition が始まらず、
    // いきなり出る）。
    // 閉の位置は吸着先ではないので、この指定が効かない環境でも、ブラウザの吸着でいちばん近い段に着く
    // （＝いちばん低い段。呼び出し側は最初の段をいちばん低い段にしておく）。
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
      if (!settled) return;
      // **いちばん高い段に着いたときだけ中身が動く。** 低い段では指はシートの高さに使う（同じ指で中身まで
      // 流れると、読み終えて戻したときにシートが縮んでしまう）。
      const inner = innerRef.current;
      if (inner) {
        const atTop = top >= scroller.scrollHeight - scroller.clientHeight - 1;
        inner.style.overflowY = atTop ? 'auto' : 'hidden';
      }
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
    // 容器の大きさが変わった（キーボードの出入り・回転・描いた直後の配置）ら、**呼び出し側が頼んでいる段**へ
    // 置き直す。段の位置は容器の高さで決まるので、スクロール位置をそのまま残すと、同じ位置が別の段の位置に
    // なってしまう（キーボードが閉じた瞬間に、全画面が中くらいに・少し小さい段が全画面に化けた。実機レビュー）。
    // 消している最中（`open` が false）は触らない。全画面の先を読み進めている間も動かさない。
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            const wanted = latest.current.detent;
            const readingOn =
              settledRef.current === 'full' && scroller.scrollTop >= targetOf('full') - 1;
            if (openRef.current && latest.current.phase !== 'closing' && !readingOn) {
              settledRef.current = wanted;
              scrollToDetent(wanted, 'instant');
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

  /**
   * 中身の段の吸着先は「見出し + 中身の高さ」。シートは容器と同じ高さなので、CSS だけでは中身の高さが分からない。
   * 測って CSS 変数（`--oz-sheet-content`）に渡し、**吸着そのものはブラウザに任せる**（JS で段へ送らない）。
   * 描画の前に測る（layout effect）: 空きの高さがこの値で決まるので、測る前に描くと一瞬だけ全画面で出る。
   */
  useLayoutEffect(() => {
    const inner = innerEl;
    const section = sheetRef.current;
    const content = inner?.firstElementChild;
    if (!inner || !section || !content || typeof ResizeObserver === 'undefined') return;
    const header = section.querySelector('[data-sheet-header]');
    // 変数は容器に書く: 段の印（シートの中）も、いちばん低い段より下の空き（シートの外）も、ここから継ぐ。
    const holder = scrollerRef.current ?? section;
    const measure = () => {
      const headerHeight = Math.round(header?.getBoundingClientRect().height ?? 0);
      const height = Math.round(headerHeight + content.scrollHeight);
      // **測れないとき（0）は書かない。** 変数が無ければ既定（面の上端＝いちばん高い段）が使われる。
      if (height <= 0) {
        holder.style.removeProperty('--oz-sheet-content');
        holder.style.removeProperty('--oz-sheet-header');
        return;
      }
      holder.style.setProperty('--oz-sheet-header', `${headerHeight}px`);
      setMeasured(true);
      if (holder.style.getPropertyValue('--oz-sheet-content') === `${height}px`) return;
      holder.style.setProperty('--oz-sheet-content', `${height}px`);
      // 段の位置が変わった。**置き直さないと、測る前の位置に取り残される。** 指で触っている間は触らない。
      if (latest.current.phase === 'open') {
        scrollToDetent(settledRef.current ?? latest.current.detent, 'instant');
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    if (header) observer.observe(header);
    return () => observer.disconnect();
  }, [innerEl, scrollToDetent]);

  // 中身の箱: 先頭に戻りきって指が離れるまで、シートへスクロールを渡さない（渡すと同じ指で縮む）。
  useEffect(() => {
    const inner = innerEl;
    if (!inner) return;
    let touching = false;
    let frame = 0;
    let lastTop = Number.NaN;
    /** 指が離れていて、先頭に戻りきっているときだけ、次の指をシートへ渡す。 */
    const settle = () => {
      frame = 0;
      if (inner.scrollTop !== lastTop) {
        lastTop = inner.scrollTop;
        frame = requestAnimationFrame(settle);
        return;
      }
      inner.style.overscrollBehaviorY = !touching && inner.scrollTop <= 0 ? 'auto' : 'contain';
    };
    const onScroll = () => {
      // 動き出した時点でシートへは渡さない（この指のうちに先頭へ戻っても縮ませない）。
      inner.style.overscrollBehaviorY = 'contain';
      if (!frame) frame = requestAnimationFrame(settle);
    };
    const onDown = () => {
      touching = true;
    };
    const onUp = () => {
      touching = false;
      lastTop = Number.NaN;
      if (!frame) frame = requestAnimationFrame(settle);
    };
    inner.addEventListener('scroll', onScroll, { passive: true });
    inner.addEventListener('pointerdown', onDown);
    inner.addEventListener('pointerup', onUp);
    inner.addEventListener('pointercancel', onUp);
    return () => {
      inner.removeEventListener('scroll', onScroll);
      inner.removeEventListener('pointerdown', onDown);
      inner.removeEventListener('pointerup', onUp);
      inner.removeEventListener('pointercancel', onUp);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [innerEl]);

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
          // 閉じる動きの間は吸着を切る（閉じると決めたあとに段へ引き戻されない）。
          scrollSnapType: visualPhase === 'closing' || !measured ? 'none' : 'y mandatory',
          overscrollBehavior: 'contain',
          containerType: 'size',
          // 位置は段が決める。空きの高さが測定で変わったとき、ブラウザがシートを「見えていた場所」に留めようと
          // 位置を動かす（スクロールアンカリング）と、出た瞬間に全画面へ跳ぶ。切る。
          overflowAnchor: 'none',
        }}
      >
        {/* シートの上に積む空き。高さは**「容器 − いちばん低い段」**。だからスクロール位置 0 ＝ いちばん低い段で、
            それより下には物理的に引けない（OS の端の小さな跳ねだけが残る＝正直な「ここまで」の合図）。
            以前は容器いっぱいの空きで、いちばん低い段の下に「閉の位置」がスクロール範囲として残っていた。
            指がそこまで 1:1 で引き下ろせるのに離せば戻る＝偽の手がかり（実機レビュー）。閉の位置を吸着先に
            すれば iOS はそこへ飛ぶ。**閉の位置をスクロール空間から無くす**のがいちばん単純で、根本原因ごと消える。
            出す／消す動きはスクロールではなく容器ごとの平行移動なので、空きの高さに依らない。 */}
        <div
          aria-hidden="true"
          style={{ height: spaceAbove(detents[0]), scrollSnapAlign: 'none' }}
        />
        <section
          ref={sheetRef}
          role="dialog"
          aria-modal={modal ? true : undefined}
          aria-label={ariaLabel}
          className={`${visualPhase === 'closing' ? 'pointer-events-none' : 'pointer-events-auto'} relative flex flex-col rounded-t-3xl border-t`}
          style={{
            // シートは容器と同じ高さ（全画面で面が下まで届く。低い段では下半分が画面の外に出るだけ）。
            // **高さを固定するから、中身がはみ出しても伸びない**＝容器のスクロールは段の切り替えだけを担う。
            height: '100%',
            background: 'var(--surface-raised)',
            borderColor: 'var(--surface-raised-border)',
            boxShadow: '0 -8px 32px rgba(140,133,126,0.18)',
            scrollSnapAlign: has('full') ? 'start' : 'none',
          }}
        >
          {/* 見出しの升（覗く段の印を同じ升に重ねる）。 */}
          <div className="relative grid shrink-0">
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
          </div>
          {/* 中身の箱。シートの残りを全部取る。いちばん高い段に着くまでは `overflow-y: hidden`（指はシートの
              高さに使う）。着いたら `auto` になり、先頭に戻って指を離すまでシートへスクロールを渡さない
              （上の effect）。`oz-sheet-pass` は iOS で指を容器へ通すため。 */}
          <div
            ref={attachInner}
            data-sheet-content
            className="oz-sheet-pass min-h-0 min-w-0 flex-1"
            // overflow-wrap: anywhere — **中の何物も箱より広くならない**。この箱は iOS 用に横へ 1px だけ
            // はみ出させてある（`oz-sheet-pass`）ので、折り返せない長い語（手紙の中の URL）があると、
            // その幅ぶん横に動けてしまいレイアウトが崩れた（実機レビュー）。箱の側で折り返しを保証する。
            style={{ overflowY: 'hidden', overscrollBehaviorY: 'auto', overflowWrap: 'anywhere' }}
          >
            <div>{children}</div>
          </div>
          {/* 半分の段の印。シートの上端から容器の半分ぶん上に置き、上端揃えで吸着する＝シートの上端が容器の
              半分に来る。**シートの中に置く**（空きの高さに依らない）。容器の子の `top: 50%` に置いていた頃は、
              空きが「容器 − いちばん低い段」になった途端、いちばん低い段が半分のシート（設定）で印が全画面の面と
              同じ位置に重なり、位置 0（＝半分）に吸着先が無くなって全画面から戻れなくなった（実機レビュー）。 */}
          <div
            ref={halfRef}
            aria-hidden="true"
            className="absolute left-0 h-px w-px"
            style={{ top: '-50cqh', scrollSnapAlign: has('half') ? 'start' : 'none' }}
          />
          {/* 中身の段の印。「見出し + 中身の高さ（容器より高ければ容器の高さ）から容器の高さぶん上」に置き、
              上端揃えで吸着する＝中身の下端が容器の下端に来る。高さは測って CSS 変数で渡す。 */}
          <div
            ref={contentRef}
            aria-hidden="true"
            className="absolute left-0 h-0 w-px"
            style={{
              top: 'calc(min(var(--oz-sheet-content, 100%), 100cqh) - 100cqh)',
              scrollSnapAlign: has('content') ? 'start' : 'none',
            }}
          />
        </section>
      </div>
    </div>,
    slot,
  );
}
