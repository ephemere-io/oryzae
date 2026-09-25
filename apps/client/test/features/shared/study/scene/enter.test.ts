import { describe, expect, it } from 'vitest';
import { PC_LAYOUT, SP_LAYOUT, type StudyLayout } from '@/features/shared/study/layout';
import type { CameraView } from '@/features/shared/study/scene/camera';
import { entranceView, homeView } from '@/features/shared/study/scene/camera';
import {
  DOOR_ANGLE,
  doorAngleWhileEntering,
  ENTER_TIMING,
  enterView,
  isInDoorway,
  isInside,
} from '@/features/shared/study/scene/enter';
import { DOOR } from '@/features/shared/study/scene/entrance-room';

const LAYOUTS: [string, StudyLayout][] = [
  ['PC', PC_LAYOUT],
  ['SP', SP_LAYOUT],
];

/** 歩きを 1 コマずつ進めて、その道のりを返す（`scene.ts` の tick と同じ回し方）。 */
function walk(layout: StudyLayout, stepMs = 16): CameraView[] {
  const path: CameraView[] = [];
  for (let t = 0; t <= ENTER_TIMING.walkMs; t += stepMs) path.push(enterView(layout, t));
  path.push(enterView(layout, ENTER_TIMING.walkMs));
  return path;
}

function distance(a: CameraView['position'], b: CameraView['position']): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

describe('doorAngleWhileEntering', () => {
  it('押し始めた開きから始まり、開き切って止まる', () => {
    expect(doorAngleWhileEntering(DOOR_ANGLE.waiting, 0)).toBeCloseTo(DOOR_ANGLE.waiting);
    expect(doorAngleWhileEntering(DOOR_ANGLE.waiting, ENTER_TIMING.doorMs)).toBeCloseTo(
      DOOR_ANGLE.open,
    );
    expect(doorAngleWhileEntering(DOOR_ANGLE.waiting, ENTER_TIMING.doorMs * 3)).toBeCloseTo(
      DOOR_ANGLE.open,
    );
  });

  it('途中で閉じる向きに戻らない', () => {
    let previous = doorAngleWhileEntering(DOOR_ANGLE.rest, 0);
    for (let t = 10; t <= ENTER_TIMING.doorMs; t += 10) {
      const angle = doorAngleWhileEntering(DOOR_ANGLE.rest, t);
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

describe('enterView（扉の前からホームまで 1 本で）', () => {
  it.each(LAYOUTS)('%s: 扉の前から始まり、ホームで終わる', (_, layout) => {
    const start = enterView(layout, 0);
    const end = enterView(layout, ENTER_TIMING.walkMs);
    expect(distance(start.position, entranceView(layout).position)).toBeLessThan(1e-9);
    expect(distance(end.position, homeView(layout).position)).toBeLessThan(1e-9);
    expect(distance(end.target, homeView(layout).target)).toBeLessThan(1e-9);
  });

  it.each(LAYOUTS)('%s: 壁ではなく開口を通る', (_, layout) => {
    // 直線で結ぶと、その線は開口ではないところで壁を貫く。壁を突き抜けるあいだ壁の線が
    // 画面を縦に横切り、「書斎に入る直前に柱みたいなのが見える」という見え方になる（PR #624）。
    const wallZ = layout.entrance.room.z;
    const crossings = walk(layout).filter((view, index, path) => {
      const previous = path[index - 1];
      return previous !== undefined && previous.position.z > wallZ && view.position.z <= wallZ;
    });
    // 壁の面を跨ぐのは 1 回だけ（行ったり来たりしない）。
    expect(crossings).toHaveLength(1);
    for (const view of crossings) expect(isInDoorway(layout, view.position)).toBe(true);
  });

  it.each(LAYOUTS)('%s: 開口を跨ぐ前後は扉の正面軸の上にいる', (_, layout) => {
    // 正対して入らないと、枠や扉板がカメラの脇をかすめる。
    const wallZ = layout.entrance.room.z;
    const near = walk(layout).filter((view) => Math.abs(view.position.z - wallZ) < 1);
    expect(near.length).toBeGreaterThan(2);
    for (const view of near) {
      expect(Math.abs(view.position.x - layout.entrance.room.x)).toBeLessThan(DOOR.width / 2);
    }
  });

  it.each(LAYOUTS)('%s: 奥へ進み続け、戻らない', (_, layout) => {
    const path = walk(layout);
    for (let i = 1; i < path.length; i++) {
      expect(path[i].position.z).toBeLessThanOrEqual(path[i - 1].position.z + 1e-9);
    }
  });

  it.each(LAYOUTS)('%s: 静止から動き出し、静止して止まる（継ぎ目が無い）', (_, layout) => {
    // 止まってから別の動きが始まると、そこが「カクッ」になる（PR #624 の実機レビュー）。
    const path = walk(layout);
    const step = (i: number) => distance(path[i].position, path[i - 1].position);
    const middle = step(Math.floor(path.length / 2));
    expect(step(1)).toBeLessThan(middle * 0.4);
    expect(step(path.length - 1)).toBeLessThan(middle * 0.4);
  });

  it.each(LAYOUTS)('%s: 途中で床を割らない', (_, layout) => {
    for (const view of walk(layout)) {
      expect(view.position.y).toBeGreaterThan(layout.floorY);
    }
  });

  it('コマの長さに依らない（同じ経過時間なら同じところ）', () => {
    // 経過時間だけで決まるので、コマ落ちしても跳ばない。
    const t = ENTER_TIMING.walkMs * 0.4;
    expect(enterView(PC_LAYOUT, t).position.z).toBeCloseTo(enterView(PC_LAYOUT, t).position.z, 9);
    expect(walk(PC_LAYOUT, 16)[0].position.z).toBeCloseTo(walk(PC_LAYOUT, 33)[0].position.z, 9);
  });
});

describe('isInside', () => {
  it('歩き終わるまでは着いていない', () => {
    expect(isInside(0)).toBe(false);
    expect(isInside(ENTER_TIMING.walkMs - 1)).toBe(false);
    expect(isInside(ENTER_TIMING.walkMs)).toBe(true);
  });
});

describe('isInDoorway', () => {
  it('開口の外（壁）は数えない', () => {
    const room = PC_LAYOUT.entrance.room;
    expect(isInDoorway(PC_LAYOUT, { x: room.x + DOOR.width, y: room.y + 2, z: room.z })).toBe(
      false,
    );
    // 鴨居より上も壁。
    expect(isInDoorway(PC_LAYOUT, { x: room.x, y: room.y + DOOR.height + 1, z: room.z })).toBe(
      false,
    );
  });
});
