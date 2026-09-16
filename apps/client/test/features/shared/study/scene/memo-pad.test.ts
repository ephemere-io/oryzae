import { describe, expect, it } from 'vitest';
import { edgeLineCount } from '@/features/shared/study/scene/books';
import {
  MEMO_PAD,
  MEMO_PAD_BINDING,
  MEMO_PAD_HIT,
  MEMO_PAD_RULES,
  MEMO_PAD_TILT,
  memoPadHitSize,
  memoPadRuleZs,
} from '@/features/shared/study/scene/memo-pad';

describe('メモ帳の束', () => {
  it('縦長の小さな束（手帳より小さく、鉛筆の隣に収まる）', () => {
    expect(MEMO_PAD.depth).toBeGreaterThan(MEMO_PAD.width);
    expect(MEMO_PAD.width).toBeLessThan(2.6);
    expect(MEMO_PAD.thickness).toBeGreaterThan(0.05);
    expect(MEMO_PAD.thickness).toBeLessThan(0.3);
  });

  it('小口の罫は手帳と同じ規則で本数が決まる（束に見える下限を割らない）', () => {
    expect(edgeLineCount(MEMO_PAD.thickness)).toBeGreaterThanOrEqual(7);
  });

  it('置いた向きは鉛筆と同じ側にわずかに回る', () => {
    expect(MEMO_PAD_TILT).toBeGreaterThan(0);
    expect(MEMO_PAD_TILT).toBeLessThan(0.4);
  });
});

describe('上の 1 枚の罫線（memoPadRuleZs）', () => {
  it('綴じの線より手前から、手前の余白を残して均等に並ぶ', () => {
    const zs = memoPadRuleZs(MEMO_PAD_RULES.count);
    expect(zs).toHaveLength(MEMO_PAD_RULES.count);
    const bindingZ = -MEMO_PAD.depth / 2 + MEMO_PAD_BINDING.inset;
    expect(zs[0]).toBeGreaterThan(bindingZ);
    expect(zs[zs.length - 1]).toBeLessThan(MEMO_PAD.depth / 2 - MEMO_PAD_RULES.bottomInset + 1e-9);
    for (let i = 1; i < zs.length; i++) {
      expect((zs[i] ?? 0) - (zs[i - 1] ?? 0)).toBeCloseTo((zs[1] ?? 0) - (zs[0] ?? 0), 10);
    }
  });

  it('縮めても同じ比で並ぶ', () => {
    const full = memoPadRuleZs(3);
    const small = memoPadRuleZs(3, MEMO_PAD.depth, 0.8);
    full.forEach((z, index) => {
      expect(small[index]).toBeCloseTo(z * 0.8, 10);
    });
  });

  it('1 本なら中央、0 本や入らない寸法なら空', () => {
    expect(memoPadRuleZs(1)).toHaveLength(1);
    expect(memoPadRuleZs(0)).toEqual([]);
    expect(memoPadRuleZs(3, 0.3)).toEqual([]);
  });

  it('罫線は板のスニペットカードと同じく薄い（面の色に負けない程度）', () => {
    expect(MEMO_PAD_RULES.opacity).toBeGreaterThan(0.1);
    expect(MEMO_PAD_RULES.opacity).toBeLessThan(0.4);
    expect(MEMO_PAD_BINDING.opacity).toBeGreaterThan(MEMO_PAD_RULES.opacity);
  });
});

describe('当たりの箱', () => {
  it('束より一回り大きく囲む（鉛筆と同じ理由）', () => {
    const [w, h, d] = memoPadHitSize();
    expect(w).toBeGreaterThan(MEMO_PAD.width);
    expect(d).toBeGreaterThan(MEMO_PAD.depth);
    expect(h).toBe(MEMO_PAD_HIT.height);
    expect(h).toBeGreaterThan(MEMO_PAD.thickness);
  });

  it('縮めると箱も縮む', () => {
    const [w] = memoPadHitSize(0.8);
    expect(w).toBeCloseTo((MEMO_PAD.width + MEMO_PAD_HIT.margin * 2) * 0.8, 10);
  });
});
