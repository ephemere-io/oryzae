import { describe, expect, it } from 'vitest';
import {
  crossesThroughDoorway,
  DOOR_ANGLE,
  doorAngleWhileEntering,
  ENTER_TIMING,
  enterPlan,
  homeEntranceView,
  THROUGH_VIEW,
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
    const from = homeEntranceView(ENTRANCE_PC_LAYOUT);

    let crossedAt = plan.totalMs;
    for (let t = 0; t <= plan.totalMs; t += 5) {
      if (walkView(from, walkProgress(plan, t)).position.z < 0) {
        crossedAt = t;
        break;
      }
    }

    expect(plan.fadeMs).toBeLessThanOrEqual(250);
    // 敷居をまたぐところまでは、まだ溶け始めていない（空間が続いて見える）。
    expect(plan.fadeStartMs).toBeGreaterThan(crossedAt * 0.8);
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
  it.each([
    ['PC', ENTRANCE_PC_LAYOUT],
    ['SP', ENTRANCE_SP_LAYOUT],
  ])('%s: 待っている位置から、壁ではなく扉の開口を通って奥へ抜ける', (_, layout) => {
    expect(crossesThroughDoorway(homeEntranceView(layout))).toBe(true);
  });

  it('パララックスで揺れた位置から歩き出しても開口を通る', () => {
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
        expect(crossesThroughDoorway(from)).toBe(true);
      }
    }
  });

  it('壁をまたがない軌道は「通った」と数えない', () => {
    // 始めから壁の奥にいる（終点と同じ側）ので、壁の面を一度も越えない。
    expect(crossesThroughDoorway(THROUGH_VIEW)).toBe(false);
  });

  it('開口の外（壁）を通る軌道は通ったと数えない', () => {
    const farRight = {
      position: { x: 40, y: 3, z: 12 },
      target: { x: 40, y: 2, z: 0 },
    };
    expect(crossesThroughDoorway(farRight)).toBe(false);
  });
});
