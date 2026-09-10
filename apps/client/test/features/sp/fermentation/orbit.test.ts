import { describe, expect, it } from 'vitest';
import {
  clampSpin,
  decaySpin,
  dragToSpin,
  frontIndex,
  IDLE_SPIN,
  MAX_SPIN,
  orbitSlot,
} from '@/features/sp/fermentation/orbit';

describe('orbitSlot', () => {
  it('問いが無ければ中央の既定値', () => {
    expect(orbitSlot(0, 0, 0)).toEqual({ x: 0, depth: 1, scale: 1, opacity: 1, z: 1000 });
  });

  it('角度 0 では 0 番目が正面に来る', () => {
    const slot = orbitSlot(0, 4, 0);
    expect(slot.depth).toBeCloseTo(1, 10);
    expect(slot.x).toBeCloseTo(0, 10);
  });

  it('等間隔に並ぶ', () => {
    const xs = [0, 1, 2, 3].map((i) => orbitSlot(i, 4, 0).x);
    // 4 つなら 正面 / 右 / 奥 / 左。
    expect(xs[0]).toBeCloseTo(0, 10);
    expect(xs[1]).toBeCloseTo(1, 10);
    expect(xs[2]).toBeCloseTo(0, 10);
    expect(xs[3]).toBeCloseTo(-1, 10);
  });

  it('手前ほど大きく濃い', () => {
    const front = orbitSlot(0, 2, 0);
    const back = orbitSlot(1, 2, 0);
    expect(front.depth).toBeGreaterThan(back.depth);
    expect(front.scale).toBeGreaterThan(back.scale);
    expect(front.opacity).toBeGreaterThan(back.opacity);
    expect(front.z).toBeGreaterThan(back.z);
  });

  it('奥でも消えない（存在は分かる）', () => {
    const back = orbitSlot(1, 2, 0);
    expect(back.opacity).toBeGreaterThan(0.2);
    expect(back.scale).toBeGreaterThan(0.4);
  });

  it('x と depth が単位円の上にある', () => {
    for (const angle of [0, 0.7, 2.2, 5.9]) {
      for (let i = 0; i < 5; i++) {
        const { x, depth } = orbitSlot(i, 5, angle);
        expect(x * x + depth * depth).toBeCloseTo(1, 10);
      }
    }
  });

  it('一周すると元に戻る', () => {
    const a = orbitSlot(1, 3, 0.4);
    const b = orbitSlot(1, 3, 0.4 + Math.PI * 2);
    expect(b.x).toBeCloseTo(a.x, 10);
    expect(b.depth).toBeCloseTo(a.depth, 10);
  });

  it('z が CSS に渡せる整数', () => {
    for (let i = 0; i < 6; i++) {
      expect(Number.isInteger(orbitSlot(i, 6, 1.1).z)).toBe(true);
    }
  });
});

describe('decaySpin', () => {
  it('速く回したあとは既定の速さへ戻る', () => {
    let velocity = 5;
    for (let i = 0; i < 60; i++) velocity = decaySpin(velocity, 0.1);
    expect(velocity).toBeCloseTo(IDLE_SPIN, 4);
  });

  it('止まらない（触るまで動かない置物にしない）', () => {
    let velocity = 5;
    for (let i = 0; i < 100; i++) velocity = decaySpin(velocity, 0.1);
    expect(velocity).toBeGreaterThan(0);
  });

  it('逆回しでも既定の速さへ戻る', () => {
    let velocity = -4;
    for (let i = 0; i < 60; i++) velocity = decaySpin(velocity, 0.1);
    expect(velocity).toBeCloseTo(IDLE_SPIN, 4);
  });

  it('単調に近づく（行き過ぎて振動しない）', () => {
    let velocity = 5;
    let previous = velocity;
    for (let i = 0; i < 30; i++) {
      velocity = decaySpin(velocity, 0.05);
      expect(velocity).toBeLessThanOrEqual(previous + 1e-9);
      previous = velocity;
    }
  });

  it('経過時間が不正でもそのまま返す', () => {
    expect(decaySpin(3, 0)).toBe(3);
    expect(decaySpin(3, -1)).toBe(3);
    expect(decaySpin(Number.NaN, 0.1)).toBeNaN();
  });

  it('フレーム間隔が変わっても同じ時間で同じところへ行く', () => {
    // 60fps と 30fps で 1 秒ぶん回したとき、ほぼ同じ速さになること。
    let fast = 5;
    for (let i = 0; i < 60; i++) fast = decaySpin(fast, 1 / 60);
    let slow = 5;
    for (let i = 0; i < 30; i++) slow = decaySpin(slow, 1 / 30);
    expect(fast).toBeCloseTo(slow, 6);
  });
});

describe('dragToSpin', () => {
  it('画面を横切ると一周ぶんの勢いになる', () => {
    expect(dragToSpin(390, 390)).toBeCloseTo(Math.PI * 2, 10);
  });

  it('端末の幅が違っても手応えが揃う', () => {
    expect(dragToSpin(195, 390)).toBeCloseTo(dragToSpin(320, 640), 10);
  });

  it('逆向きに引けば逆に回る', () => {
    expect(dragToSpin(-100, 390)).toBeLessThan(0);
  });

  it('幅が 0 でも落ちない', () => {
    expect(dragToSpin(100, 0)).toBe(0);
  });
});

describe('clampSpin', () => {
  it('速すぎる回転を抑える（問いが読めなくなる）', () => {
    expect(clampSpin(100)).toBe(MAX_SPIN);
    expect(clampSpin(-100)).toBe(-MAX_SPIN);
  });

  it('範囲内はそのまま', () => {
    expect(clampSpin(1.5)).toBe(1.5);
  });

  it('壊れた値は既定の速さに倒す', () => {
    expect(clampSpin(Number.NaN)).toBe(IDLE_SPIN);
  });
});

describe('frontIndex', () => {
  it('いちばん手前の問いを返す', () => {
    expect(frontIndex(4, 0)).toBe(0);
    // 4 つのうち 1 つぶん回すと次が正面に来る。
    expect(frontIndex(4, -Math.PI / 2)).toBe(1);
  });

  it('問いが無ければ -1', () => {
    expect(frontIndex(0, 0)).toBe(-1);
  });
});
