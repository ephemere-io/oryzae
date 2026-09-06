/**
 * 円の外周を回る問いテキストの収まり計算（純関数）。
 *
 * SVG の `<textPath>` は経路に収まらない分を **黙って捨てる**。PC は「収まるまで字を
 * 小さくする」で逃げているが、SP では小さくすると読めなくなる（読ませることが目的の
 * テキストなので、本末転倒になる）。
 *
 * 問いは最長 64 字（`MAX_QUESTION_STRING_LENGTH`）ある。円ひとつの外周には
 * 読める大きさで 24 字ほどしか置けないので、**足りなければ輪を増やす**。
 * 増やす向きは外側。円の内側は中身の予告（言葉・抜粋）の席で、そこへ字を伸ばすと
 * 予告を押しのけることになる。
 *
 * 決め方は「まず輪の数、次に字の大きさ」の順:
 *   1 重で入るならいちばん大きい字から順に試す → 入らなければ 2 重、それでも駄目なら 3 重。
 * 逆順（字を優先）にすると、少し長いだけの問いでも輪が二重になって円が賑やかになる。
 */

/** 字送り（em）。収まり計算と描画で同じ値を使う。 */
export const RING_TRACKING = 0.08;

/** SP で読める下限・上限（px）。円が小さくてもこれ以下にはしない。 */
const MIN_FONT = 12;
const MAX_FONT = 17;

/** 円の直径に対する字の大きさ。直径 150 で 15px あたり。 */
const FONT_RATIO = 0.1;

/** いちばん内側の輪を、円の縁からどれだけ内に置くか（px）。 */
const RING_INSET = 10;

/** 2 重目以降を、円の縁からどれだけ外に置くか（px）。 */
const RING_OUTSET = 8;

/** 輪と輪の間隔（字の大きさに対する比）。 */
const LINE_GAP_RATIO = 1.15;

/**
 * 何重まで巻くか。
 *
 * 3 重で直径のおよそ 1.5 倍まで広がる。これ以上増やすと、円の飾りではなく
 * 文字の雲になってしまう（隣を回る円とも重なる）。
 */
const MAX_LINES = 3;

/** 一周ぐるり書かず、始点と終点の間に空ける割合（ぶつかると輪に見えない）。 */
const USABLE = 0.92;

/** 行頭に来てはいけない字。前の行に引き取る。 */
const NO_LINE_START = '、。，．,.；;：:？?！!」』）)】〉》”’ー…';

interface RingLine {
  /** その輪に描く文字列。 */
  label: string;
  /** 円の中心からの半径（px）。 */
  radius: number;
}

export interface RingText {
  /**
   * 外側の輪から内側へ。読む順もこの順。
   *
   * 12 時の位置では外の輪が上に来るので、横書きの行と同じく上から下へ読める。
   */
  lines: RingLine[];
  /** 描く字の大きさ（px）。 */
  fontSize: number;
  /** 畳んだかどうか（最長 64 字なら本来起きない。壊れた入力への保険）。 */
  truncated: boolean;
  /** いちばん外の輪まで描き切るのに要る正方形の一辺（px）。 */
  box: number;
}

/** 円周の経路（9 時から時計回り）。`textPath` はこの上に字を並べる。 */
export function ringPath(center: number, radius: number): string {
  return `M ${center},${center} m ${-radius},0 a ${radius},${radius} 0 1,1 ${radius * 2},0 a ${radius},${radius} 0 1,1 ${-radius * 2},0`;
}

/** 外側から内側へ並べた半径。いちばん内側は常に円の縁の内側。 */
function ringRadii(diameter: number, lines: number, fontSize: number): number[] {
  const outer = Math.max(0, diameter) / 2;
  const inner = Math.max(1, outer - RING_INSET);
  if (lines <= 1) return [inner];

  const gap = fontSize * LINE_GAP_RATIO;
  // 縁の外側に置きつつ、内側の輪との間隔も行送りぶんは空ける。縁からの距離だけで
  // 決めると、字が大きいときに 2 本の輪がくっついて 1 本の帯に見える。
  const first = Math.max(outer + RING_OUTSET, inner + gap);
  const outward: number[] = [];
  for (let i = 0; i < lines - 1; i += 1) outward.push(first + i * gap);
  // 外側ほど先に読むので、遠い輪から並べる。
  return [...outward.reverse(), inner];
}

/** 半径 `radius` の輪に置ける字数。 */
function capacityOf(radius: number, perChar: number): number {
  if (perChar <= 0) return 0;
  return Math.floor((2 * Math.PI * radius * USABLE) / perChar);
}

/**
 * `rest` の先頭から 1 行ぶん取る。
 *
 * 欧文は語の途中で切らない。和文は空白が無いのでどこでも切れるが、行頭に句読点や
 * 閉じ括弧が来ると読みが引っかかるので、その 1 字は前の行に引き取る（一周の
 * 隙間 8% が 1 字ぶんを吸う）。
 */
function takeLine(rest: string, capacity: number): string {
  if (capacity <= 0) return '';
  if (rest.length <= capacity) return rest;

  const space = rest.lastIndexOf(' ', capacity);
  // 行の 4 割より手前でしか切れないなら、語を割ってでも詰める（1 行が短くなりすぎる）。
  if (space > capacity * 0.4) return rest.slice(0, space);

  const next = rest.charAt(capacity);
  return rest.slice(0, NO_LINE_START.includes(next) ? capacity + 1 : capacity);
}

/** 与えられた輪へ順に流し込む。入り切らない分は末尾を「…」に畳む。 */
function flow(label: string, radii: number[], caps: number[]): { lines: RingLine[]; rest: string } {
  const lines: RingLine[] = [];
  let rest = label;

  radii.forEach((radius, i) => {
    if (rest.length === 0) return;
    const taken = takeLine(rest, caps[i] ?? 0);
    if (taken.length === 0) return;
    lines.push({ label: taken, radius });
    rest = rest.slice(taken.length).trimStart();
  });

  return { lines, rest };
}

function boxOf(diameter: number, radii: number[], fontSize: number): number {
  const outermost = radii[0] ?? 0;
  return Math.max(Math.max(0, diameter), Math.ceil((outermost + fontSize) * 2));
}

/**
 * 直径 `diameter` の円に `text` を置くときの、読める字の大きさと輪の分け方。
 *
 * 和文は 1 文字 ≒ 1em として数える。欧文はこれより狭いので早めに輪が増えるだけで、
 * はみ出して切れることはない（安全側に倒している）。
 */
export function fitRingText(text: string, diameter: number): RingText {
  const label = text.trim();
  const natural = Math.round(Math.min(MAX_FONT, Math.max(MIN_FONT, diameter * FONT_RATIO)));

  if (label.length === 0) {
    return { lines: [], fontSize: natural, truncated: false, box: Math.max(0, diameter) };
  }

  for (let lines = 1; lines <= MAX_LINES; lines += 1) {
    for (let fontSize = natural; fontSize >= MIN_FONT; fontSize -= 1) {
      const radii = ringRadii(diameter, lines, fontSize);
      const perChar = fontSize * (1 + RING_TRACKING);
      const caps = radii.map((radius) => capacityOf(radius, perChar));
      // 字数の合計ではなく、**実際に流し込めたか**で判定する。語の途中で割らない
      // ぶん 1 行は容量より短くなるので、合計だけ見ると欧文で末尾が黙って落ちる。
      const placed = flow(label, radii, caps);
      if (placed.rest.length > 0) continue;

      return {
        lines: placed.lines,
        fontSize,
        truncated: false,
        box: boxOf(diameter, radii, fontSize),
      };
    }
  }

  // ここへは来ない想定（64 字は 3 重に入る）。円が潰れている等の壊れた状況の受け皿。
  const radii = ringRadii(diameter, MAX_LINES, MIN_FONT);
  const perChar = MIN_FONT * (1 + RING_TRACKING);
  const caps = radii.map((radius) => capacityOf(radius, perChar));
  const { lines } = flow(label, radii, caps);
  const last = lines.at(-1);
  // 黙って消えるより、畳んだことが見えるほうが誠実。
  if (last) last.label = `${last.label.slice(0, -1)}…`;
  return { lines, fontSize: MIN_FONT, truncated: true, box: boxOf(diameter, radii, MIN_FONT) };
}
