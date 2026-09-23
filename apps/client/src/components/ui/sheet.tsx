'use client';

import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { placeInSlot } from '@/lib/sp-chrome-context';
import { canDragSheet, contentScrolls, TAP_SLOP_PX } from './sheet-gesture';

/**
 * 払いと見なす指の速さ（px/ms）。これを超えたら 1 段動かす。超えなければいちばん近い段に置く。
 *
 * 離した瞬間に段を決めるのは、ブラウザの慣性を待つと「動いているスクローラ」が次の指を取ってしまうため
 * （WebKit）。決めるのは 1 回だけで、動きそのものは CSS の曲線に任せる。
 */
const FLICK_PX_PER_MS = 0.35;

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
  /**
   * いちばん高い段に居るか。スクロールの通知のたびに書き、指を置いた瞬間に読む。
   * 「中身を送れるか」も「この指でシートを動かしてよいか」も、これ 1 つで決まる（`sheet-gesture.ts`）。
   */
  const atHighestRef = useRef(false);
  /** 見出しの行に指を置いた場所。押した（動かなかった）かどうかの判定に使う。 */
  const tapStart = useRef<{ x: number; y: number } | null>(null);
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

  // 消すと決めたら、追いつきの `translate` を外す（インラインが残っていると CSS の引っ込みが効かない）。
  useEffect(() => {
    if (open) return;
    scrollerEl?.style.removeProperty('translate');
    scrollerEl?.style.removeProperty('transition');
  }, [open, scrollerEl]);

  // 呼び出し側が段を変えたら、その段へ動く（指で止めた段の通知の折り返しでは動かない）。
  useEffect(() => {
    if (!present || phase !== 'open') return;
    if (settledRef.current === detent) return;
    scrollToDetent(detent, 'smooth');
  }, [detent, present, phase, scrollToDetent]);

  /**
   * スクロールを見て決めることは 2 つだけ。
   *
   * - **中身を送れるか**（スクロールの通知ごとに比較 1 回）。着くのを待たず、吸着先が決まった時点で開ける
   * - **止まった段はどれか**（`scrollend`。無いブラウザでは「2 フレーム続けて同じ位置」で代用する）
   *
   * 動き（慣性・吸着・弾み）はブラウザのスクローラが持つ。ここでは一切作らない。
   */
  useEffect(() => {
    const scroller = scrollerEl;
    if (!present || !scroller) return;
    // 止まりを `scrollend` で受けられるか。受けられて暗幕も無ければ、スクロール中に毎フレーム走る JS は無い。
    const hasScrollEnd = 'onscrollend' in window;
    let frame = 0;
    let lastTop = Number.NaN;
    /** いまの指の持ち主と、その指が始まった段。離した瞬間の決着に使う。 */
    let gestureOwner: 'sheet' | 'content' | null = null;
    let startDetent: SheetDetent | null = null;
    let catchupTimer = 0;
    const samples: { y: number; t: number }[] = [];
    // 出し直すたびに「いちばん高い段に居る」を忘れる（中身の箱の既定は `overflow-y: hidden`）。
    atHighestRef.current = false;

    /** 見えている高さ。容器のずれ（出す／消す動き）は含めない。 */
    const visibleOf = () => {
      const sheet = sheetRef.current;
      if (!sheet) return 0;
      const sheetTop = sheet.offsetTop - scroller.scrollTop;
      return Math.max(0, Math.min(scroller.clientHeight, scroller.clientHeight - sheetTop));
    };

    /**
     * 中身を送れるようにするか。**着くのを待たず、「いちばん高い段に決まった」時点で開ける。**
     *
     * 吸着の動きは終わりが長い。実測（Chromium・払って全画面へ）では、残り 35px から 0px までに
     * 250ms かかる——見た目はとっくに全画面なのに、最後の 1px を待っていた。オーナーの
     * 「最大になってから 0.5 秒くらい経たないと内側を送れない」はこれ。
     *
     * そこで**いちばん近い吸着先がいちばん高い段か**で決める。これはブラウザが吸着先を選ぶのと同じ問いで、
     * 2 つの段の中点を越えた時点で「全画面に決まった」と言える。指はまだ外側に latch されているので、
     * 先に開けておいても内側が動き出すことはない。比較は 1 回のまま。
     */
    const syncContentScroll = () => {
      const inner = innerRef.current;
      const highest = latest.current.detents.at(-1);
      if (!inner || !highest) return;
      const below = latest.current.detents.at(-2);
      const top = targetOf(highest);
      // 中点。いちばん高い段しか無ければその位置そのもの。
      const commit = below === undefined ? top : (top + targetOf(below)) / 2;
      const atHighest = scroller.scrollTop >= commit;
      // **変わったときだけ書く。** 毎フレーム同じ値を書くと、そのたびに様式が無効になる（動きが粘る）。
      if (atHighest === atHighestRef.current) return;
      atHighestRef.current = atHighest;
      inner.style.overflowY = contentScrolls(atHighest) ? 'auto' : 'hidden';
    };

    /** 止まった位置がどれかの段と一致したら知らせる。 */
    const settle = () => {
      const top = scroller.scrollTop;
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
      // 知らせるのは指で**別の段へ**動かしたときだけ。前に止まっていた段にまだ居るだけ（頼まれた段へ送り始める
      // 前の一瞬）を「指で戻した」と取り違えると、頼まれた段を打ち消してしまう。
      const previous = settledRef.current;
      settledRef.current = settled;
      if (current.phase === 'open' && settled !== current.detent && settled !== previous) {
        current.onDetentChange(settled);
      }
      current.onSettle?.(visibleOf());
    };

    /**
     * `scrollend` が無いブラウザ用の見張り。止まった＝2 フレーム続けて同じ位置（時間のしきい値を持たない）。
     * 暗幕を持つシートは、濃さを位置に追わせるためどちらにせよ毎フレーム描く。
     */
    const watch = () => {
      frame = 0;
      const top = scroller.scrollTop;
      if (backdropRef.current && scroller.clientHeight > 0) {
        backdropRef.current.style.opacity = String(
          Math.min(1, visibleOf() / scroller.clientHeight),
        );
      }
      if (top !== lastTop) {
        lastTop = top;
        frame = requestAnimationFrame(watch);
        return;
      }
      if (!hasScrollEnd) settle();
    };

    const needsFrames = !hasScrollEnd || backdropRef.current !== null;
    const onScroll = () => {
      syncContentScroll();
      if (needsFrames && !frame) frame = requestAnimationFrame(watch);
    };

    /**
     * 指が触れたら、**動いている板をその場で決着させ、この指の持ち主を 1 つに決める。**
     *
     * 慣性と吸着の尾が残っている間、その容器は「いま動いているスクローラ」として次の指を取る
     * （WebKit / UIScrollView の作法。減速を止めた指がそのまま同じ容器の続きになる）。だから
     * 全画面に着いた直後にもう一度同じ向きへ払っても、**中身ではなく外側が受け取ってしまい**、
     * 動きが終わるまで内側が動き出せなかった（実機: 「最大幅になった後すぐにもう一度スクロールできない」。
     * Chromium では再現しない）。
     *
     * やることは 2 つ。どちらも触れた瞬間の 1 回だけ:
     *
     * 1. いちばん近い段の位置へそのまま置く（＝動きを終わらせる。位置は吸着先そのものなので跳ねない）
     * 2. **この指で板を動かしてよいかを、外側の `overflow-y` で言い切る**（`canDragSheet`）。
     *    読んでいる途中の指のあいだ外側は `hidden` ＝ そもそもスクローラではないので、取りようがない。
     *    判定でも待ち時間でもなく、ブラウザに「動かせるのはこっちだけ」と伝える
     */
    const takeGesture = (event: Event) => {
      const top = scroller.scrollTop;
      const wanted = latest.current.detent;
      let goal: number | null = null;
      if (settledRef.current !== wanted) {
        // 頼まれた段へ送っている最中（見出しを押した直後など）。**頼まれた先で**終わらせる
        // ——いちばん近い段へ落とすと、押したのに戻ってしまう。
        goal = targetOf(wanted);
      } else {
        for (const candidate of latest.current.detents) {
          const target = targetOf(candidate);
          if (goal === null || Math.abs(target - top) < Math.abs(goal - top)) goal = target;
        }
      }
      // 1px 未満のずれは触らない（スクロール位置は小数になる）。
      if (goal !== null && Math.abs(goal - top) >= 1) {
        scroller.scrollTop = goal;
        syncContentScroll();
      }
      // 追いつきの後始末は、この指が来た時点で打ち切る（時間切れの後始末が持ち主の指定を消さないように）。
      window.clearTimeout(catchupTimer);
      catchupTimer = 0;
      // 絵の遅れ（離した瞬間に付けた `translate`）が残っていたら、触れた時点で消す。位置はもう
      // 終わっているので、消せば見た目が本当の位置に揃う（＝触れたら決着する）。
      if (scroller.style.translate) {
        scroller.style.transition = 'none';
        scroller.style.removeProperty('translate');
        void scroller.offsetHeight;
        scroller.style.removeProperty('transition');
      }
      const inner = innerRef.current;
      const target = event.target;
      const onContent =
        inner !== null && target instanceof Node && inner.contains(target) && atHighestRef.current;
      // iOS は減速の末に 0.3px などの端数で止まる。1px 未満は上端と見なす。
      const scrollTop = !inner || inner.scrollTop < 1 ? 0 : inner.scrollTop;
      const mayDrag = canDragSheet({ atHighest: atHighestRef.current, onContent, scrollTop });
      scroller.style.overflowY = mayDrag ? 'auto' : 'hidden';
      gestureOwner = mayDrag ? 'sheet' : 'content';
      startDetent = settledRef.current;
      samples.length = 0;
      if (typeof TouchEvent !== 'undefined' && event instanceof TouchEvent) trackTouch(event);
    };

    /**
     * 指の位置を控える（速さは最後の 2 点から出す）。
     *
     * 時刻は `performance.now()` で取る。`event.timeStamp` は時間の原点が環境で違い、
     * 作り物のイベント（検証の払い）では進まないことがある——進まないと払いが払いに見えず、
     * いちばん近い段に落ちて段を飛ばす（検証で全画面 → 覗くへ 2 段落ちた）。
     */
    const trackTouch = (event: TouchEvent) => {
      const touch = event.touches[0] ?? event.changedTouches[0];
      if (!touch) return;
      samples.push({ y: touch.clientY, t: performance.now() });
      if (samples.length > 4) samples.shift();
    };
    /** 指の速さ（px/ms、下向きが正）。 */
    const flickSpeed = () => {
      const last = samples.at(-1);
      const previous = samples.at(-2);
      if (!last || !previous) return 0;
      const dt = last.t - previous.t;
      return dt <= 0 ? 0 : (last.y - previous.y) / dt;
    };

    /**
     * **指が離れた瞬間に段を決めて、位置はその場で置く。**
     *
     * ブラウザの慣性と吸着に任せると、着くまでの 300〜500ms は「いま動いているスクローラ」が残り、
     * WebKit ではその間に触れた指を外側が取ってしまう（実機: 全画面に着いた直後にもう一度払っても
     * 内側が送れない）。待ち時間で誤魔化すのではなく、**離した瞬間に位置を終わらせる**。
     * 慣性そのものが無くなるので、次の指は必ず自由。
     *
     * 見た目は殻ごとの `translate` を遅れの分だけ付けて、CSS の 300ms の曲線（`.oz-sheet-scroller`）で
     * 追いつかせる。**位置はもう終わっていて、動いて見えるのは絵だけ**なので、途中で触れても取り合いにならない。
     */
    const settleOnRelease = () => {
      if (gestureOwner !== 'sheet') return;
      const detents = latest.current.detents;
      const top = scroller.scrollTop;
      const speed = flickSpeed();
      const fromIndex = startDetent ? detents.indexOf(startDetent) : -1;
      let next: SheetDetent | null = null;
      if (Math.abs(speed) >= FLICK_PX_PER_MS && fromIndex >= 0) {
        // 払い。1 回で 1 段だけ動く（指が上なら高い段へ。`speed` は下向きが正）。
        const step = speed < 0 ? 1 : -1;
        next = detents[Math.min(detents.length - 1, Math.max(0, fromIndex + step))] ?? null;
      } else {
        let best = Number.POSITIVE_INFINITY;
        for (const candidate of detents) {
          const distance = Math.abs(targetOf(candidate) - top);
          if (distance < best) {
            best = distance;
            next = candidate;
          }
        }
      }
      if (!next) return;
      const goal = targetOf(next);
      const delay = goal - top;
      if (Math.abs(delay) < 1) return;
      scroller.scrollTop = goal;
      syncContentScroll();
      // 追いつくあいだは外側を止める。**iOS がこのあと慣性を始めないように**（始まると
      // また「動いているスクローラ」になり、次の指を取ってしまう）。絵は `translate` で動く。
      // 次に指が触れれば `takeGesture` が持ち主を決め直すので、ここで止めていても手は止まらない。
      scroller.style.overflowY = 'hidden';
      scroller.style.transition = 'none';
      scroller.style.translate = `0 ${delay}px`;
      void scroller.offsetHeight;
      scroller.style.removeProperty('transition');
      scroller.style.translate = '0 0';
      window.clearTimeout(catchupTimer);
      catchupTimer = window.setTimeout(endCatchup, 360);
    };
    /** 追いつきの後始末。`transitionend` が来なかったときのために時間でも戻す。 */
    const endCatchup = () => {
      window.clearTimeout(catchupTimer);
      catchupTimer = 0;
      scroller.style.removeProperty('translate');
      scroller.style.removeProperty('transition');
      scroller.style.removeProperty('overflow-y');
    };
    /**
     * 絵が追いついたら `translate` を外す。**残したままにしない**——消す動き（`[data-shown=false]` の
     * `translate: 0 100%`）は CSS なので、インラインが残っていると引っ込まなくなる。
     */
    const clearCatchup = (event: TransitionEvent) => {
      if (event.target !== scroller || event.propertyName !== 'translate') return;
      endCatchup();
    };
    /** 指が離れたら、段を決着させる（外側の持ち主は次に触れた指が決め直す）。 */
    const releaseGesture = () => {
      scroller.style.removeProperty('overflow-y');
      settleOnRelease();
      gestureOwner = null;
    };

    scroller.addEventListener('scroll', onScroll, { passive: true });
    if (hasScrollEnd) scroller.addEventListener('scrollend', settle);
    // 捕捉段階で受ける（中身の箱より先に決める）。iOS は touch、それ以外は pointer で届く。
    scroller.addEventListener('touchstart', takeGesture, { passive: true, capture: true });
    scroller.addEventListener('pointerdown', takeGesture, { capture: true });
    scroller.addEventListener('touchmove', trackTouch, { passive: true, capture: true });
    scroller.addEventListener('transitionend', clearCatchup);
    scroller.addEventListener('touchend', releaseGesture, { passive: true });
    scroller.addEventListener('touchcancel', releaseGesture, { passive: true });
    scroller.addEventListener('pointerup', releaseGesture);
    scroller.addEventListener('pointercancel', releaseGesture);
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
      if (hasScrollEnd) scroller.removeEventListener('scrollend', settle);
      scroller.removeEventListener('touchstart', takeGesture, { capture: true });
      scroller.removeEventListener('pointerdown', takeGesture, { capture: true });
      scroller.removeEventListener('touchmove', trackTouch, { capture: true });
      scroller.removeEventListener('transitionend', clearCatchup);
      window.clearTimeout(catchupTimer);
      scroller.removeEventListener('touchend', releaseGesture);
      scroller.removeEventListener('touchcancel', releaseGesture);
      scroller.removeEventListener('pointerup', releaseGesture);
      scroller.removeEventListener('pointercancel', releaseGesture);
      scroller.style.removeProperty('overflow-y');
      scroller.style.removeProperty('translate');
      scroller.style.removeProperty('transition');
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
            <div
              data-sheet-header
              className="oz-sheet-pass sticky top-0 z-[1] rounded-t-3xl"
              style={{ gridArea: '1 / 1', background: 'var(--surface-raised)' }}
              onPointerDown={(event) => {
                tapStart.current = { x: event.clientX, y: event.clientY };
              }}
              // **指が動かなかったときだけ「押した」。** 動いた指は払いで、段はスクロールが決める。
              // `click` は指が動いても出るので、少し引いただけで段が飛んでいた（実機レビュー）。
              onPointerUp={(event) => {
                const start = tapStart.current;
                tapStart.current = null;
                if (!start || !onHeaderTap) return;
                if (event.target instanceof Element && event.target.closest('button, a, input'))
                  return;
                if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_SLOP_PX)
                  return;
                onHeaderTap();
              }}
            >
              {header}
            </div>
          </div>
          {/* 中身の箱。シートの残りを全部取る。**いちばん高い段に決まるまでは `overflow-y: hidden`**
              （指はシートの高さに使う。上の `syncContentScroll`）。読んでいる途中の指をシートへ渡さないのは
              `overscroll-behavior` ではなく、**触れた瞬間に外側の `overflow-y` を切る**ことで作る
              （上の `takeGesture`）。外側がそもそもスクローラでなければ、渡しようが無い。
              `oz-sheet-pass` は iOS で指を容器へ通すため。 */}
          <div
            ref={attachInner}
            data-sheet-content
            className="oz-sheet-pass min-h-0 min-w-0 flex-1"
            // overflow-wrap: anywhere — **中の何物も箱より広くならない**。この箱は iOS 用に横へ 1px だけ
            // はみ出させてある（`oz-sheet-pass`）ので、折り返せない長い語（手紙の中の URL）があると、
            // その幅ぶん横に動けてしまいレイアウトが崩れた（実機レビュー）。箱の側で折り返しを保証する。
            style={{ overflowY: 'hidden', overflowWrap: 'anywhere' }}
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
