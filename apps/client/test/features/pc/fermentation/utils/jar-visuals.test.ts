import { describe, expect, it } from 'vitest';
import {
  JAR_BUBBLE_SLOTS,
  JAR_MICROBE_SLOTS,
  JAR_READINESS_MAX,
  jarParticleCount,
  jarVisuals,
} from '@/features/pc/fermentation/utils/jar-visuals';

const TOTAL_WORDS = 23; // JarVessel の語彙数（particle 8 + filler 15）

describe('jarVisuals', () => {
  it('readiness 0 は空っぽの瓶（液・微生物・泡すべてゼロ）', () => {
    const v = jarVisuals(0);
    expect(v.fillRatio).toBe(0);
    expect(v.microbeCount).toBe(0);
    expect(v.bubbleCount).toBe(0);
    expect(v.agitation).toBe(1);
  });

  it('0→1 の区間では液面だけが上がる（微生物も泡もまだ出ない）', () => {
    const v = jarVisuals(0.5);
    expect(v.fillRatio).toBe(0.5);
    expect(v.microbeCount).toBe(0);
    expect(v.bubbleCount).toBe(0);
    expect(v.agitation).toBe(1);
  });

  it('readiness 1.0 で液が満ちきる（「かなり熟成している」段階）', () => {
    const v = jarVisuals(1);
    expect(v.fillRatio).toBe(1);
    expect(v.microbeCount).toBe(0);
    expect(v.bubbleCount).toBe(0);
  });

  it('1→2 の区間で微生物が増え動きが速くなる（泡はまだ出ない）', () => {
    const v = jarVisuals(1.5);
    expect(v.fillRatio).toBe(1);
    expect(v.microbeCount).toBe(JAR_MICROBE_SLOTS / 2);
    expect(v.agitation).toBeGreaterThan(1);
    expect(v.bubbleCount).toBe(0);
  });

  it('readiness 2.0 で微生物が出そろい、泡はちょうど出始める境目', () => {
    const v = jarVisuals(2);
    expect(v.microbeCount).toBe(JAR_MICROBE_SLOTS);
    expect(v.agitation).toBe(2.5);
    expect(v.bubbleCount).toBe(0);
  });

  it('2→3 の区間で泡が増える（「ぶくぶく」の段階）', () => {
    expect(jarVisuals(2.5).bubbleCount).toBe(Math.round(JAR_BUBBLE_SLOTS / 2));
    expect(jarVisuals(3).bubbleCount).toBe(JAR_BUBBLE_SLOTS);
  });

  it('warmth は 0→3 でゆるやかに上がりきる', () => {
    expect(jarVisuals(0).warmth).toBe(0);
    expect(jarVisuals(JAR_READINESS_MAX).warmth).toBe(1);
    expect(jarVisuals(1.5).warmth).toBeCloseTo(0.5, 5);
  });

  it('上限を超える readiness は 3.0 と同じ扱い（問いの上限が増えても壊れない）', () => {
    expect(jarVisuals(99)).toEqual(jarVisuals(JAR_READINESS_MAX));
  });

  it('負や NaN は 0 と同じ扱い（描画が壊れない）', () => {
    expect(jarVisuals(-1)).toEqual(jarVisuals(0));
    expect(jarVisuals(Number.NaN)).toEqual(jarVisuals(0));
    expect(jarVisuals(Number.POSITIVE_INFINITY)).toEqual(jarVisuals(0));
  });
});

describe('jarParticleCount', () => {
  it('readiness 0 でも最低限の文字は残る（ただの空き瓶に見せない）', () => {
    expect(jarParticleCount(0, TOTAL_WORDS)).toBe(3);
  });

  it('readiness 3.0 で語彙をすべて出す', () => {
    expect(jarParticleCount(3, TOTAL_WORDS)).toBe(TOTAL_WORDS);
  });

  it('途中は最小と総数のあいだを線形に補間する', () => {
    expect(jarParticleCount(1.5, TOTAL_WORDS)).toBe(3 + Math.round((TOTAL_WORDS - 3) * 0.5));
  });

  it('語彙が最小数より少なくても総数を超えない', () => {
    expect(jarParticleCount(0, 2)).toBe(2);
    expect(jarParticleCount(3, 2)).toBe(2);
  });
});
