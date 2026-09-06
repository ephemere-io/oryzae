import { MAX_QUESTION_STRING_LENGTH } from '@oryzae/shared';
import { describe, expect, it } from 'vitest';
import { fitRingText, RING_TRACKING } from '@/features/sp/fermentation/ring-text';

/**
 * 円の外周に問いを置く計算。
 *
 * ここで守るのは 1 つ:「**問いは全部読める**」。円ひとつの外周には読める大きさで
 * 24 字ほどしか置けないが、問いは最長 64 字ある。足りなければ輪を増やす。
 */

/** 実際に描かれる文字列（輪をまたいでも 1 つの問いとして読めるか見る）。 */
function joined(text: string, diameter: number): string {
  return fitRingText(text, diameter)
    .lines.map((line) => line.label)
    .join('');
}

/** 手前の円と奥の円（sp-jar-orbit の CIRCLE_MAX / CIRCLE_MIN）。 */
const FRONT = 176;
const BACK = 128;

describe('fitRingText', () => {
  it('短い問いは 1 重のまま、そのまま出る', () => {
    const { lines, truncated } = fitRingText('今日は？', 150);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.label).toBe('今日は？');
    expect(truncated).toBe(false);
  });

  it('最長の問い（64 字）でも全文が読める', () => {
    // これが崩れると「問いの一部が見切れる」に戻る。product の上限と揃えてある。
    const long = 'あ'.repeat(MAX_QUESTION_STRING_LENGTH);
    for (const diameter of [FRONT, BACK]) {
      const ring = fitRingText(long, diameter);
      expect(ring.truncated).toBe(false);
      expect(joined(long, diameter)).toBe(long);
      expect(ring.fontSize).toBeGreaterThanOrEqual(12);
    }
  });

  it('どの長さでも 1 字も落とさない', () => {
    // 「置ける字数の合計」だけを見ると、語の途中で割らないぶん行が容量より短くなり、
    // 末尾が黙って落ちる。実際に流し込めたかで判定していることを、全長で確かめる。
    for (let length = 1; length <= MAX_QUESTION_STRING_LENGTH; length += 1) {
      const text = 'あ'.repeat(length);
      for (const diameter of [FRONT, BACK]) {
        expect({ length, diameter, text: joined(text, diameter) }).toEqual({
          length,
          diameter,
          text,
        });
      }
    }
  });

  it('輪をまたいでも問いの語順は変わらない', () => {
    const text = '最近、心が動いたのはどんな瞬間でしたか。そのとき何を考えていましたか。';
    expect(joined(text, FRONT)).toBe(text);
  });

  it('外側の輪から先に読む（12 時では外の輪が上に来る）', () => {
    const long = 'あ'.repeat(MAX_QUESTION_STRING_LENGTH);
    const radii = fitRingText(long, FRONT).lines.map((line) => line.radius);
    expect(radii.length).toBeGreaterThan(1);
    expect([...radii].sort((a, b) => b - a)).toEqual(radii);
  });

  it('輪と輪は行送りぶん離れている（2 本が 1 本の帯に見えない）', () => {
    const long = 'あ'.repeat(MAX_QUESTION_STRING_LENGTH);
    const { lines, fontSize } = fitRingText(long, FRONT);
    for (let i = 1; i < lines.length; i += 1) {
      const gap = (lines[i - 1]?.radius ?? 0) - (lines[i]?.radius ?? 0);
      expect(gap).toBeGreaterThanOrEqual(fontSize);
    }
  });

  it('どの輪も自分の円周に収まる（字送りを含めても超えない）', () => {
    const long = 'あ'.repeat(MAX_QUESTION_STRING_LENGTH);
    const { lines, fontSize } = fitRingText(long, FRONT);
    for (const line of lines) {
      const circumference = 2 * Math.PI * line.radius;
      // 行頭に置けない字を 1 つ引き取ることがあるので、その分だけ緩める。
      const width = (line.label.length - 1) * fontSize * (1 + RING_TRACKING);
      expect(width).toBeLessThanOrEqual(circumference);
    }
  });

  it('少し長いだけなら輪を増やさず字を落とす（円を賑やかにしない）', () => {
    // 30 字は 1 重に入る（17px では入らないが、13px なら入る）。
    const ring = fitRingText('あ'.repeat(30), FRONT);
    expect(ring.lines).toHaveLength(1);
    expect(ring.fontSize).toBeLessThan(17);
    expect(ring.fontSize).toBeGreaterThanOrEqual(12);
  });

  it('SP で読める大きさを保つ（小さい円でも 12px を下回らない）', () => {
    expect(fitRingText('問い', 60).fontSize).toBeGreaterThanOrEqual(12);
    expect(fitRingText('問い', 20).fontSize).toBeGreaterThanOrEqual(12);
  });

  it('大きい円でも肥大しない（円周の飾りであって見出しではない）', () => {
    expect(fitRingText('問い', 600).fontSize).toBeLessThanOrEqual(17);
  });

  it('句読点や閉じ括弧を行頭に置かない', () => {
    const text = 'あ'.repeat(23) + '、' + 'い'.repeat(40);
    for (const line of fitRingText(text, FRONT).lines.slice(1)) {
      expect('、。？！」）').not.toContain(line.label.charAt(0));
    }
  });

  it('欧文は語の途中で割らない', () => {
    const text = 'what did you notice about the light in the room this morning';
    const lines = fitRingText(text, FRONT).lines;
    expect(lines.length).toBeGreaterThan(1);
    // 割れていなければ、行を空白でつなぎ直すと元に戻る。
    expect(lines.map((line) => line.label).join(' ')).toBe(text);
  });

  it('いちばん外の輪まで描ける大きさを返す（切れない）', () => {
    const long = 'あ'.repeat(MAX_QUESTION_STRING_LENGTH);
    const { lines, fontSize, box } = fitRingText(long, FRONT);
    const outermost = lines[0]?.radius ?? 0;
    expect(box / 2).toBeGreaterThanOrEqual(outermost + fontSize);
    // 円そのものより小さくはならない。
    expect(box).toBeGreaterThanOrEqual(FRONT);
  });

  it('前後の空白は落とす（textPath の始点がずれる）', () => {
    expect(fitRingText('  問い  ', 150).lines[0]?.label).toBe('問い');
  });

  it('空文字でも落ちない', () => {
    expect(fitRingText('', 150)).toEqual({
      lines: [],
      fontSize: 15,
      truncated: false,
      box: 150,
    });
  });

  it('直径 0 でも落ちない（初回レイアウト前に呼ばれうる）', () => {
    const ring = fitRingText('問い', 0);
    expect(ring.fontSize).toBeGreaterThan(0);
    expect(ring.box).toBeGreaterThanOrEqual(0);
  });
});
