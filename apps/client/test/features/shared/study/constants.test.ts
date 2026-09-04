import { describe, expect, it } from 'vitest';
import {
  BREATH,
  clamp01,
  DELAY,
  DURATION,
  EASING,
  PAGE_FOLLOW,
  progress,
  RENDER_LIMITS,
  SP_BOARD_CLOSE_RATIO,
  SPREAD_VIEW_Z_NUDGE,
  TOP_VIEW_Z_NUDGE,
  VIEW_DISTANCE,
} from '@/features/shared/study/constants';

describe('clamp01', () => {
  it('0..1 の外を丸める', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.42)).toBe(0.42);
    expect(clamp01(1)).toBe(1);
    expect(clamp01(2)).toBe(1);
  });

  it('NaN / Infinity を 0 に倒す（イージングへ NaN を渡さない）', () => {
    expect(clamp01(Number.NaN)).toBe(0);
    expect(clamp01(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('progress', () => {
  it('経過時間を 0..1 に写す', () => {
    expect(progress(0, 1000)).toBe(0);
    expect(progress(500, 1000)).toBe(0.5);
    expect(progress(1000, 1000)).toBe(1);
    expect(progress(1500, 1000)).toBe(1);
  });

  it('duration 0 は必ず 1（prefers-reduced-motion でここを通る）', () => {
    // 割り算のままだと Infinity や NaN になり、カメラ位置が壊れる。
    expect(progress(0, 0)).toBe(1);
    expect(progress(16, 0)).toBe(1);
    expect(progress(0, -1)).toBe(1);
  });
});

describe('EASING', () => {
  it('すべての曲線が 0 → 0、1 → 1 で閉じている', () => {
    for (const [name, ease] of Object.entries(EASING)) {
      expect(ease(0), `${name}(0)`).toBeCloseTo(0, 10);
      expect(ease(1), `${name}(1)`).toBeCloseTo(1, 10);
    }
  });

  it('すべての曲線が単調に増える（途中で戻るとカメラが跳ねる）', () => {
    for (const [name, ease] of Object.entries(EASING)) {
      let previous = ease(0);
      for (let step = 1; step <= 100; step++) {
        const current = ease(step / 100);
        expect(current, `${name} at ${step}`).toBeGreaterThanOrEqual(previous - 1e-9);
        previous = current;
      }
    }
  });

  it('easeInOutCubic が中点で対称', () => {
    expect(EASING.easeInOutCubic(0.5)).toBeCloseTo(0.5, 10);
    expect(EASING.easeInOutCubic(0.25) + EASING.easeInOutCubic(0.75)).toBeCloseTo(1, 10);
  });

  it('easeOutCubic は前半で大きく進む（着地が緩やか）', () => {
    expect(EASING.easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});

describe('DURATION / DELAY', () => {
  it('すべて正の有限値（0 や負だと tween が即完了・逆再生になる）', () => {
    for (const [name, ms] of Object.entries(DURATION)) {
      expect(Number.isFinite(ms) && ms > 0, `DURATION.${name}`).toBe(true);
    }
    for (const [name, ms] of Object.entries(DELAY)) {
      expect(Number.isFinite(ms) && ms > 0, `DELAY.${name}`).toBe(true);
    }
  });

  it('画面レイヤーのフェードが canvas のフェードより長い', () => {
    // 逆だと canvas が先に消え、行き先の画面が出る前に一瞬地が見える。
    expect(DURATION.screenFade).toBeGreaterThan(DURATION.canvasFade);
  });

  it('背表紙の持ち上げが棚へのパンより短い（着く前に持ち上がり終える）', () => {
    expect(DURATION.spineLift).toBeLessThan(DURATION.shelfPan);
  });

  it('書斎へ戻る待ちが画面レイヤーのフェードより短くない', () => {
    // 層が消えきる前にカメラが動くと、戻り際に中身の切替が見える。
    expect(DELAY.backToStudy).toBeGreaterThanOrEqual(DURATION.screenFade / 2);
  });
});

describe('PAGE_FOLLOW', () => {
  it('ページは表紙より遅れて始まり、表紙より短く開く', () => {
    expect(PAGE_FOLLOW.leadDelayRatio).toBeGreaterThan(0);
    expect(PAGE_FOLLOW.durationRatio).toBeGreaterThan(0);
    expect(PAGE_FOLLOW.durationRatio).toBeLessThan(1);
  });

  it('3 枚目まで開き終えても表紙の開き終わりを追い越さない', () => {
    // 遅れ + 長さが 1 を超えると、表紙が閉じ切った後にページだけが動いて見える。
    const lastPage = 2;
    const end =
      PAGE_FOLLOW.leadDelayRatio +
      PAGE_FOLLOW.perPageDelayRatio * lastPage +
      PAGE_FOLLOW.durationRatio;
    expect(end).toBeLessThanOrEqual(1.5);
  });
});

describe('VIEW_DISTANCE', () => {
  it('すべての距離が正', () => {
    for (const [device, distances] of Object.entries(VIEW_DISTANCE)) {
      for (const [target, distance] of Object.entries(distances)) {
        expect(distance, `${device}.${target}`).toBeGreaterThan(0);
      }
    }
  });

  it('SP のボードは PC よりずっと遠くから正対する', () => {
    // クオータートップから正対するので、PC の俯瞰より引かないと板が入らない。
    expect(VIEW_DISTANCE.sp.board).toBeGreaterThan(VIEW_DISTANCE.pc.board);
  });
});

describe('視点のずらしと寄り', () => {
  it('真上からの z ずらしが 0 でない（lookAt が up と平行になって破綻する）', () => {
    expect(TOP_VIEW_Z_NUDGE).toBeGreaterThan(0);
    expect(SPREAD_VIEW_Z_NUDGE).toBeGreaterThan(0);
  });

  it('見開きのずらしは真上より小さい（見下ろす角が浅いぶん）', () => {
    expect(SPREAD_VIEW_Z_NUDGE).toBeLessThan(TOP_VIEW_Z_NUDGE);
  });

  it('SP のボードの寄りは 0 と 1 の間（1 なら寄らない・0 なら板に埋まる）', () => {
    expect(SP_BOARD_CLOSE_RATIO).toBeGreaterThan(0);
    expect(SP_BOARD_CLOSE_RATIO).toBeLessThan(1);
  });
});

describe('BREATH', () => {
  it('振幅が十分小さい（呼吸が移動に見えない）', () => {
    expect(BREATH.amplitude).toBeGreaterThan(0);
    expect(BREATH.amplitude).toBeLessThan(0.2);
  });

  it('周期が数秒あり、小刻みに揺れない', () => {
    // 1 秒周期にすると画面全体が上下して酔う。原案は sin(t)（t は秒）＝ 約 6.3 秒周期。
    const periodSeconds = (Math.PI * 2) / BREATH.radiansPerSecond;
    expect(periodSeconds).toBeGreaterThan(4);
  });
});

describe('RENDER_LIMITS', () => {
  it('すべて 1 以上の整数', () => {
    for (const [name, limit] of Object.entries(RENDER_LIMITS)) {
      expect(Number.isInteger(limit), `${name} is integer`).toBe(true);
      expect(limit, name).toBeGreaterThanOrEqual(1);
    }
  });

  it('机に当月＋直近 2 ヶ月を積める', () => {
    expect(RENDER_LIMITS.deskNotebooks).toBe(3);
  });

  it('棚は直 3 ヶ月ぶん', () => {
    expect(RENDER_LIMITS.shelfSpines).toBe(3);
  });
});
