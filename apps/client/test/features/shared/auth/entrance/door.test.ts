import { describe, expect, it } from 'vitest';
import {
  DOOR,
  DOOR_ANGLE,
  doorAngleWhileEntering,
  ENTER_TIMING,
  enterPlan,
  GLIDE,
  glideView,
  homeEntranceView,
  looksThroughDoorway,
} from '@/features/shared/auth/entrance/door';
import { ENTRANCE_PC_LAYOUT, ENTRANCE_SP_LAYOUT } from '@/features/shared/auth/entrance/layout';
import type { CameraView } from '@/features/shared/study/scene/camera';

/** 歩きを 1 コマずつ進めて、その道のりを返す（`scene.ts` の tick と同じ回し方）。 */
function walk(from: CameraView, untilMs: number, stepMs = 16): CameraView[] {
  const path: CameraView[] = [from];
  let view = from;
  for (let t = stepMs; t <= untilMs; t += stepMs) {
    view = glideView(view, t, stepMs);
    path.push(view);
  }
  return path;
}

function remaining(view: CameraView): number {
  const { position } = GLIDE.target;
  return Math.hypot(
    view.position.x - position.x,
    view.position.y - position.y,
    view.position.z - position.z,
  );
}

describe('enterPlan', () => {
  it('扉の正面に来たところで、行き先へ移ってよい', () => {
    const plan = enterPlan(false);
    expect(plan.totalMs).toBe(ENTER_TIMING.walkDelayMs + ENTER_TIMING.walkMs);
    expect(plan.fadeStartMs + plan.fadeMs).toBe(plan.totalMs);
  });

  it('扉があるときは溶暗しない（歩いている canvas をそのまま持ち上げる）', () => {
    // 以前は歩きの後半を地の色へ溶かしていて「ホワイトアウトしてブツ切れ」と報告された（PR #624）。
    // いまは canvas ごとルーターの上に載せるので、隠すための溶暗そのものが要らない。
    expect(enterPlan(false).fadeMs).toBe(0);
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
    // 奥の書斎が扉板に隠れないところまでは開く（98° では瓶が半分隠れていた）。
    expect(DOOR_ANGLE.open).toBeGreaterThan(Math.PI * 0.55);
    // ただし壁へ倒し切らない。扉が「開いている」と読める角度で止める。
    expect(DOOR_ANGLE.open).toBeLessThan(Math.PI * 0.68);
  });
});

describe('glideView（止まらない歩き）', () => {
  const from = homeEntranceView(ENTRANCE_SP_LAYOUT);

  it('静止から急に動き出さない（助走）', () => {
    const path = walk(from, 3000);
    const first = remaining(path[0]) - remaining(path[3]);
    const later =
      remaining(path[Math.round(GLIDE.rampMs / 16)]) -
      remaining(path[Math.round(GLIDE.rampMs / 16) + 3]);
    // 出だしの 3 コマより、助走が終わった直後の 3 コマの方がよく進む。
    expect(first).toBeLessThan(later);
  });

  it('近づき続けて、追い越さない', () => {
    const path = walk(from, 4000);
    for (let i = 1; i < path.length; i++) {
      expect(remaining(path[i])).toBeLessThanOrEqual(remaining(path[i - 1]) + 1e-9);
    }
    expect(remaining(path[path.length - 1])).toBeGreaterThanOrEqual(0);
  });

  it('助走が終わったら、近づくほど遅くなる（止まる瞬間が無い）', () => {
    // 止まってから別の動きが始まると、そこが「カクッ」になる（PR #624 の実機レビュー）。
    // 残りの距離に比例した速さなので、速度は連続で、0 にはならない。
    const path = walk(from, 4000);
    const start = Math.ceil(GLIDE.rampMs / 16) + 1;
    for (let i = start + 1; i < path.length; i++) {
      const before = remaining(path[i - 2]) - remaining(path[i - 1]);
      const after = remaining(path[i - 1]) - remaining(path[i]);
      expect(after).toBeLessThanOrEqual(before + 1e-9);
      expect(after).toBeGreaterThan(0);
    }
  });

  it('行き先へ移る時刻には、扉の正面まで来ている', () => {
    const plan = enterPlan(false);
    const path = walk(from, plan.totalMs - plan.walkDelayMs);
    const end = path[path.length - 1];
    // 家から見て、目指す先までの半分より手前には残っていない。
    expect(remaining(end)).toBeLessThan(remaining(from) * 0.5);
    expect(looksThroughDoorway(end)).toBe(true);
  });

  it('コマの長さに依らない（同じ経過時間なら同じところ）', () => {
    // 助走のあとは、16ms × 2 と 32ms × 1 が同じ場所に着く。コマ落ちしても跳ばない。
    const t = GLIDE.rampMs + 400;
    const path = walk(from, t);
    const settled = path[path.length - 1];
    const twice = glideView(glideView(settled, t, 16), t + 16, 16);
    const once = glideView(settled, t, 32);
    expect(twice.position.z).toBeCloseTo(once.position.z, 6);
  });
});

describe('歩いて入る軌道', () => {
  it.each([
    ['PC', ENTRANCE_PC_LAYOUT],
    ['SP', ENTRANCE_SP_LAYOUT],
  ])('%s: ずっと壁の手前にいて、後半はずっと開口を覗いている', (_, layout) => {
    // 壁を抜けるところまで歩かせていた頃は、枠や扉板がカメラのすぐ脇を通って画面を
    // 縦に横切り、「書斎に入る直前に柱みたいなのが見える」と報告された（PR #624）。
    const path = walk(homeEntranceView(layout), 5000);
    for (const view of path) expect(view.position.z).toBeGreaterThan(0);
    for (const view of path.slice(Math.round(600 / 16))) {
      expect(looksThroughDoorway(view)).toBe(true);
    }
  });

  it('目指す先は扉の開口の中、壁の手前', () => {
    const { position } = GLIDE.target;
    expect(position.x).toBe(0);
    expect(position.z).toBeGreaterThan(0);
    expect(position.z).toBeLessThan(DOOR.height);
    expect(looksThroughDoorway(GLIDE.target)).toBe(true);
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
        const path = walk(from, 2000);
        expect(looksThroughDoorway(path[path.length - 1])).toBe(true);
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
