/**
 * 瓶の形と、readiness を見た目に落とす計算（`docs/oryzae-study/21-3d-parameters.md`）。
 *
 * three.js の型は使うが、シーングラフは組まない純関数だけを置く。組み立ては `scene.ts`。
 */

import { CatmullRomCurve3, Vector2, Vector3 } from 'three';

/**
 * 母線の制御点 `[radius, y]`。
 *
 * 丸い硝子瓶。胴の最大半径 1.30（y=1.12 付近）、首でわずかにくびれて 0.90（y=2.62）、
 * 口縁で 1.0 に開く。全高 2.94、幅 2.60 — **口が胴より細いテーパーは維持する**
 * （ゴミ箱と読み違えられないための形）。
 */
const JAR_BODY_POINTS: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.35, 0],
  [0.58, 0.02],
  [0.78, 0.09],
  [0.98, 0.24],
  [1.16, 0.48],
  [1.27, 0.78],
  [1.3, 1.12],
  [1.29, 1.45],
  [1.24, 1.75],
  [1.15, 2.02],
  [1.04, 2.24],
  [0.95, 2.44],
  [0.9, 2.62],
  [0.92, 2.78],
  [0.97, 2.88],
];

/** 口縁。ここだけは滑らかに繋がず、稜線として残す（口の形が読めなくなるため）。 */
const JAR_RIM_POINTS: readonly (readonly [number, number])[] = [
  [1.0, 2.9],
  [1.0, 2.94],
  [0.86, 2.94],
  [0, 2.94],
];

/** 瓶の全高（口縁まで）。 */
export const JAR_HEIGHT = 2.94;

/** 制御点 1 区間あたりの標本数。 */
const PROFILE_DIVISIONS = 5;

/**
 * 母線を細かく標本化する。
 *
 * **横線を立てないための設定の 1 つ目**がこれ。滑らかに標本化しておくと隣接面の角度差が
 * 小さくなり、`EdgesGeometry` のしきい値 45°（`EDGES_THRESHOLD_DEG`）と組んで
 * 底・胴・首に横線が 1 本も出ない。粗いままだと胴に緯線が浮く。
 */
export function sampleJarProfile(divisions = PROFILE_DIVISIONS): Vector2[] {
  const control = JAR_BODY_POINTS.map(([r, y]) => new Vector3(r, y, 0));
  const curve = new CatmullRomCurve3(control, false, 'catmullrom', 0.5);
  const count = (JAR_BODY_POINTS.length - 1) * divisions;

  const sampled: Vector2[] = [];
  // 母線は y について単調でなければならない（旋盤形状の定義）。Catmull-Rom は底の
  // [0,0] [0.35,0] のように y が並ぶ区間でわずかに下へ張り出し、底が y=0 を割る。
  // 実害は 0.0003 程度だが、jarRadiusAt が y の単調性を前提に補間しているので、
  // ここで単調に均しておく（下流で「なぜか底の半径がずれる」形で出てくるのを防ぐ）。
  let previousY = Number.NEGATIVE_INFINITY;
  for (let i = 0; i <= count; i++) {
    const point = curve.getPoint(i / count);
    const y = Math.max(point.y, previousY, 0);
    previousY = y;
    // 半径も負にならない。数値誤差で -0 に落ちるのを止める。
    sampled.push(new Vector2(Math.max(0, point.x), y));
  }
  for (const [r, y] of JAR_RIM_POINTS) sampled.push(new Vector2(r, y));
  return sampled;
}

/**
 * `EdgesGeometry` のしきい値（度）。
 *
 * **横線を立てないための設定の 2 つ目**。既定の 15° だと滑らかな胴にも稜線が出る。
 * 45° にすると口縁とコルクの角だけが残る。
 */
export const EDGES_THRESHOLD_DEG = 45;

/** 経線の本数。緯線リングは置かない（横線を出さないため）。 */
export const MERIDIAN_COUNT = 8;

/** 経線の濃さ。 */
export const MERIDIAN_OPACITY = 0.1;

/** 液面の高さ。`readiness` が 0 でも最小の 0.35 は残る（空でも「底に少しある」）。 */
export function liquidLevel(readiness: number): number {
  return 0.35 + clamp01(readiness) * 1.85;
}

/**
 * ある高さでの母線の半径。液面のリングと泡の湧く範囲がこれに従う。
 *
 * 標本の間は線形補間で足りる（標本が十分細かいため）。母線の範囲外は端の値に張り付く。
 */
export function jarRadiusAt(profile: readonly Vector2[], y: number): number {
  if (profile.length === 0) return 0;
  const first = profile[0];
  const last = profile[profile.length - 1];
  if (y <= first.y) return first.x;
  if (y >= last.y) return last.x;

  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1];
    const b = profile[i];
    if (y > b.y) continue;
    const span = b.y - a.y;
    // 口縁のように y が同じ標本が並ぶ区間がある。0 除算を避けて手前の値を採る。
    if (span <= 1e-9) return a.x;
    const t = (y - a.y) / span;
    return a.x + (b.x - a.x) * t;
  }
  return last.x;
}

/** 泡の数。完了したら泡は止まり、最小の 4 つだけが残る。 */
export function bubbleCount(readiness: number, completed: boolean): number {
  if (completed) return 4;
  return Math.round(4 + clamp01(readiness) * 26);
}

/**
 * 完了した瓶の泡の速さ（readiness 換算）。
 *
 * **仕様と原案は「完了時 0＝静止」だが、そこだけ変えている。** 止めきると、
 * 手紙が届いている瓶（＝いちばん見る状態）が壊れているように見えるため。
 * 「静けさ」は泡の数（30 → 4）が担っているので、ゆっくり上がっても発酵中との
 * 区別は付く。戻すならここを 0 にすればよい。
 */
const COMPLETED_DRIFT = 0.12;

/**
 * 泡の 1 フレームあたりの上昇量。
 *
 * `random` は 0..1。泡ごとに速さを散らすために呼び出し側が渡す。
 */
export function bubbleSpeed(readiness: number, completed: boolean, random: number): number {
  const scale = completed ? COMPLETED_DRIFT : 0.45 + clamp01(readiness) * 1.7;
  return (0.25 + random * 0.5) * 0.008 * scale;
}

/** 上部のもやを出すか。 */
export function hazeVisible(readiness: number): boolean {
  return clamp01(readiness) > 0.2;
}

/**
 * もやの濃さ。
 *
 * **薄めに振ってある。** 0.25..0.65 だったころ、引きで見たときに瓶の中身が
 * 「濃い水が入っている」ように見えると報告された（実機レビュー）。この部屋の絵は
 * 線画で、面を濃く塗るのはここだけ。溜まっている感じは液面のリングと泡が言うので、
 * もやは気配の側に置く。
 */
export function hazeOpacity(readiness: number): number {
  return 0.16 + clamp01(readiness) * 0.24;
}

/** もやの高さ。液面より上に置くが、口から溢れさせない。 */
export function hazeY(level: number): number {
  return Math.min(2.6, level + 0.8);
}

/**
 * 輪郭の呼吸。4s 周期で濃さが揺れる。
 *
 * `readiness` が 0 のときは揺れない（＝静かな瓶）。`phase` は 0..1 の周期内位置。
 */
export function outlineOpacity(readiness: number, phase: number): number {
  const wave = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
  return 1 - 0.35 * clamp01(readiness) * wave;
}

export interface SilhouettePoint {
  /** 瓶ローカルの方位（rad）。 */
  angle: number;
  /** 瓶ローカルの高さ。 */
  y: number;
  /** その高さの母線半径。 */
  radius: number;
}

/**
 * カメラから見た**真の輪郭**を解く。
 *
 * 旋盤形状は側面に稜線を持たないので `EdgesGeometry` では輪郭線が出ない。かといって
 * 母線とその鏡像をカメラ方位へ向ける近似（`rotation.y = atan2(-dx, -dz)`）では、
 * **胴の膨らみの内側に入る下半分の輪郭が消える**（見えている輪郭は母線平面上に無い）。
 * 上下で線の濃さが違って見えるのはこれが原因だった。
 *
 * 母線の標本 `(r, y)` とその 2D 法線 `(n_r, n_y)` について、カメラの水平距離 `A`・
 * 方位 `alpha`・高さ `cameraY`（いずれも瓶ローカル）を使うと、その高さの輪郭点は
 *
 *     cos(phi - alpha) = (n_r*r + n_y*(y - cameraY)) / (n_r*A)
 *
 * を満たす方位 `phi = alpha ± acos(...)` の 2 点。右枝を上から下へ、左枝を下から上へ
 * 繋いで一周させる。右辺が ±1 を外れる高さ（＝そのリングに輪郭が無い）では枝が切れるので、
 * **解が残る最下段のリングを近側の弧で閉じる**。
 */
export function solveJarSilhouette(
  profile: readonly Vector2[],
  camera: { horizontalDistance: number; azimuth: number; y: number },
  closingArcSegments = 15,
): SilhouettePoint[] {
  const right: SilhouettePoint[] = [];
  const left: SilhouettePoint[] = [];

  for (let i = 0; i < profile.length; i++) {
    const point = profile[i];
    // 半径 0 のリング（底の中心と口の中心）に輪郭は無い。
    if (point.x <= 1e-6) continue;

    const normal = profileNormal(profile, i);
    const denominator = normal.x * camera.horizontalDistance;
    if (Math.abs(denominator) <= 1e-9) continue;

    const cosine = (normal.x * point.x + normal.y * (point.y - camera.y)) / denominator;
    if (cosine < -1 || cosine > 1) continue;

    const delta = Math.acos(cosine);
    right.push({ angle: camera.azimuth + delta, y: point.y, radius: point.x });
    left.push({ angle: camera.azimuth - delta, y: point.y, radius: point.x });
  }

  if (right.length === 0) return [];

  // 右枝を上から下へ、左枝を下から上へ。
  const descending = [...right].sort((a, b) => b.y - a.y);
  const ascending = [...left].sort((a, b) => a.y - b.y);

  const loop: SilhouettePoint[] = [...descending];
  // 解が残る最下段を近側の弧で閉じる。ここを繋がないと底で線が切れて見える。
  const bottomRight = descending[descending.length - 1];
  const bottomLeft = ascending[0];
  loop.push(...arcBetween(bottomRight, bottomLeft, closingArcSegments));
  loop.push(...ascending);
  return loop;
}

/**
 * 母線上の点の 2D 法線。前後の標本の差分から作る。
 *
 * 端では片側の差分に落とす（存在しない隣を参照して NaN にしない）。
 */
function profileNormal(profile: readonly Vector2[], index: number): Vector2 {
  const previous = profile[Math.max(0, index - 1)];
  const next = profile[Math.min(profile.length - 1, index + 1)];
  const tangent = new Vector2(next.x - previous.x, next.y - previous.y);
  const length = tangent.length();
  if (length <= 1e-9) return new Vector2(1, 0);
  // 接線を 90° 回すと外向き法線。
  return new Vector2(tangent.y / length, -tangent.x / length);
}

/** 2 点の間を近側の弧で埋める（角度の差が π を超えないほうを通る）。 */
function arcBetween(
  from: SilhouettePoint,
  to: SilhouettePoint,
  segments: number,
): SilhouettePoint[] {
  let delta = to.angle - from.angle;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;

  const points: SilhouettePoint[] = [];
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    points.push({
      angle: from.angle + delta * t,
      y: from.y + (to.y - from.y) * t,
      radius: from.radius + (to.radius - from.radius) * t,
    });
  }
  return points;
}

/**
 * 輪郭線の頂点バッファに必要な数。
 *
 * 毎フレーム解き直すので、確保は一度きりにして `setDrawRange` で使う分だけ描く。
 */
export function silhouetteBufferSize(profileLength: number, closingArcSegments = 15): number {
  return profileLength * 2 + closingArcSegments + 2;
}

/** コルクの寸法（21-3d-parameters.md）。塗りはブランドのクリームで、テラコッタは使わない。 */
export const CORK = {
  radiusTop: 0.83,
  radiusBottom: 0.74,
  height: 0.38,
  segments: 44,
  /** 口縁 2.94 に少し沈む。 */
  y: 2.99,
  /** 側面の短い縦のかすれ（木口を示唆する）。 */
  grainCount: 6,
  grainOpacity: 0.18,
} as const;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
