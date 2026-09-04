/**
 * 書斎の配置表（`docs/oryzae-study/21-3d-parameters.md`）。単位は three.js の world unit。
 *
 * PC と SP は**同じ物を別座標に置いた同じシーン**であり、構造は変わらない。だから
 * シーン側には `device` ではなく `StudyLayout` を渡す。`features/shared` の中で端末を
 * 分岐しないという規約（dep-cruise の shared-no-device-detection）に沿わせるためでもあり、
 * 「PC/SP のどちらでもない第3の構図」を後から足せるようにするためでもある。
 *
 * 端末と配置の対応づけは `features/pc/study` と `features/sp/study` が持つ。
 */

import { VIEW_DISTANCE } from './constants';

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** 机の天板が占める範囲。 */
interface DeskLayout {
  /** 天板の高さ。 */
  y: number;
  /** 天板の左右端。 */
  halfWidth: number;
  /** 天板の手前端・奥端。 */
  zNear: number;
  zFar: number;
}

export interface StudyLayout {
  /** どの構図か（ログとテストの識別用。分岐条件に使わない）。 */
  name: 'pc' | 'sp';
  camera: {
    fov: number;
    /** ホーム位置。 */
    position: Vec3;
    /** ホーム注視点。 */
    target: Vec3;
    near: number;
    far: number;
  };
  /** マウス位置に応じた視点の揺れ。SP は無し。 */
  parallax: { x: number; y: number; lerp: number } | null;
  jar: Vec3;
  /** 封は瓶の口の上に浮く。 */
  seal: Vec3;
  board: { position: Vec3; scale: number };
  /** 机に積む手帳の基準位置。 */
  desk: Vec3;
  /** ペンの位置（机ローカル）。 */
  pen: Vec3;
  shelf: { position: Vec3; scale: number /** SP は書見台のように前傾させる。 */; tiltX: number };
  deskTop: DeskLayout;
  /** 床の格子の高さ。 */
  floorY: number;
  /** 遷移先へ寄るときの距離。 */
  viewDistance: { jar: number; journal: number; board: number };
  /** 対象ラベルの world アンカー。 */
  labelAnchors: { jar: Vec3; journal: Vec3; board: Vec3; archive: Vec3 | null };
  /** SP のピルだけが使う画面座標オフセット（px）。PC は null。 */
  pillOffsets: { jar: Vec2; journal: Vec2; board: Vec2; archive: Vec2 } | null;
}

interface Vec2 {
  x: number;
  y: number;
}

function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

const PC_SHELF = vec3(4.9, -1.2, -3.2);
const SP_SHELF = vec3(2.0, -1.2, -2.6);
const SP_SHELF_SCALE = 0.72;
const SP_DESK = vec3(0.95, -1, 2.7);

export const PC_LAYOUT: StudyLayout = {
  name: 'pc',
  camera: {
    fov: 45,
    position: vec3(0, 4, 12),
    target: vec3(0, 0, 0),
    near: 0.1,
    far: 100,
  },
  parallax: { x: 0.55, y: 0.3, lerp: 0.05 },
  jar: vec3(-4.2, -1.2, 1),
  seal: vec3(-4.2, 2.85, 1.15),
  board: { position: vec3(0.9, 2.5, -4), scale: 1 },
  desk: vec3(3, -1, 2),
  pen: vec3(2.55, -0.15, -0.1),
  shelf: { position: PC_SHELF, scale: 1, tiltX: 0 },
  deskTop: { y: -1.2, halfWidth: 6.6, zNear: 4.3, zFar: -4.6 },
  floorY: -2.9,
  viewDistance: VIEW_DISTANCE.pc,
  labelAnchors: {
    jar: vec3(-4.2, -1.14, 2.7),
    journal: vec3(3, -1.14, 4.12),
    board: vec3(0.9, -0.28, -4.05),
    // PC では棚のラベルを出さない（ホバーで背表紙のツールチップが出るため）。
    archive: null,
  },
  pillOffsets: null,
};

export const SP_LAYOUT: StudyLayout = {
  name: 'sp',
  camera: {
    // 縦画面は横に狭い。真上からでは壁のボードが表現できないので、机の面と壁の
    // 両方が入るクオータートップ（仰角およそ 52°）に振る。
    fov: 58,
    position: vec3(0, 10.6, 7.8),
    // 注視点を絵の中心より下に置くと全体が上に寄り、下端に余白が残る。
    target: vec3(0, -0.35, -0.7),
    near: 0.1,
    far: 100,
  },
  parallax: null,
  // 縦画面の横方向の視野は `aspect × 縦の視野` で決まり、390×844 では縦の 46% しか
  // 横に使えない。物の並びを x ではなく z（奥行き）に散らす。クオータートップでは
  // 奥行きの差が画面の上下差になるため、ボードが上・瓶が中・手帳が下に積まれる。
  jar: vec3(-1.15, -1.2, -0.2),
  seal: vec3(-1.15, 2.85, -0.05),
  board: { position: vec3(0, 2.7, -4.2), scale: 0.68 },
  desk: SP_DESK,
  // ペンは積みの左手前。右に置くと画面外に出る。
  pen: vec3(-1.9, -0.15, 1.2),
  // 棚を前傾させると背文字が上を向き、そのまま行き先の予告になる。
  shelf: { position: SP_SHELF, scale: SP_SHELF_SCALE, tiltX: -0.42 },
  deskTop: { y: -1.2, halfWidth: 3.4, zNear: 4.0, zFar: -4.7 },
  floorY: -2.9,
  viewDistance: VIEW_DISTANCE.sp,
  labelAnchors: {
    // SP は机の手前に余白が無く、PC と同じ「手前端」に置くと手帳の表紙に文字が乗る。
    // 積みの右脇（空いている机の面）へ逃がす。左脇はペンがいる。
    jar: vec3(-1.15, -1.14, 1.25),
    journal: vec3(SP_DESK.x + 2.1, -1.14, SP_DESK.z + 1.1),
    // **板のすぐ下に置く。** PC と同じ「机の高さ」（y ≈ -0.28）に置くと、
    // クオータートップでは y の差がそのまま画面の下方向に伸び、ピルが板ではなく
    // 瓶の上に乗る（実機で確認）。俯瞰では「板の直下」を板の座標系で取る必要がある。
    board: vec3(0, 1.5, -4.0),
    archive: vec3(SP_SHELF.x, SP_SHELF.y + 2.1 * SP_SHELF_SCALE, SP_SHELF.z),
  },
  pillOffsets: {
    jar: { x: -28, y: 26 },
    journal: { x: 0, y: 22 },
    board: { x: -92, y: 40 },
    archive: { x: 10, y: -16 },
  },
};
