import { describe, expect, it } from 'vitest';
import { PC_LAYOUT, SP_LAYOUT, type StudyLayout } from '@/features/shared/study/layout';

const LAYOUTS: StudyLayout[] = [PC_LAYOUT, SP_LAYOUT];

describe('配置表に共通して成り立つこと', () => {
  it.each(LAYOUTS)('$name: 瓶・手帳・棚が天板より上にある', (layout) => {
    // 物が天板を突き抜けていると、線画では「浮いている」ではなく「壊れている」に見える。
    expect(layout.jar.y).toBeGreaterThanOrEqual(layout.deskTop.y);
    expect(layout.desk.y).toBeGreaterThanOrEqual(layout.deskTop.y);
    expect(layout.shelf.position.y).toBeGreaterThanOrEqual(layout.deskTop.y);
  });

  it.each(LAYOUTS)('$name: 床の格子が天板より下にある', (layout) => {
    expect(layout.floorY).toBeLessThan(layout.deskTop.y);
  });

  it.each(LAYOUTS)('$name: 封が瓶より上に浮く', (layout) => {
    expect(layout.seal.y).toBeGreaterThan(layout.jar.y);
  });

  it.each(LAYOUTS)('$name: ボードが壁（天板の奥）にある', (layout) => {
    expect(layout.board.position.z).toBeLessThan(layout.deskTop.zNear);
    expect(layout.board.position.y).toBeGreaterThan(layout.deskTop.y);
  });

  it.each(LAYOUTS)('$name: 瓶と手帳が天板の左右に収まる', (layout) => {
    // 物が天板からはみ出すと「机の上に置いてある」という前提が崩れる。
    expect(Math.abs(layout.jar.x)).toBeLessThanOrEqual(layout.deskTop.halfWidth);
    expect(Math.abs(layout.desk.x)).toBeLessThanOrEqual(layout.deskTop.halfWidth);
  });

  it.each(LAYOUTS)('$name: 天板の手前端が奥端より手前にある', (layout) => {
    expect(layout.deskTop.zNear).toBeGreaterThan(layout.deskTop.zFar);
  });

  it.each(LAYOUTS)('$name: カメラがホーム注視点より手前かつ上にある', (layout) => {
    expect(layout.camera.position.z).toBeGreaterThan(layout.camera.target.z);
    expect(layout.camera.position.y).toBeGreaterThan(layout.camera.target.y);
  });

  it.each(LAYOUTS)('$name: near < far', (layout) => {
    expect(layout.camera.near).toBeGreaterThan(0);
    expect(layout.camera.near).toBeLessThan(layout.camera.far);
  });

  it.each(LAYOUTS)('$name: 遷移先の距離がすべて正', (layout) => {
    expect(layout.viewDistance.jar).toBeGreaterThan(0);
    expect(layout.viewDistance.journal).toBeGreaterThan(0);
    expect(layout.viewDistance.board).toBeGreaterThan(0);
  });

  it.each(LAYOUTS)('$name: 主要ラベルが対応する物の近くに置かれている', (layout) => {
    // アンカーが対象から離れると「何のラベルか」が読めなくなる。
    expect(Math.abs(layout.labelAnchors.jar.x - layout.jar.x)).toBeLessThan(1);
    expect(Math.abs(layout.labelAnchors.board.x - layout.board.position.x)).toBeLessThan(1);
  });
});

describe('PC と SP の構図の違い', () => {
  it('SP はクオータートップ（PC より高く・近く・広角）', () => {
    expect(SP_LAYOUT.camera.fov).toBeGreaterThan(PC_LAYOUT.camera.fov);
    expect(SP_LAYOUT.camera.position.y).toBeGreaterThan(PC_LAYOUT.camera.position.y);
    expect(SP_LAYOUT.camera.position.z).toBeLessThan(PC_LAYOUT.camera.position.z);
  });

  it('SP は注視点を絵の中心より下に置く（全体を上に寄せて下端に余白を残す）', () => {
    expect(SP_LAYOUT.camera.target.y).toBeLessThan(0);
  });

  it('SP は物を x ではなく z に散らす', () => {
    // 縦画面は横に狭い。横の散らばりが PC より小さく、奥行きの差が残っていること。
    const pcSpreadX = Math.abs(PC_LAYOUT.jar.x - PC_LAYOUT.desk.x);
    const spSpreadX = Math.abs(SP_LAYOUT.jar.x - SP_LAYOUT.desk.x);
    expect(spSpreadX).toBeLessThan(pcSpreadX);

    const spSpreadZ = Math.abs(SP_LAYOUT.jar.z - SP_LAYOUT.desk.z);
    expect(spSpreadZ).toBeGreaterThan(1);
  });

  it('SP の天板は PC より狭い', () => {
    expect(SP_LAYOUT.deskTop.halfWidth).toBeLessThan(PC_LAYOUT.deskTop.halfWidth);
  });

  it('SP はパララックスを持たない', () => {
    expect(SP_LAYOUT.parallax).toBeNull();
    expect(PC_LAYOUT.parallax).not.toBeNull();
  });

  it('SP は棚を前傾させ、PC は倒さない', () => {
    expect(SP_LAYOUT.shelf.tiltX).toBeLessThan(0);
    expect(PC_LAYOUT.shelf.tiltX).toBe(0);
  });

  it('SP のペンは積みの左手前（右だと画面外に出る）', () => {
    expect(SP_LAYOUT.pen.x).toBeLessThan(0);
    expect(PC_LAYOUT.pen.x).toBeGreaterThan(0);
  });

  it('SP だけが棚のラベルとピルのオフセットを持つ', () => {
    expect(SP_LAYOUT.labelAnchors.archive).not.toBeNull();
    expect(SP_LAYOUT.pillOffsets).not.toBeNull();
    expect(PC_LAYOUT.labelAnchors.archive).toBeNull();
    expect(PC_LAYOUT.pillOffsets).toBeNull();
  });

  it('SP の JOURNAL ラベルは積みの右脇に逃がす（表紙に文字が乗らない）', () => {
    // PC と同じ「机の手前端」に置くと、SP では手帳の表紙の上に重なる。
    expect(SP_LAYOUT.labelAnchors.journal.x).toBeGreaterThan(SP_LAYOUT.desk.x);
    // 左脇はペンがいるので使えない。
    expect(SP_LAYOUT.labelAnchors.journal.x).toBeGreaterThan(SP_LAYOUT.pen.x);
  });

  it('SP はボードと棚を縮める', () => {
    expect(SP_LAYOUT.board.scale).toBeLessThan(1);
    expect(SP_LAYOUT.shelf.scale).toBeLessThan(1);
    expect(PC_LAYOUT.board.scale).toBe(1);
    expect(PC_LAYOUT.shelf.scale).toBe(1);
  });
});
