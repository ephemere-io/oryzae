/**
 * 漬け込みの演出が使う座標。**推測ではなく実測**で取る。
 *
 * ここを取り違えると、字が紙に無かった場所から飛び立ち、瓶でないところへ吸い込まれる。
 * 「変なところにズームアップされて、瓶に入っていくように見えない」という壊れ方は
 * すべてこの2つの座標の取り違えから来る。
 */

/** 演出に載せる字の上限。多いほど重いが、少なすぎると紙が空っぽに見える。 */
export const MAX_TRANSITION_CHARS = 200;

export interface CharPlacement {
  char: string;
  /** 画面座標での中心。 */
  x: number;
  y: number;
}

/** 空白は飛ばさない（飛んでも何も見えないのに、数だけ食う）。 */
function isBlank(char: string): boolean {
  return char.trim().length === 0;
}

/**
 * 紙の上の字が**いま実際にどこにあるか**を測る。
 *
 * 以前は「1行あたり何字」を font-size と幅から見積もり、格子に並べていた。
 * 紙は中央寄せになり、題の帯が上に載り、行の高さも設定で変わるので、
 * その格子は実際の字の位置とまるで合わなくなっていた。
 *
 * Range は1文字ずつの矩形をブラウザに訊けるので、折り返しでも縦書きでも当たる。
 * 画面の外にある字は落とす——飛んでくる姿が見えないうえ、遠くから来ると
 * 演出全体が散漫になる。
 */
export function measureCharPlacements(editor: HTMLElement, limit: number): CharPlacement[] {
  const probe = document.createRange();
  // 組版を持たない環境（テストの DOM など）では Range が矩形を答えられない。
  // **そこで投げると、演出が二度と走らなくなる**（走行中の印が立ったまま戻らない）。
  // 測れないなら「飛ばす字は無い」として静かに降りる。
  if (typeof probe.getBoundingClientRect !== 'function') return [];

  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  const placements: CharPlacement[] = [];
  const viewWidth = window.innerWidth;
  const viewHeight = window.innerHeight;

  let node = walker.nextNode();
  while (node) {
    const text = node.textContent ?? '';
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (!char || isBlank(char)) continue;
      const range = document.createRange();
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      // 画面の外の字は落とす。
      if (x < 0 || y < 0 || x > viewWidth || y > viewHeight) continue;
      placements.push({ char, x, y });
    }
    node = walker.nextNode();
  }

  return sampleEvenly(placements, limit);
}

/** 多すぎるときは**均等に間引く**（先頭だけ残すと紙の上半分からしか飛ばない）。 */
function sampleEvenly<T>(items: T[], limit: number): T[] {
  if (items.length <= limit) return items;
  const step = items.length / limit;
  const out: T[] = [];
  for (let i = 0; i < limit; i++) {
    const item = items[Math.floor(i * step)];
    if (item) out.push(item);
  }
  return out;
}

export interface Destination {
  x: number;
  y: number;
  /** 字が集まる輪の半径。瓶の大きさに合わせる。 */
  radius: number;
  /**
   * 本物の瓶に当たったか。
   *
   * **当たっていないなら、まだ待つ余地がある。** 瓶の画面は遷移した直後で、問いの
   * 取得が終わるまで瓶は描かれない。そこで諦めて画面の中央へ吸い込むと、
   * 「変なところに集まる」になる。呼ぶ側はこの印を見て、瓶が現れるのを待てる。
   */
  foundJar: boolean;
}

const MIN_RADIUS = 24;
const MAX_RADIUS = 90;

/**
 * 字が吸い込まれる先。**遷移したあとの画面から探す。**
 *
 * 演出が始まる時点では瓶の画面はまだ無いので、始める前には決められない。
 *
 * 探す順番:
 *   1. **漬け込んだ問いの瓶。** 書いたものはその問いに納まるので、狙いはここで確定する
 *   2. 画面に見えている瓶のうち、いちばん近いもの（問いが分からないとき）
 *   3. 瓶の画面ぜんたい
 *   4. サイドバーを除いた紙の中央（瓶の画面に着いていないとき）
 *
 * 2 以降は当て推量なので、**1 で決まるのが本筋**。画面の中心を決め打ちにしていた頃は
 * 左のサイドバーぶんずれ、瓶が画面のどこにあっても同じ場所へ吸い込んでいた。
 *
 * @param questionId 漬け込んだ問い。分からなければ省く。
 */
export function findJarDestination(questionId?: string): Destination {
  const circles = Array.from(document.querySelectorAll('[data-verify-unit="QuestionCircle"]'));

  if (questionId) {
    const own = circles.find((el) => el.getAttribute('data-verify-question-id') === questionId);
    if (own && hasSize(own)) return fromRect(own);
  }

  const nearest = pickNearestToCenter(circles);
  if (nearest) return fromRect(nearest);

  const jar = document.querySelector('[data-verify-unit="JarView"]');
  // 瓶の画面はあるが瓶がまだ無い＝取得の途中。位置は画面の中心でよいが、
  // **まだ当たっていない**ので、呼ぶ側には待つ余地があると伝える。
  if (jar && hasSize(jar)) return { ...fromRect(jar), foundJar: false };

  return contentCenter();
}

function hasSize(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function pickNearestToCenter(elements: Element[]): Element | null {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  let best: Element | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const dx = rect.left + rect.width / 2 - cx;
    const dy = rect.top + rect.height / 2 - cy;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = el;
    }
  }
  return best;
}

function fromRect(el: Element): Destination {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return contentCenter();
  const radius = clamp(Math.min(rect.width, rect.height) * 0.28, MIN_RADIUS, MAX_RADIUS);
  // 瓶が画面の外へ流れていることがある（前回のパン・ズームが復元されるため）。
  // そのまま吸い込むと、字が画面の外で消えて**何も起きなかったように見える**。
  // 画面の中に留めれば、少なくとも瓶のある方角へ集まっていく姿は見える。
  return {
    x: clamp(rect.left + rect.width / 2, radius, window.innerWidth - radius),
    y: clamp(rect.top + rect.height / 2, radius, window.innerHeight - radius),
    radius,
    foundJar: true,
  };
}

/** 紙の中央。サイドバーの幅ぶん右に寄せる（画面の中央ではない）。 */
function contentCenter(): Destination {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width');
  const sidebar = Number.parseFloat(raw);
  const inset = Number.isFinite(sidebar) ? sidebar : 0;
  return {
    x: inset + (window.innerWidth - inset) / 2,
    y: window.innerHeight / 2,
    radius: MIN_RADIUS + 6,
    foundJar: false,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
