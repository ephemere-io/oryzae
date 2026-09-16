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
  /**
   * いちばん低い段からさらに下へ引いたら閉じるか。**モーダルのシートだけ true**（iOS のシートと同じ）。
   * パレットや歯車で出し入れする板（発酵の結果・設定）は false で、指では消えない。
   *
   * 吸着先の組は描いている間に変えない（WebKit が別の段へ吸着し直す）ので、閉の吸着先はこの値で固定する。
   */
  dismissible?: boolean;
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
 * - **指（スクロール）は高さを変える。** パレットや歯車で出し入れする板（`dismissible: false`）は一番低い段より
 *   下に止まれない（下まで引いても離せば戻る）。モーダルのシート（`dismissible: true`）だけ、いちばん低い段から
 *   さらに引くと閉じる（iOS のシートと同じ）
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
  dismissible = false,
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
  /** 出したいか（`open`）。state の phase より 1 拍早い。容器の大きさが変わったときの判断に使う。 */
  const openRef = useRef(open);
  openRef.current = open;
  /**
   * いまの位置が**指で動かした結果か**。閉じるのは指で払いきったときだけで、部品が段へ送った結果では閉じない。
   * 送り（`scrollToDetent`）のたびに false に戻し、容器に指が触れたら true にする。
   */
  const byFingerRef = useRef(false);
  /** いま指が触れているか。触れている間は、部品の側から段へ置き直さない（指と綱引きしない）。 */
  const touchingRef = useRef(false);
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
    // 面の上端＝いちばん高い段。ここは印を測らずに決まる（閉の位置の空きは容器と同じ高さ）ので、
    // **いつでも正しい**。他の段が測れなかったときの逃げ場にする。
    const full = inContent(sheetRef.current);
    const marked = () => {
      switch (position) {
        case 'half':
          return inContent(halfRef.current);
        case 'peek':
          return inContent(peekRef.current);
        case 'content':
          return inContent(contentRef.current);
        case 'full':
          return full;
      }
    };
    const at = marked();
    if (position === 'full') return at;
    // **測れなかった印は閉の位置（0）と見分けがつかない。** 中身の段は測った高さ（見出し + 中身）に
    // 依るので、測る前や測れなかったときに 0 が返り、開いたのに画面の外に置かれる（実機レビュー:
    // 一覧のアイテムを押しても何も出てこない）。どの段も「見出しの行が見える」より低くはならないので、
    // 覗く段の印を下限にする（これは測った高さに依らない）。
    const floor = inContent(peekRef.current);
    // 中身の段が見出しの行より低い＝測れていない。何も出ないくらいなら、いちばん高い段に出す。
    if (position === 'content' && at <= floor) return full;
    // どの段も閉の位置には置かない（印がひとつも測れない環境では `full` も 0 なのでそのまま）。
    if (at < 1 && floor < 1) return full;
    return Math.max(at, floor);
  }, []);

  const scrollToDetent = useCallback(
    (position: SheetDetent, behavior: 'smooth' | 'instant') => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      // ここから先の位置は部品が決めたもの（指ではない）。
      byFingerRef.current = false;
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

  /**
   * 頼まれている段に**確実に置く**。出る動き（`translate` の transition）が走っている間、iOS は容器の
   * `scrollTop` の指定を受け付けないことがある。払いきりで閉じられるシートは閉の位置（0）も吸着先なので、
   * 受け付けられなかったときにブラウザが段へ引き上げてくれず、**開いたのに画面の外に居る**（実機レビュー:
   * 一覧のアイテムを押しても何も出てこない）。出る動きのあいだ、指が触れていなければ置き直し続ける。
   */
  const ensureAtDetent = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let tries = 0;
    const tick = () => {
      const current = scrollerRef.current;
      if (!current || latest.current.phase === 'closing' || touchingRef.current) return;
      const target = targetOf(latest.current.detent);
      if (Math.abs(current.scrollTop - target) > 1) current.scrollTop = target;
      tries += 1;
      if (tries < 24) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [targetOf]);

  // 描いた直後: 容器の下に隠したまま頼まれた段へ置き、それから出す（容器が下からずれて上がる）。
  useLayoutEffect(() => {
    if (!present || phase !== 'entering' || !scrollerEl) return;
    // 段の印を測る（この読み取りで、隠れた位置の見た目が確定する。確定する前に出すと transition が始まらず、
    // いきなり出る）。
    scrollToDetent(latest.current.detent, 'instant');
    settledRef.current = latest.current.detent;
    setPhase('open');
    ensureAtDetent();
  }, [present, phase, scrollToDetent, scrollerEl, ensureAtDetent]);

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

  // 出る動きが終わったら、もう一度だけ段を確かめる（動きの最中に受け付けられなかった指定の取りこぼし）。
  useEffect(() => {
    const scroller = scrollerEl;
    if (!scroller || phase !== 'open') return;
    const onEnd = (event: TransitionEvent) => {
      if (event.target === scroller && event.propertyName === 'translate') ensureAtDetent();
    };
    scroller.addEventListener('transitionend', onEnd);
    return () => scroller.removeEventListener('transitionend', onEnd);
  }, [scrollerEl, phase, ensureAtDetent]);

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
      // 閉の位置（容器の下）に着いた。**指で払いきったときだけ閉じる。**
      // 部品が送った結果として 0 に居るなら、それは段へ置けていないということなので、頼まれている段へ戻す
      // （実機レビュー: 一覧からシートを開いても何も出てこない、を二度と起こさない保険）。
      // 配置の無い環境（テスト）では位置がいつも 0 なので、採寸できるときだけ数える。
      if (current.phase === 'open' && scroller.clientHeight > 0 && top < 1) {
        if (current.dismissible && byFingerRef.current) {
          current.onRequestClose?.();
          return;
        }
        scrollToDetent(current.detent, 'instant');
        return;
      }
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
    /**
     * 指が容器に触れたら、そこから先の位置は指が決めたもの（払いきりで閉じてよい）。
     *
     * **`touchstart` だけを見る（`pointerdown` は見ない）。** iOS は指を離したあと、そのとき指の下に
     * ある要素へ**合成の pointer/mouse イベント**を送る。一覧のアイテムを押して出したシートは、まさに
     * その指の下に出てくるので、`pointerdown` まで数えると「出た瞬間に指で触られた」ことになり、段へ
     * 置き直す処理（`ensureAtDetent`）が丸ごと止まって容器の下に居たままになる。touch は合成されない。
     */
    const onTouchStart = () => {
      touchingRef.current = true;
      byFingerRef.current = true;
    };
    const onTouchEnd = () => {
      touchingRef.current = false;
    };
    scroller.addEventListener('touchstart', onTouchStart, { passive: true });
    scroller.addEventListener('touchend', onTouchEnd, { passive: true });
    scroller.addEventListener('touchcancel', onTouchEnd, { passive: true });
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
      scroller.removeEventListener('touchstart', onTouchStart);
      scroller.removeEventListener('touchend', onTouchEnd);
      scroller.removeEventListener('touchcancel', onTouchEnd);
      scroller.removeEventListener('scroll', onScroll);
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [present, targetOf, scrollerEl, scrollToDetent]);

  /**
   * 中身の段の吸着先は「見出し + 中身の高さ」。シートは容器と同じ高さなので、CSS だけでは中身の高さが分からない。
   * 測って CSS 変数（`--oz-sheet-content`）に渡し、**吸着そのものはブラウザに任せる**（JS で段へ送らない）。
   */
  useEffect(() => {
    const inner = innerEl;
    const section = sheetRef.current;
    const content = inner?.firstElementChild;
    if (!inner || !section || !content || typeof ResizeObserver === 'undefined') return;
    const header = section.querySelector('[data-sheet-header]');
    const measure = () => {
      const height = Math.round(
        (header?.getBoundingClientRect().height ?? 0) + content.scrollHeight,
      );
      // **測れないとき（0）は書かない。** 0 を書くと中身の段の吸着先が閉の位置と重なり、開いたのに
      // 画面の外に居ることになる。変数が無ければ既定の `100%`（＝面の上端＝いちばん高い段）が使われる。
      if (height <= 0) {
        section.style.removeProperty('--oz-sheet-content');
        return;
      }
      if (section.style.getPropertyValue('--oz-sheet-content') === `${height}px`) return;
      section.style.setProperty('--oz-sheet-content', `${height}px`);
      // 段の位置が変わった。**置き直さないと、測る前の位置に取り残される。** 指で触っている間は触らない。
      if (latest.current.phase === 'open' && !byFingerRef.current) {
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
          scrollSnapType: 'y mandatory',
          overscrollBehavior: 'contain',
          containerType: 'size',
        }}
      >
        {/* 容器の高さの空き。閉の位置。払って閉じられるシートだけ、ここが吸着先になる。 */}
        <div
          aria-hidden="true"
          style={{ height: '100%', scrollSnapAlign: dismissible ? 'start' : 'none' }}
        />
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
            className="oz-sheet-pass min-h-0 flex-1"
            style={{ overflowY: 'hidden', overscrollBehaviorY: 'auto' }}
          >
            <div>{children}</div>
          </div>
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
