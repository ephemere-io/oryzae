import { describe, expect, it } from 'vitest';
import {
  BUBBLE_START_RATIO,
  bubbleRisePx,
  JAR_BUBBLE_SLOTS,
  JAR_MICROBE_SLOTS,
  jarParticleCount,
  jarVisuals,
  LIQUID_SURFACE_RATIO,
  MAX_QUESTIONS,
} from '@/features/pc/fermentation/utils/jar-visuals';

const TOTAL_WORDS = 23; // JarVessel の語彙数（particle 8 + filler 15）

/** 問い1つだけを持つ人。total は top と等しい。 */
const solo = (top: number) => jarVisuals(top, top);
/** 問い3つを同じ進み具合で同時に発酵させている人。 */
const trio = (each: number) => jarVisuals(each, each * MAX_QUESTIONS);

describe('jarVisuals — 段階は top が決める', () => {
  it('readiness 0 は空っぽの瓶（液・微生物・泡すべてゼロ）', () => {
    const v = solo(0);
    expect(v.fillRatio).toBe(0);
    expect(v.microbeCount).toBe(0);
    expect(v.bubbleCount).toBe(0);
    expect(v.agitation).toBe(1);
  });

  it('最初の1/3で液面だけが上がる（微生物も泡もまだ出ない）', () => {
    const v = solo(1 / 6);
    expect(v.fillRatio).toBeCloseTo(0.5, 5);
    expect(v.microbeCount).toBe(0);
    expect(v.bubbleCount).toBe(0);
  });

  it('1/3 で液が満ちきる', () => {
    expect(solo(1 / 3).fillRatio).toBe(1);
    expect(solo(1 / 3).microbeCount).toBe(0);
  });

  it('1/3〜2/3 で微生物が増え、動きが速くなる（泡はまだ）', () => {
    const v = solo(0.5);
    expect(v.fillRatio).toBe(1);
    expect(v.microbeCount).toBeGreaterThan(0);
    expect(v.agitation).toBeGreaterThan(1);
    expect(v.bubbleCount).toBe(0);
  });

  it('2/3 は泡が出はじめる境目（微生物は出そろっている）', () => {
    const v = solo(2 / 3);
    expect(v.bubbleCount).toBe(0);
    expect(v.microbeCount).toBeGreaterThan(0);
  });

  it('2/3〜1 で泡が増える', () => {
    expect(solo(1).bubbleCount).toBeGreaterThan(solo(0.8).bubbleCount);
  });

  it('warmth は top に沿って上がりきる', () => {
    expect(solo(0).warmth).toBe(0);
    expect(solo(1).warmth).toBe(1);
    expect(solo(0.5).warmth).toBeCloseTo(0.5, 5);
  });
});

describe('jarVisuals — 問い1つでも泡立つ（PR #559 レビューでの決定）', () => {
  // 当初は総和だけで段階を切っていたため、問い1つの人は上限 1.0 で泡に届かなかった。
  // 「問いをひとつしか持ってない人でも泡立ってほしい」がレビューでの結論。
  it('問いが1つでも、その問いが満タンなら泡が立つ', () => {
    expect(solo(1).bubbleCount).toBeGreaterThan(0);
  });

  it('問いが1つでも段階は最後まで進む（液は満ち、微生物も出る）', () => {
    const v = solo(1);
    expect(v.fillRatio).toBe(1);
    expect(v.microbeCount).toBeGreaterThan(0);
    expect(v.warmth).toBe(1);
  });
});

describe('jarVisuals — 同時に多く発酵させている人ほど瓶が賑やか', () => {
  // 「問いを多く同時に発酵させている人の瓶の方が発酵がすごいことになってる」
  // というギミックも同じレビューでの要望。段階ではなく密度で表現する。
  it('同じ段階でも、問い3つのほうが微生物も泡も多い', () => {
    expect(trio(1).microbeCount).toBeGreaterThan(solo(1).microbeCount);
    expect(trio(1).bubbleCount).toBeGreaterThan(solo(1).bubbleCount);
  });

  it('同じ段階でも、問い3つのほうが動きが速い', () => {
    expect(trio(1).agitation).toBeGreaterThan(solo(1).agitation);
  });

  it('問い3つが満タンで微生物と泡が上限に達する', () => {
    expect(trio(1).microbeCount).toBe(JAR_MICROBE_SLOTS);
    expect(trio(1).bubbleCount).toBe(JAR_BUBBLE_SLOTS);
  });

  it('段階そのものは問いの数で変わらない（液面と色は top だけで決まる）', () => {
    expect(trio(0.5).fillRatio).toBe(solo(0.5).fillRatio);
    expect(trio(0.5).warmth).toBe(solo(0.5).warmth);
  });

  it('他の問いが止まっていれば密度は上がらない（total が増えないため）', () => {
    // 問い3つあるが、動いているのは1つだけ = total は top と同じ。
    expect(jarVisuals(1, 1)).toEqual(solo(1));
  });
});

describe('jarVisuals — 壊れた入力', () => {
  it('top が上限を超えても 1.0 と同じ扱い', () => {
    expect(jarVisuals(99, 99)).toEqual(trio(1));
  });

  it('負・NaN・Infinity は 0 と同じ扱い（空の瓶に倒す）', () => {
    // 上限超えの有限値は「満タン」に丸めるが、非数は値として信用できないので
    // 空の瓶へ倒す。壊れた応答が「発酵直前」に見えるほうが害が大きい。
    expect(jarVisuals(-1, -1)).toEqual(solo(0));
    expect(jarVisuals(Number.NaN, Number.NaN)).toEqual(solo(0));
    expect(jarVisuals(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY)).toEqual(solo(0));
  });

  it('total が top を下回る矛盾した入力でも破綻しない', () => {
    // 総和の一部が top なので本来ありえないが、来ても top に合わせて整合させる。
    expect(jarVisuals(1, 0)).toEqual(solo(1));
  });
});

describe('jarParticleCount', () => {
  it('readiness 0 でも最低限の文字は残る（ただの空き瓶に見せない）', () => {
    expect(jarParticleCount(0, TOTAL_WORDS)).toBe(3);
  });

  it('top が 1.0 で語彙をすべて出す', () => {
    expect(jarParticleCount(1, TOTAL_WORDS)).toBe(TOTAL_WORDS);
  });

  it('途中は最小と総数のあいだを線形に補間する', () => {
    expect(jarParticleCount(0.5, TOTAL_WORDS)).toBe(3 + Math.round((TOTAL_WORDS - 3) * 0.5));
  });

  it('語彙が最小数より少なくても総数を超えない', () => {
    expect(jarParticleCount(0, 2)).toBe(2);
    expect(jarParticleCount(1, 2)).toBe(2);
  });
});

describe('bubbleRisePx', () => {
  // #533 で瓶が 420×520 → 500×620 になったとき、上昇距離が 260px 決め打ちだったため
  // 泡が液面の 60px 手前で消えていた。DOM の個数チェックは全部緑だったので気づけない。
  // 「泡は液面まで昇る」という関係そのものをここで固定する。
  it.each([420, 520, 620, 800])('高さ %i px でも泡はちょうど液面まで昇る', (height) => {
    const start = height * BUBBLE_START_RATIO;
    const surface = height * LIQUID_SURFACE_RATIO;
    expect(start + bubbleRisePx(height)).toBeCloseTo(surface, 0);
  });

  it('高さに比例する（px 決め打ちに戻していない）', () => {
    expect(bubbleRisePx(620)).toBeGreaterThan(bubbleRisePx(520));
    // px 整数へ丸めるぶん厳密な2倍にはならないので 1px の幅を許す。
    expect(Math.abs(bubbleRisePx(1040) - bubbleRisePx(520) * 2)).toBeLessThanOrEqual(1);
  });

  it('液面より上へは行き過ぎない（泡が瓶の外へ抜けない）', () => {
    for (const height of [420, 520, 620, 800]) {
      expect(height * BUBBLE_START_RATIO + bubbleRisePx(height)).toBeLessThanOrEqual(
        height * LIQUID_SURFACE_RATIO + 1,
      );
    }
  });
});
