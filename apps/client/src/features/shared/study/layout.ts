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

import { RENDER_LIMITS, VIEW_DISTANCE } from './constants';

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
     * 寄っても画面の上端から出したくない点（＝絵のいちばん上）。
     *
     * **寄り引きの注視点はここから導く**（`zoomTargetRise`）。等倍のときこの点は
     * 画面の上のほうぎりぎりに写っていて、注視点を据えたまま近づくと**まっさきに
     * 外へ出る** — 実際「ズームインしていくとボードの上が見切れる」と実機レビューで
     * 報告された（PR #570）。この点の画面上の高さが変わらないように注視点を持ち上げる
     * ので、寄るほど視界は上へ動く（利用者が手で上へ引きたくなっていた動きを、
     * 寄り引きそのものに畳んである）。
     *
     * どの層でも「絵の上端」は壁のボードの上辺なので、そこを指す。
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
  /**
   * 机に積む冊数。残りは棚へ。
   *
   * PC は当月＋直近 2 ヶ月。SP は**当月の 1 冊だけ**（積みの 2 段目以降は指で押し分けられない、
   * と実機レビュー。先月以前は全部棚に置く）。
   */
  deskNotebooks: number;
  /**
   * 手帳の**件数ぶんの伸び**の倍率（表紙だけの厚みは変えない）。
   *
   * 厚みは件数で決まる（`notebookThickness`）が、それが**見える**かはカメラの角度で決まる。
   * 見下ろす角度が急なほど側面は短く写り、表紙に対して側面が写る長さは仰角の余接に比例する。
   * PC を基準（1）にし、他の構図は**同じ件数が同じだけ膨らんで見える**比をカメラから導く
   * （`sideVisibility`）。手で決めた値ではないので、カメラを動かせば一緒に変わる。
   */
  notebookGrowth: number;
  /** ペンの位置（机ローカル）。null は置かない（SP。書く入口は ENTRIES のピル）。 */
  pen: Vec3 | null;
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
   * 手帳を開いた先の一覧の見せ方。
   *
   * `paper` は机の上にかぶさる紙（幅 720px、月と問いはチップで一覧できる）。
   * `mobile` は全画面の一覧で、月と問いはドロップダウンに畳む（狭い画面では、
   * 選択肢を並べる場所より本文を読む場所に幅を使う）。構図の一部なのでここに持つ。
   */
  listPresentation: 'paper' | 'mobile';
  /**
   * 書斎の入口（扉のある前室）。
   *
   * **扉は書斎の一部**。認証画面はここにカメラを置き、ログインすると扉をくぐってホームまで
   * 1 本で移動する（`docs/oryzae-study/70-entrance.md`）。以前は扉だけの別シーンを持っていて、
   * 入るときに 2 つのシーンをクロスフェードしていたが、それが「一回切り替わる」正体だった。
   */
  entrance: {
    /** 前室を置く場所（扉の開口の中心・床の高さ）。 */
    room: Vec3;
    /** 認証画面のカメラ。 */
    camera: { position: Vec3; target: Vec3 };
  };
}

interface Vec2 {
  x: number;
  y: number;
}

function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

/**
 * 棚の **world** 位置。
 *
 * 以前は (4.9, −1.2, −3.2) と書いてあったが、棚は机グループ（y 回転 −0.15）の子として
 * `shelf − desk` を回転前の座標で置いていたので、実際の world はこの値だった。scene 側で
 * 机の回転の逆を掛けるようにし、配置表の値をそのまま world にした。**見た目は変えていない。**
 */
const PC_SHELF = vec3(5.66, -1.2, -2.86);
/** world。右端（半幅 1.3 × 0.72、yaw −0.35）が天板の右辺 3.4 の内側に収まる位置。 */
const SP_SHELF = vec3(2.0, -1.2, -2.7);
const SP_SHELF_SCALE = 0.72;
/**
 * 当月の 1 冊の位置。
 *
 * 手前辺（奥行き 3.4 の半分 + 回転ぶんで z ≈ 4.1）が天板の手前端 4.3 に収まり、奥左の角
 * （world ≈ (0.5, ·, 0.3)）が瓶の足元（中心 (−1.4, ·, −0.3)、半径 1.3）に入らない位置。
 * x = 0.95 に置いていたころは角が瓶に食い込んでいた（実機で「本と瓶が重なる」）。
 */
const SP_DESK = vec3(1.5, -1, 2.2);

/**
 * その点を見たとき、縦の面（手帳の側面）が水平の面（表紙）に対してどれだけの長さに写るか。
 * カメラからその点への仰角の余接（水平の距離 ÷ 高さの差）。真横から見れば大きく、真上から見れば 0。
 */
function sideVisibility(camera: Vec3, at: Vec3): number {
  return Math.hypot(camera.x - at.x, camera.z - at.z) / (camera.y - at.y);
}

const PC_CAMERA_POSITION = vec3(0, 4, 12);
const PC_DESK = vec3(3, -1, 2);
const SP_CAMERA_POSITION = vec3(0, 10.6, 7.8);

export const PC_LAYOUT: StudyLayout = {
  name: 'pc',
  camera: {
    fov: 45,
    position: PC_CAMERA_POSITION,
    target: vec3(0, 0, 0),
    // ボードの上辺の中央（板の中心 y=2.5 ＋ 高さ 5 の半分）。
    frameTop: vec3(0.9, 5, -4),
    near: 0.1,
    far: 100,
  },
  parallax: { x: 0.55, y: 0.3, lerp: 0.05 },
  jar: vec3(-4.2, -1.2, 1),
  board: { position: vec3(0.9, 2.5, -4), scale: 1 },
  // 扉は瓶の正面（x = -3）。開口越しに瓶が見え、くぐると机の全体が開ける。
  entrance: {
    room: vec3(-3, -2.9, 14),
    camera: { position: vec3(-1.5, 0, 22.4), target: vec3(-1.5, -0.65, 14) },
  },
  desk: PC_DESK,
  deskNotebooks: RENDER_LIMITS.deskNotebooks,
  // 基準。PC のカメラ（手帳を仰角およそ 26° で見る）で見えている膨らみを、他の構図が揃える。
  notebookGrowth: 1,
  pen: vec3(2.55, -0.15, -0.1),
  shelf: { position: PC_SHELF, scale: 1, tiltX: 0 },
  // 右は棚のぶんだけ伸ばし（元 6.6 → 8.6）、左は元の幅に近いところへ戻す。
  // **物の座標は動かさない** — 構図（瓶・積み・棚の位置関係）は設計の一部。
  deskTop: { y: -1.2, xLeft: -6.2, xRight: 8.6, zNear: 4.3, zFar: -4.6 },
  floorY: -2.9,
  viewDistance: VIEW_DISTANCE.pc,
  labelAnchors: {
    jar: vec3(-4.2, -1.14, 2.7),
    journal: vec3(3, -1.14, 4.12),
    board: vec3(0.9, -0.28, -4.05),
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
    // 数字で持つ。棚の world 位置（PC_SHELF）を直したときに、ここは動かしていない。
    archive: vec3(6.6, -1.14, -1.2),
    /**
     * 鉛筆の真下（画面では鉛筆のすぐ下）。鉛筆は積みの右脇に前後向きで寝ていて、中心は
     * 机ローカル (2.55, -0.15, -0.1) を積みの向き（-0.15 rad）で回した world ≈ (5.54, -1.15,
     * 2.28)、手前の端は z ≈ 3.2。その少し手前の机の面に置く。積みの ENTRIES（x = 3）とは
     * 2.4 離れるので重ならない。
     */
    pen: vec3(5.4, -1.14, 3.7),
  },
  pillOffsets: null,
  listPresentation: 'paper',
};

export const SP_LAYOUT: StudyLayout = {
  name: 'sp',
  camera: {
    // 縦画面は横に狭い。真上からでは壁のボードが表現できないので、机の面と壁の
    // 両方が入るクオータートップ（仰角およそ 52°）に振る。
    fov: 58,
    position: SP_CAMERA_POSITION,
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
  jar: vec3(-1.4, -1.2, -0.3),
  board: { position: vec3(0, 2.7, -4.2), scale: 0.68 },
  // 縦画面は扉を右斜め前から見る（正面だと厚みも隙間も写らず、壁の長方形に読める）。
  // 画角が広い（fov 58）ぶん、扉へは PC より寄る。
  entrance: {
    room: vec3(-3, -2.9, 14),
    camera: { position: vec3(-0.9, -0.2, 20.9), target: vec3(-3.4, -0.35, 14) },
  },
  desk: SP_DESK,
  // 机は当月の 1 冊だけ。積みの 2 段目以降は指で押し分けられない。先月以前は全部棚へ。
  deskNotebooks: 1,
  // SP は手帳を仰角およそ 63° で見下ろすので、同じ厚みでも側面は PC の 1/4 ほどにしか写らず、
  // 何十件書いても手帳が平たいままだった（実機レビュー #616: 「エントリーが複数あっても
  // 平ぺったい。PC と合わせて膨らみを」）。PC と同じだけ膨らんで見える比（およそ 4.2）。
  notebookGrowth:
    sideVisibility(PC_CAMERA_POSITION, PC_DESK) / sideVisibility(SP_CAMERA_POSITION, SP_DESK),
  // 鉛筆は置かない。1 冊だけなら「書く」は手帳そのものと ENTRIES のピルで足り、鉛筆は役割を失う。
  pen: null,
  // 棚を前傾させると背文字が上を向き、そのまま行き先の予告になる。
  shelf: { position: SP_SHELF, scale: SP_SHELF_SCALE, tiltX: -0.42 },
  deskTop: { y: -1.2, xLeft: -3.4, xRight: 3.4, zNear: 4.3, zFar: -4.7 },
  floorY: -2.9,
  viewDistance: VIEW_DISTANCE.sp,
  labelAnchors: {
    // 瓶の手前の机の面。
    jar: vec3(-1.4, -1.14, 1.15),
    // 手帳の手前辺のすぐ先。1 冊だけなので表紙に文字が乗らない。
    journal: vec3(SP_DESK.x, -1.14, SP_DESK.z + 1.9),
    // **板のすぐ下に置く。** PC と同じ「机の高さ」（y ≈ -0.28）に置くと、
    // クオータートップでは y の差がそのまま画面の下方向に伸び、ピルが板ではなく
    // 瓶の上に乗る（実機で確認）。俯瞰では「板の直下」を板の座標系で取る必要がある。
    board: vec3(0, 1.5, -4.0),
    // 棚の**手前**の机の面。棚の上に置いていたころは前傾した背表紙の頭に乗っていた
    // （実機で「ARCHIVE の文字が本に被る」）。
    archive: vec3(SP_SHELF.x, -1.14, SP_SHELF.z + 1.35),
    // SP は ENTRIES のピルがそのまま新規執筆なので、NEW のピルは足さない（同じ行き先が 2 つ並ぶ）。
    pen: null,
  },
  pillOffsets: {
    jar: { x: 0, y: 24 },
    journal: { x: 0, y: 22 },
    board: { x: -92, y: 40 },
    archive: { x: 0, y: 10 },
  },
  listPresentation: 'mobile',
};
