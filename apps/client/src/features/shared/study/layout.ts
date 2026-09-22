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
  /**
   * 天板の左右端。**左右で別に持つ。**
   *
   * 中心からの半幅ひとつにしていたころ、右へ余白を足すと左へも同じだけ伸び、
   * 「特に左側が広い」と報告された。物は左右対称に置かれていない（瓶が左、積みと棚が
   * 右）ので、板の余白も対称である必要が無い。
   */
  xLeft: number;
  xRight: number;
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
    /**
     * 絵のいちばん上（壁のボードの上辺の中央）。
     *
     * ホームの構図で**この点が画面の上端から余白つきで入っている**ことを
     * `camera.test.ts` が見る。上端ぴったりに置いていたころ、少し寄るだけで
     * 「ボードの上側が切れる」と報告された（PR #570、そして今回の実機レビュー）。
     * 以前はこの点を留めるために寄り引きで注視点を持ち上げていたが、「変な軌道」と
     * 言われたのでやめ、寄り引きは「カーソルの下へ」に変えた（`camera.ts`）。
     */
    frameTop: Vec3;
    near: number;
    far: number;
  };
  /** マウス位置に応じた視点の揺れ。SP は無し。 */
  parallax: { x: number; y: number; lerp: number } | null;
  jar: Vec3;
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
  labelAnchors: {
    jar: Vec3;
    journal: Vec3;
    board: Vec3;
    archive: Vec3 | null;
    /** 鉛筆の「NEW」。PC だけ（SP は ENTRIES のピルがそのまま新規執筆になる）。 */
    pen: Vec3 | null;
  };
  /** SP のピルだけが使う画面座標オフセット（px）。PC は null。 */
  pillOffsets: { jar: Vec2; journal: Vec2; board: Vec2; archive: Vec2 } | null;
  /**
   * ホームで注視点を動かせる範囲（パンと「カーソルの下へ寄る」の両方に効く）。
   * 部屋の外へ出られないための箱。天板の幅と、床から板の上辺までの高さで決める。
   */
  focusBounds: { x: [number, number]; y: [number, number]; z: [number, number] };
}

interface Vec2 {
  x: number;
  y: number;
}

function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

/**
 * 棚は積みから離す。4.9 に置いていたころ、俯瞰では手前の積み（x = 3）の右上に棚の
 * 台が重なって「エントリーとアーカイブが被り気味」と報告された。積みを左へ（3 → 1.6）、
 * 棚を右へ（4.9 → 5.8）動かして、画面上で分かれるようにする。
 */
const PC_SHELF = vec3(6.0, -1.2, -4.0);
/** 机の積み。棚とは奥行きで分け（棚は壁際へ）、積みは右のまま手前に置く。 */
const PC_DESK = vec3(2.8, -1, 2.1);
const SP_SHELF = vec3(2.0, -1.2, -2.6);
const SP_SHELF_SCALE = 0.72;
const SP_DESK = vec3(0.95, -1, 2.7);

export const PC_LAYOUT: StudyLayout = {
  name: 'pc',
  camera: {
    fov: 45,
    /**
     * 注視点を少し上（y = 0.45）に置き、少し引く（z = 12.6）。(0, 4, 12) → (0, 0, 0) の
     * ころは板の上辺が画面の上端ぴったりに写っていて、少しでも寄ると切れた
     * （「ボードの上側が切れる」— 実機レビュー）。上辺の上に余白を残す。
     */
    position: vec3(0.6, 4.1, 11.5),
    target: vec3(0.6, 0.45, 0),
    // ボードの上辺の中央（板の中心 y=2.4 ＋ 高さ 5 の半分）。
    frameTop: vec3(1.5, 4.9, -4),
    near: 0.1,
    far: 100,
  },
  parallax: { x: 0.55, y: 0.3, lerp: 0.05 },
  jar: vec3(-3.4, -1.2, 1),
  /**
   * 板は右へ（0.9 → 1.5）。左の壁にメモを貼る場所を空ける（オーナーの依頼）。
   * 少し下げる（2.5 → 2.4）のは、カメラを寄せても上辺の上に余白を残すため。
   */
  board: { position: vec3(1.5, 2.4, -4), scale: 1 },
  desk: PC_DESK,
  pen: vec3(2.55, -0.15, -0.1),
  shelf: { position: PC_SHELF, scale: 1, tiltX: 0 },
  // 右は棚のぶんだけ伸ばし（元 6.6 → 8.6）、左は元の幅に近いところへ戻す。
  // **物の座標は動かさない** — 構図（瓶・積み・棚の位置関係）は設計の一部。
  /**
   * 天板は物の外側にぎりぎり余白を残す幅（「余りすぎ」と報告された。物を寄せて机も詰める）。
   * 左は瓶（-4.0 ± 1.3）、右は棚（6.0 ± 1.4）、手前は積み（z 2.1 + 1.7）が決める。
   */
  deskTop: { y: -1.2, xLeft: -4.9, xRight: 7.6, zNear: 4.1, zFar: -4.7 },
  floorY: -2.9,
  viewDistance: VIEW_DISTANCE.pc,
  labelAnchors: {
    jar: vec3(-3.4, -1.14, 2.7),
    journal: vec3(PC_DESK.x, -1.14, 4.12),
    board: vec3(1.5, -0.28, -4.05),
    /**
     * 棚（過去の手帳）。**当初は出していなかった** — ホバーすれば背表紙の
     * ツールチップが出るから、という理由だった。
     *
     * ところが実機レビューで「過去のエントリーへ辿り着けない、動線が分かりづらい」と
     * 報告された。ホバーは**そこに何かがあると知っている人にしか効かない**。
     * 瓶・手帳・板は名乗っているのに、過去の記録を全部持っている棚だけが黙っていた。
     *
     * 位置は他の 2 つと同じ考え方で、机の面（y ≈ -1.14）の少し手前。
     */
    /**
     * **積みの右へ逃がす。** `PC_SHELF.x` の真下に置いていたころ、俯瞰では棚（奥・高い）
     * の注釈が手前の手帳の積みに重なって出ていた（実機で「アーカイブの文字が 3 冊に
     * 被る」と報告）。奥にある物のラベルは、画面では手前の物の上に落ちてくる。
     * 積み（x は 1.7..4.3）の外側へ出し、**手前へ十分に寄せる**。奥のままだと、俯瞰では
     * 画面の上のほうに投影されて棚の絵と混ざる（「もう少し手前に」と再度報告された）。
     */
    archive: vec3(PC_SHELF.x + 0.4, -1.14, PC_SHELF.z + 2.4),
    /**
     * 鉛筆の真下（画面では鉛筆のすぐ下）。鉛筆は積みの右脇に前後向きで寝ていて、中心は
     * 机ローカル (2.55, -0.15, -0.1) を積みの向き（-0.15 rad）で回した world ≈
     * (deskX + 2.54, -1.15, 2.28)、手前の端は z ≈ 3.2。その少し手前の机の面に置く。
     * 積みの ENTRIES とは 2.4 離れるので重ならない。
     */
    pen: vec3(PC_DESK.x + 2.4, -1.14, 3.7),
  },
  pillOffsets: null,
  focusBounds: { x: [-4.5, 6], y: [-1.2, 4.5], z: [-3, 3] },
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
    // ボードの上辺の中央。SP は板を 0.68 に縮めてあるので、高さの半分も同じ比。
    frameTop: vec3(0, 2.7 + (5 * 0.68) / 2, -4.2),
    near: 0.1,
    far: 100,
  },
  parallax: null,
  // 縦画面の横方向の視野は `aspect × 縦の視野` で決まり、390×844 では縦の 46% しか
  // 横に使えない。物の並びを x ではなく z（奥行き）に散らす。クオータートップでは
  // 奥行きの差が画面の上下差になるため、ボードが上・瓶が中・手帳が下に積まれる。
  jar: vec3(-1.15, -1.2, -0.2),
  board: { position: vec3(0, 2.7, -4.2), scale: 0.68 },
  desk: SP_DESK,
  // ペンは積みの左手前。右に置くと画面外に出る。
  pen: vec3(-1.9, -0.15, 1.2),
  // 棚を前傾させると背文字が上を向き、そのまま行き先の予告になる。
  shelf: { position: SP_SHELF, scale: SP_SHELF_SCALE, tiltX: -0.42 },
  deskTop: { y: -1.2, xLeft: -3.4, xRight: 3.4, zNear: 4.0, zFar: -4.7 },
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
    // SP は ENTRIES のピルがそのまま新規執筆なので、NEW のピルは足さない（同じ行き先が 2 つ並ぶ）。
    pen: null,
  },
  pillOffsets: {
    jar: { x: -28, y: 26 },
    journal: { x: 0, y: 22 },
    board: { x: -92, y: 40 },
    archive: { x: 10, y: -16 },
  },
  focusBounds: { x: [-2.5, 2.5], y: [-1.2, 3.5], z: [-3, 3] },
};
