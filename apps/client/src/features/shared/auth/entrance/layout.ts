/**
 * 書斎の扉（ログイン・登録・認証の画面）の配置表。単位は three.js の world unit。
 *
 * 書斎の配置表（`features/shared/study/layout.ts`）と同じ流儀で、**PC と SP は同じ扉を
 * 別の構図で見るだけ**。端末との対応づけは `features/pc/auth` と `features/sp/auth` が持ち、
 * ここは端末を判定しない。
 *
 * 床は y = 0、扉のある壁は z = 0 の面。手前（z > 0）が廊下、奥（z < 0）が書斎。
 */

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface EntranceLayout {
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
  /** マウス位置に応じた視点の揺れ。SP は無し（書斎と同じ）。 */
  parallax: { x: number; y: number; lerp: number } | null;
  /**
   * 書類（フォーム）の置き方。
   *
   * - `side`: 扉の右に紙を 1 枚立てる。扉と紙が横に並ぶ
   * - `sheet`: 下から紙を敷く。扉は上の窓に残り、紙はキーボードと一緒にスクロールする
   */
  panel: 'side' | 'sheet';
}

function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export const ENTRANCE_PC_LAYOUT: EntranceLayout = {
  name: 'pc',
  camera: {
    fov: 45,
    // 扉の前に立った距離。扉が画面の高さの 7 割を占め、足元の敷物と床が少し見える。
    // 扉を画面の左 1/3 に置くのは**カメラを右へ振って**行う — 扉は壁の真ん中にあり、
    // 奥の書斎へ真っすぐ歩いて入る軸（x = 0）を崩さないため。
    position: vec3(1.5, 2.9, 8.4),
    target: vec3(1.5, 2.25, 0),
    near: 0.1,
    far: 100,
  },
  parallax: { x: 0.55, y: 0.3, lerp: 0.05 },
  panel: 'side',
};

export const ENTRANCE_SP_LAYOUT: EntranceLayout = {
  name: 'sp',
  camera: {
    // 縦画面は下の 6 割を紙が覆う。扉と敷物を上の窓（画面の上 4 割）に収めるため、
    // 引いて見下ろし、注視点を床より下に置いて扉を画面の上へ持ち上げる。
    fov: 52,
    position: vec3(0, 3.6, 18),
    target: vec3(0, -2.9, 0),
    near: 0.1,
    far: 100,
  },
  parallax: null,
  panel: 'sheet',
};
