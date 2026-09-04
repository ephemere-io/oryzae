/**
 * SP の瓶で、問いの円が壜のまわりを回るための計算（純関数）。
 *
 * 横軸まわりに回すのではなく、**縦軸まわりに回して横楕円に射影する**。画面が縦長なので、
 * 円が上下に散ると壜と重なって読めなくなる。左右に流れるほうが縦の余白を食わない。
 */

/** 何も触っていないときの回り方（rad/秒）。ゆっくり流れ続ける。 */
export const IDLE_SPIN = 0.22;

/** 指で回せる上限（rad/秒）。速すぎると問いが読めない。 */
export const MAX_SPIN = 6;

/** 指を離したあと、既定の速さへ戻るまでの減衰（1 秒あたりに残る割合）。 */
const FRICTION_PER_SECOND = 0.12;

export interface OrbitSlot {
  /** 中心からの左右のずれ（-1..1）。軌道の半径に掛けて使う。 */
  x: number;
  /** 奥行き（-1 が最も奥、1 が最も手前）。 */
  depth: number;
  /** 手前ほど大きい。 */
  scale: number;
  /** 手前ほど濃い。 */
  opacity: number;
  /** 重なり順。手前ほど大きい。 */
  z: number;
}

/** 奥の円をどこまで小さく・薄くするか。 */
const MIN_SCALE = 0.52;
const MIN_OPACITY = 0.3;

/**
 * i 番目の問いの位置。
 *
 * `angle` は全体の回転（rad）。円は等間隔に並ぶ。
 */
export function orbitSlot(index: number, count: number, angle: number): OrbitSlot {
  if (count <= 0) return { x: 0, depth: 1, scale: 1, opacity: 1, z: 1000 };

  const theta = angle + (index / count) * Math.PI * 2;
  const x = Math.sin(theta);
  const depth = Math.cos(theta);
  // depth を 0..1 に均してから大きさと濃さに写す。
  const front = (depth + 1) / 2;

  return {
    x,
    depth,
    scale: MIN_SCALE + (1 - MIN_SCALE) * front,
    opacity: MIN_OPACITY + (1 - MIN_OPACITY) * front,
    // 手前（depth 1）が最前面。整数にして CSS の z-index に渡せるようにする。
    z: Math.round(front * 1000),
  };
}

/**
 * 指を離したあとの減速。
 *
 * 0 まで落とさず **既定の速さ（IDLE_SPIN）へ戻す**。止めてしまうと、触るまで動かない
 * 置物に見える。
 */
export function decaySpin(velocity: number, deltaSeconds: number): number {
  if (!Number.isFinite(velocity) || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
    return velocity;
  }
  const keep = FRICTION_PER_SECOND ** deltaSeconds;
  return IDLE_SPIN + (velocity - IDLE_SPIN) * keep;
}

/**
 * 指の移動量を角速度の増分にする。
 *
 * 画面の幅で割るので、端末の大きさが変わっても「画面を横切る＝一周ぶん」という
 * 手応えが揃う。
 */
export function dragToSpin(deltaPx: number, viewportWidth: number): number {
  if (!Number.isFinite(deltaPx) || viewportWidth <= 0) return 0;
  return (deltaPx / viewportWidth) * Math.PI * 2;
}

/** 角速度を上限に収める。 */
export function clampSpin(velocity: number): number {
  if (!Number.isFinite(velocity)) return IDLE_SPIN;
  if (velocity > MAX_SPIN) return MAX_SPIN;
  if (velocity < -MAX_SPIN) return -MAX_SPIN;
  return velocity;
}

/**
 * いちばん手前に来ている問いの番号。
 *
 * 何も選ばずに詳細を開くときの既定（正面の問いを開く）に使う。
 */
export function frontIndex(count: number, angle: number): number {
  if (count <= 0) return -1;
  let best = 0;
  let bestDepth = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < count; i++) {
    const { depth } = orbitSlot(i, count, angle);
    if (depth > bestDepth) {
      bestDepth = depth;
      best = i;
    }
  }
  return best;
}
