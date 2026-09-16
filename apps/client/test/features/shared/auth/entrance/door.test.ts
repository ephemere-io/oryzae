import { describe, expect, it } from 'vitest';
import {
  DOOR,
  DOOR_ANGLE,
  doorAngleWhileEntering,
  ENTER_TIMING,
  enterPlan,
  homeEntranceView,
  looksThroughDoorway,
  THRESHOLD_VIEW,
  walkProgress,
  walkView,
} from '@/features/shared/auth/entrance/door';
import { ENTRANCE_PC_LAYOUT, ENTRANCE_SP_LAYOUT } from '@/features/shared/auth/entrance/layout';

describe('enterPlan', () => {
  it('歩き終わる（＝溶け切る）ところで終わる', () => {
    const plan = enterPlan(false);
    expect(plan.totalMs).toBe(ENTER_TIMING.walkDelayMs + ENTER_TIMING.walkMs);
    expect(plan.fadeStartMs + plan.fadeMs).toBe(plan.totalMs);
  });

  it('歩いている間はずっと見えていて、溶けるのは受け渡しのぶんだけ', () => {
    // 以前は歩きの後半（約 0.4 秒）をかけて地の色へ溶かしていて、扉をくぐった先が
    // 白く飛んで「ブツ切れ」と報告された（PR #624）。溶暗は画面が入れ替わる一瞬を隠すだけにする。
    const plan = enterPlan(false);
    expect(plan.fadeMs).toBeLessThanOrEqual(250);
    // 溶かし始めるのは、もう扉の前に着いているところ。
    expect(walkProgress(plan, plan.fadeStartMs)).toBeGreaterThan(0.9);
  });

  it('書斎へ渡す 1 枚は、ほとんど止まったところで撮る', () => {
    // 撮った 1 枚は書斎が読み込まれるまでの地になる。動いている途中で撮ると、最後の
    // フレームと渡す絵がずれて、切り替わりが飛んで見える。
    const plan = enterPlan(false);
    const captureAt = plan.totalMs - ENTER_TIMING.captureLeadMs;
    expect(walkProgress(plan, captureAt)).toBeGreaterThan(0.85);
  });

  it('待たされていると感じる長さにしない（1.2 秒以内）', () => {
    expect(enterPlan(false).totalMs).toBeLessThanOrEqual(1200);
  });

  it('動きを減らす設定では扉もカメラも動かさず、溶かすだけ', () => {
    const plan = enterPlan(true);
    expect(plan.doorMs).toBe(0);
    expect(plan.walkMs).toBe(0);
    expect(plan.fadeStartMs).toBe(0);
    // 溶かす長さは残す（0 だと何が起きたか分からない）。
    expect(plan.fadeMs).toBeGreaterThan(0);
    expect(plan.totalMs).toBe(plan.fadeMs);
  });
});

describe('doorAngleWhileEntering', () => {
  const plan = enterPlan(false);

  it('押し始めた開きから始まり、開き切って止まる', () => {
    expect(doorAngleWhileEntering(plan, DOOR_ANGLE.waiting, 0)).toBeCloseTo(DOOR_ANGLE.waiting);
    expect(doorAngleWhileEntering(plan, DOOR_ANGLE.waiting, plan.doorMs)).toBeCloseTo(
      DOOR_ANGLE.open,
    );
    expect(doorAngleWhileEntering(plan, DOOR_ANGLE.waiting, plan.totalMs * 2)).toBeCloseTo(
      DOOR_ANGLE.open,
    );
  });

  it('途中で閉じる向きに戻らない', () => {
    let previous = doorAngleWhileEntering(plan, DOOR_ANGLE.rest, 0);
    for (let t = 10; t <= plan.doorMs; t += 10) {
      const angle = doorAngleWhileEntering(plan, DOOR_ANGLE.rest, t);
      expect(angle).toBeGreaterThanOrEqual(previous);
      previous = angle;
    }
  });

  it('開き具合は 待つ < 送信中 < 入る の順', () => {
    expect(DOOR_ANGLE.rest).toBeLessThan(DOOR_ANGLE.waiting);
    expect(DOOR_ANGLE.waiting).toBeLessThan(DOOR_ANGLE.open);
    // 壁に当たる（90° を大きく越える）ほどは開かない。
    expect(DOOR_ANGLE.open).toBeLessThan(Math.PI * 0.6);
  });
});

describe('walkProgress', () => {
  const plan = enterPlan(false);

  it('歩き出すまでは 0、歩き終えたら 1', () => {
    expect(walkProgress(plan, 0)).toBe(0);
    expect(walkProgress(plan, plan.walkDelayMs)).toBe(0);
    expect(walkProgress(plan, plan.walkDelayMs + plan.walkMs)).toBeCloseTo(1);
  });

  it('後戻りしない', () => {
    let previous = 0;
    for (let t = 0; t <= plan.totalMs; t += 10) {
      const p = walkProgress(plan, t);
      expect(p).toBeGreaterThanOrEqual(previous);
      previous = p;
    }
  });
});

describe('歩いて入る軌道', () => {
  const plan = enterPlan(false);

  it.each([
    ['PC', ENTRANCE_PC_LAYOUT],
    ['SP', ENTRANCE_SP_LAYOUT],
  ])('%s: 歩き着くまで壁の手前にいて、最後は開口を覗いている', (_, layout) => {
    // 壁を抜けるところまで歩かせていた頃は、枠や扉板がカメラのすぐ脇を通って画面を
    // 縦に横切り、「書斎に入る直前に柱みたいなのが見える」と報告された（PR #624）。
    const from = homeEntranceView(layout);
    for (let t = 0; t <= 1.0001; t += 0.02) {
      expect(walkView(from, t).position.z).toBeGreaterThan(0);
    }
    // 後半はずっと、壁ではなく開口の中を見ている。
    for (let t = 0.6; t <= 1.0001; t += 0.02) {
      expect(looksThroughDoorway(walkView(from, t))).toBe(true);
    }
  });

  it('着く先は扉の正面。扉が扉として読める距離で止まる', () => {
    expect(THRESHOLD_VIEW.position.x).toBe(0);
    // 壁の手前（くぐらない）。扉の丈より遠くで止めれば、枠が絵に収まって扉に見える。
    // 寄りすぎると、開いた扉板と枠だけが画面を縦に横切って「柱」になる。
    expect(THRESHOLD_VIEW.position.z).toBeGreaterThan(DOOR.height);
  });

  it('パララックスで揺れた位置から歩き出しても開口を覗いて終わる', () => {
    const home = homeEntranceView(ENTRANCE_PC_LAYOUT);
    const parallax = ENTRANCE_PC_LAYOUT.parallax;
    if (parallax === null) throw new Error('PC はパララックスを持つ');
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const from = {
          position: {
            x: home.position.x + sx * parallax.x,
            y: home.position.y + sy * parallax.y,
            z: home.position.z,
          },
          target: home.target,
        };
        expect(looksThroughDoorway(walkView(from, walkProgress(plan, plan.totalMs)))).toBe(true);
      }
    }
  });

  it('壁を見ている view は「開口を覗いている」と数えない', () => {
    const wall = {
      position: { x: 40, y: 3, z: 12 },
      target: { x: 40, y: 2, z: 0 },
    };
    expect(looksThroughDoorway(wall)).toBe(false);
  });

  it('壁の奥にいる view は数えない', () => {
    expect(
      looksThroughDoorway({ position: { x: 0, y: 2, z: -2 }, target: { x: 0, y: 2, z: -12 } }),
    ).toBe(false);
  });
});
