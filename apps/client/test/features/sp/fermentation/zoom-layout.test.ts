import { describe, expect, it } from 'vitest';
import { ringSlots } from '@/features/sp/fermentation/zoom-layout';

describe('ringSlots', () => {
  it('0 個なら空', () => {
    expect(ringSlots(0, 30, 0)).toEqual([]);
    expect(ringSlots(-1, 30, 0)).toEqual([]);
  });

  it('角度 0 の 1 個目は真上に来る', () => {
    const [slot] = ringSlots(1, 30, 0);
    expect(slot.xPercent).toBeCloseTo(50, 10);
    expect(slot.yPercent).toBeCloseTo(20, 10);
  });

  it('4 個は上・右・下・左に並ぶ', () => {
    const slots = ringSlots(4, 30, 0);
    expect(slots.map((s) => [Math.round(s.xPercent), Math.round(s.yPercent)])).toEqual([
      [50, 20],
      [80, 50],
      [50, 80],
      [20, 50],
    ]);
  });

  it('すべて輪の上にある（半径が揃う）', () => {
    for (const slot of ringSlots(7, 32, 0.4)) {
      const dx = slot.xPercent - 50;
      const dy = slot.yPercent - 50;
      expect(Math.sqrt(dx * dx + dy * dy)).toBeCloseTo(32, 10);
    }
  });

  it('等間隔なので重ならない（隣どうしの距離が全部同じ）', () => {
    const slots = ringSlots(5, 30, 0);
    const gaps = slots.map((slot, i) => {
      const next = slots[(i + 1) % slots.length];
      return Math.hypot(next.xPercent - slot.xPercent, next.yPercent - slot.yPercent);
    });
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0], 8);
    expect(gaps[0]).toBeGreaterThan(0);
  });

  it('輪ごとに startAngle をずらすと方角が重ならない', () => {
    const inner = ringSlots(3, 28, 0);
    const outer = ringSlots(3, 44, Math.PI / 3);
    for (const a of inner) {
      for (const b of outer) {
        // 同じ方角に並ぶと内外が視覚的に一直線になり、指で選び分けづらい。
        const angleA = Math.atan2(a.xPercent - 50, 50 - a.yPercent);
        const angleB = Math.atan2(b.xPercent - 50, 50 - b.yPercent);
        expect(Math.abs(angleA - angleB)).toBeGreaterThan(0.1);
      }
    }
  });

  it('円の外へ出ない（半径 45% までなら 0..100 に収まる）', () => {
    for (const slot of ringSlots(9, 45, 1.2)) {
      expect(slot.xPercent).toBeGreaterThanOrEqual(0);
      expect(slot.xPercent).toBeLessThanOrEqual(100);
      expect(slot.yPercent).toBeGreaterThanOrEqual(0);
      expect(slot.yPercent).toBeLessThanOrEqual(100);
    }
  });
});
