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
 * 泡の 1 フレームあたりの上昇量。完了時は 0（＝静止）。
 *
 * `random` は 0..1。泡ごとに速さを散らすために呼び出し側が渡す。
 */
export function bubbleSpeed(readiness: number, completed: boolean, random: number): number {
  if (completed) return 0;
  return (0.25 + random * 0.5) * 0.008 * (0.45 + clamp01(readiness) * 1.7);
}

/** 上部のもやを出すか。 */
export function hazeVisible(readiness: number): boolean {
  return clamp01(readiness) > 0.2;
}

export function hazeOpacity(readiness: number): number {
  return 0.25 + clamp01(readiness) * 0.4;
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

/** 漂う言葉のスプライトの高さ。幅は文字幅の実測から決める（全語同幅にしない）。 */
export const WORD_SPRITE_HEIGHT = 0.24;

/** 行間の下限＝スプライト高さの 1.7 倍。これを割ると語が重なって灰色の滲みになる。 */
export const MIN_WORD_GAP = WORD_SPRITE_HEIGHT * 1.7;

/** 黄金角（rad）。方位をこれだけずらすと、少ない語数でも重ならずに散る。 */
const GOLDEN_ANGLE = 2.39996;

/** 言葉が漂う範囲の下端。 */
const WORD_BOTTOM = 0.3;

/** 液面からこれだけ下までに収める（液面を突き抜けさせない）。 */
const WORD_TOP_MARGIN = 0.14;

/**
 * 瓶に入れる言葉の上限。
 *
 * 問いごとの最新キーワードを**全部**浮かべるのが基本だが、描画コストと読みやすさの
 * 両方に天井は要る。問いは生存が最大 3 件、1 発酵あたりのキーワードも数語なので、
 * 実際にここへ当たることはほとんど無い。
 */
export const MAX_WORDS = 18;

/** 語の大きさの下限・上限（基準を 1 とした倍率）。 */
const WORD_SCALE_MIN = 0.72;
const WORD_SCALE_MAX = 1.38;

/**
 * 語ごとの大きさ。
 *
 * **文字列から決める。** `Math.random()` にすると、シーンを組み直すたびに大きさが
 * 変わって画面がちらつく（状態が更新されるたびに組み直すため）。同じ語は常に同じ
 * 大きさになる。
 */
export function wordScale(word: string): number {
  let hash = 0;
  for (let i = 0; i < word.length; i++) {
    hash = (hash * 31 + word.charCodeAt(i)) % 100000;
  }
  return WORD_SCALE_MIN + (hash / 100000) * (WORD_SCALE_MAX - WORD_SCALE_MIN);
}

export interface WordPlacement {
  word: string;
  /** 瓶ローカルの高さ。 */
  y: number;
  /** 方位（rad）。 */
  angle: number;
  /** 基準に対する大きさの倍率。 */
  scale: number;
}

/** 行間は隣り合う 2 語の高さから決める。これを下回らせない。 */
const GAP_RATIO = 1.7;

/** 全部入らないときに詰める下限。ここを割ると隣の語に触れる。 */
const MIN_GAP_RATIO = 1.15;

/**
 * 漂う言葉の配置。
 *
 * 問いごとの最新キーワードを**全部**並べる。語ごとに大きさが違うので、行間は
 * 隣り合う 2 語の高さから決める（一律の間隔だと、大きい語どうしが触れる）。
 * 全部が入らないときは行間を詰めて収める。詰めても入らない語だけは出さない。
 *
 * 液面が低くても**必ず 1 語は出す**。0 語だと「言葉が漂う」という見せ方そのものが消える。
 */
export function placeWords(words: readonly string[], level: number): WordPlacement[] {
  const candidates = words.slice(0, MAX_WORDS);
  if (candidates.length === 0) return [];

  const top = Math.max(WORD_BOTTOM, level - WORD_TOP_MARGIN);
  const available = top - WORD_BOTTOM;

  const heights = candidates.map((word) => WORD_SPRITE_HEIGHT * wordScale(word));

  // 全語を並べるのに要る高さ（行間 GAP_RATIO のとき）。
  const spanAt = (ratio: number, count: number): number => {
    let span = 0;
    for (let i = 1; i < count; i++) span += ((heights[i - 1] + heights[i]) / 2) * ratio;
    return span;
  };

  // まず行間を詰めて全語を収められないか試し、それでも無理なら語数を減らす。
  let count = candidates.length;
  let ratio = GAP_RATIO;
  while (count > 1) {
    if (spanAt(GAP_RATIO, count) <= available) {
      ratio = GAP_RATIO;
      break;
    }
    if (spanAt(MIN_GAP_RATIO, count) <= available) {
      // 詰めれば入る。必要なぶんだけ詰める。
      ratio = available / (spanAt(1, count) || 1);
      break;
    }
    count--;
  }

  const placements: WordPlacement[] = [];
  let y = count === 1 ? WORD_BOTTOM + available / 2 : WORD_BOTTOM;
  for (let i = 0; i < count; i++) {
    if (i > 0) y += ((heights[i - 1] + heights[i]) / 2) * ratio;
    placements.push({
      word: candidates[i],
      y,
      angle: GOLDEN_ANGLE * i,
      scale: wordScale(candidates[i]),
    });
  }
  return placements;
}

/** 言葉の上下の揺れ幅。行間より十分小さくないと隣の語に触れる。 */
export const WORD_BOB_AMPLITUDE = 0.045;

/** 言葉が周回する半径。 */
export const WORD_ORBIT_RADIUS = 0.16;

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

/** 封の浮遊。0.8s 周期の上下と 0.5s 周期の微小回転。 */
export function sealFloat(elapsedSeconds: number): { yOffset: number; rotationZ: number } {
  return {
    yOffset: Math.sin(elapsedSeconds * 0.8) * 0.07,
    rotationZ: Math.sin(elapsedSeconds * 0.5) * 0.04,
  };
}

/** 封が浮く基準の高さ（瓶の位置からの相対）。 */
export const SEAL_BASE_Y = 4.05;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
