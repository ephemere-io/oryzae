/**
 * 書斎の扉のシーンを組み立てて動かす。
 *
 * ログイン・登録の画面の地。**書斎の手前にある 1 枚の扉**で、書斎と同じ線画・同じ紙と墨で
 * 描く（素材は書斎の `createMaterials` をそのまま使う）。入れたら扉を押し開け、敷居を
 * またいで奥へ歩き、地の色に溶ける。溶けた先で書斎が同じ地の色から現れるので、
 * ログインの前後が「別の画面」ではなく 1 つの廊下の続きになる。
 *
 * **React は知らない。** `entrance-canvas.tsx` が `initEntranceScene` を呼び、cleanup で
 * `dispose` する。座標と段取りは `door.ts` / `layout.ts` の純関数が決めていて、ここは
 * それを three.js の物に置き換える仕事しかしない。
 */

import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  LatheGeometry,
  Line,
  type LineBasicMaterial,
  LineSegments,
  type Material,
  Mesh,
  type MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { clamp01, RENDER_LIMITS } from '@/features/shared/study/constants';
import { approach, breathOffset, type CameraView } from '@/features/shared/study/scene/camera';
import {
  CORK,
  EDGES_THRESHOLD_DEG,
  MERIDIAN_COUNT,
  MERIDIAN_OPACITY,
  sampleJarProfile,
} from '@/features/shared/study/scene/jar';
import { createMaterials, type StudyMaterials } from '@/features/shared/study/scene/materials';
import {
  DOOR,
  DOOR_ANGLE,
  DOOR_SETTLE_LERP,
  doorAngleWhileEntering,
  type EnterPlan,
  FRAME,
  GLIDE,
  glideView,
  homeEntranceView,
} from './door';
import { type EntranceLayout, FRAME_SETTLE_LERP } from './layout';
import type { Sprig } from './season';

export interface EntranceSceneOptions {
  container: HTMLElement;
  layout: EntranceLayout;
  reducedMotion: boolean;
  /**
   * 一輪挿しに挿してある枝の姿（`season.ts`）。いまの候（七十二候）から決まる。
   * 部屋の作りは季節で変えない — 変えるのは枝 1 本だけ。
   */
  sprig: Sprig;
  /** 最初の 1 フレームを描き終えたとき（1 度だけ）。地から扉を浮かび上がらせる合図。 */
  onReady?: () => void;
  /**
   * 最初から扉に手を掛けた状態で始めるか（通り道の画面）。
   *
   * `/callback` は別のドメインから戻ってきた直後で、文書ごと作り直しになる。閉じた扉から
   * 描き始めると、さっき手を掛けた扉とは別の場面が始まったように見える（実機レビュー）。
   */
  waiting?: boolean;
}

/**
 * 歩いている最中の canvas を、そのまま持ち出したもの。
 *
 * 画面が入れ替わるあいだ、これをルーターの上に載せておく（`study/handover.ts`）。
 * シーンは動き続けている — 渡すのは写真ではなく、部屋そのもの。
 */
interface EntranceBridge {
  canvas: HTMLCanvasElement;
  /** 引き終わったら呼ぶ。renderer と WebGL のコンテキストを返す。 */
  dispose(): void;
}

export interface EntranceSceneHandle {
  /** 送信中・認証中か。扉が少し大きく開く。 */
  setWaiting(waiting: boolean): void;
  /**
   * 扉を押し開けて奥へ歩き出す。`plan.totalMs` 経ったら resolve する。
   *
   * **歩きはそこで終わらない。** 目指す先へ近づき続ける（`glideView`）。resolve は
   * 「もう扉の正面まで来ているので、下で画面を入れ替えてよい」の合図。呼び出し側は
   * `detach()` で canvas を持ち出し、ルーターの上に載せてから移る。
   */
  enter(plan: EnterPlan): Promise<void>;
  /**
   * 歩いている canvas を持ち出す。**以後、後始末は受け取った側が持つ**（`dispose`）。
   *
   * 持ち出したあとも描き続ける。元の入れ物（認証画面）が外れても止まらない。
   * 2 度目以降と、扉が出ていないときは null。
   */
  detach(): EntranceBridge | null;
  /** 持ち出し済みか。真なら、認証画面の cleanup は dispose を呼ばない。 */
  isDetached(): boolean;
  /**
   * 画面の上から何 px が見えているか（その下は紙が覆っている）。
   *
   * 構図は**見えている窓に対して**組む。窓が縮めば扉は窓の中で小さくなり、窓からは
   * はみ出さない。窓の下の canvas は同じ構図をそのまま下へ延ばして描く（レンズシフト）。
   * 呼ばなければ canvas 全体が窓。
   */
  setFrame(visibleHeight: number): void;
  /** 画面上のポインタ位置（-1..1）。パララックスに使う。 */
  setPointer(x: number, y: number): void;
  clearPointer(): void;
  dispose(): void;
}

/**
 * 待っている間の濃さ（**書斎で見えている濃さに対する比**）。
 *
 * 扉の向こうにあるのは、遠くにある同じ部屋。歩いて近づくと 1.0 ＝ 書斎とまったく同じ濃さに
 * なる（`buildStudyGlimpse` の `reveal`）。待っている間から濃いと、入る前に部屋を見せて
 * しまうので、ここでは「何かがある」くらいに留める。
 */
const GLIMPSE_REST = 0.3;

/**
 * 瓶を置く奥行き。ここを面にして、書斎の配置を縮めて並べる。
 *
 * 瓶の x と机の高さと縮尺は構図ごとに違う（`EntranceLayout.glimpse`）。板と机はそこからの
 * 相対で置く — **書斎での瓶との位置関係をそのまま縮める**ので、どの構図でも同じ部屋に見える。
 */
const GLIMPSE_Z = -6.6;

/**
 * 書斎での、瓶を原点とした物の位置関係（`study/layout.ts` の PC の配置）。
 *
 * 瓶 (-4.2, -1.2, 1) を原点に、板の中心 (0.9, 2.5, -4)、机の天板
 * （x -6.2..8.6、z 4.3..-4.6）を測ったもの。これに `glimpse.scale` を掛けて置く。
 */
const STUDY_RELATIVE = {
  board: { x: 5.1, y: 3.7, z: -5.0, width: 8, height: 5 },
  desk: { x0: -2.0, x1: 12.8, zNear: 3.3, zFar: -5.6 },
  /** 机の上の手帳の積み（書斎の `NOTEBOOK_SIZE` と同じ寸法）。 */
  books: { x: 7.2, z: 1, width: 2.6, depth: 3.4, rotationY: -0.15, thicknesses: [0.4, 0.34, 0.3] },
} as const;

/**
 * 扉まわりの材。**近づくにつれて薄くできる。**
 *
 * 渡す瞬間に扉の枠が画面に残っていると、そこが消えることが「画面の切り替わり」として
 * 読める（PR #624 の実機レビュー「一回切り替わるのを無くすには」）。歩いて近づくほど枠を
 * 薄くしていけば、渡すときに画面にあるのは**扉の向こうの書斎だけ**になり、書斎の canvas と
 * 見比べても差がほとんど残らない。
 *
 * 枠が画面の外へ出るまで歩く手もあるが、そこまで進むには 1.7〜2.7 秒かかり（いまは 1.12 秒）、
 * 待たされる方が悪くなる。消すのは距離ではなく濃さで行う。
 */
interface RoomMaterials extends StudyMaterials {
  /** 1 で元の濃さ、0 で見えなくなる。 */
  fade(ratio: number): void;
  /** clone したぶんだけ捨てる（元の材は共有なので触らない）。 */
  disposeOwn(): void;
}

/** どこまで近づいたら消し切るか（0..1、歩き出しからの詰まり具合）。 */
const ROOM_FADE = { from: 0.25, to: 0.72 } as const;

function createRoomMaterials(base: StudyMaterials): RoomMaterials {
  const owned: { material: Material & { opacity: number }; base: number }[] = [];
  function track<T extends Material & { opacity: number; transparent: boolean }>(
    material: T,
    baseOpacity: number,
  ): T {
    material.transparent = true;
    material.opacity = baseOpacity;
    owned.push({ material, base: baseOpacity });
    return material;
  }
  const faintCache = new Map<number, LineBasicMaterial>();
  return {
    ...base,
    solid: track(base.solid.clone(), 1),
    ink: track(base.ink.clone(), 1),
    gridFaint: track(base.gridFaint.clone(), base.gridFaint.opacity),
    faint(opacity: number): LineBasicMaterial {
      const cached = faintCache.get(opacity);
      if (cached) return cached;
      const material = track(base.faint(opacity).clone(), opacity);
      faintCache.set(opacity, material);
      return material;
    },
    fade(ratio: number): void {
      for (const entry of owned) entry.material.opacity = entry.base * ratio;
    },
    disposeOwn(): void {
      for (const entry of owned) entry.material.dispose();
    },
  };
}

/** 扉の向こうの気配。濃さだけを外から動かせる。 */
interface StudyGlimpse {
  group: Group;
  /** 入っている最中の濃さ。`t` は歩きの進み（0..1）。 */
  reveal(t: number): void;
  dispose(): void;
}

/** 壁の広がり。どの構図でも画面の外まで続く幅と高さ。 */
const WALL = { halfWidth: 18, height: 11 } as const;

/** 床の格子。書斎と同じ 1 unit 刻み。 */
const FLOOR_GRID = { halfWidth: 14, near: 12, far: -16 } as const;

export function initEntranceScene(options: EntranceSceneOptions): EntranceSceneHandle {
  const { container, layout } = options;

  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, RENDER_LIMITS.maxPixelRatio));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(
    layout.camera.fov,
    aspectOf(container),
    layout.camera.near,
    layout.camera.far,
  );

  const materials = createMaterials('light');
  const geometries: BufferGeometry[] = [];
  function own<T extends BufferGeometry>(geometry: T): T {
    geometries.push(geometry);
    return geometry;
  }

  // 扉まわりは、近づくほど薄くできる材で組む（`RoomMaterials`）。書斎の気配は逆に濃くなるので、
  // そちらは元の材のまま（`buildStudyGlimpse` が自前で clone して持つ）。
  const room = createRoomMaterials(materials);
  scene.add(buildFloorGrid(room, own));
  scene.add(buildWall(room, own));
  scene.add(buildFrame(room, own));
  scene.add(buildDoormat(room, own));
  const glimpse = buildStudyGlimpse(materials, own, layout);
  scene.add(glimpse.group);
  scene.add(buildCabinet(room, own, layout, options.sprig));
  const door = buildDoor(room, own);
  scene.add(door);

  // ---- 状態 --------------------------------------------------------------

  const home = homeEntranceView(layout);
  applyView(camera, home);

  const startAngle = options.waiting === true ? DOOR_ANGLE.waiting : DOOR_ANGLE.rest;
  let doorAngle: number = startAngle;
  let doorTarget: number = startAngle;
  door.rotation.y = doorAngle;

  const pointer = { x: 0, y: 0 };
  let pointerInside = false;
  const parallax = { x: 0, y: 0 };

  let entering: {
    plan: EnterPlan;
    startedAt: number;
    fromAngle: number;
    /** いまの view。毎フレーム目指す先へ近づける（`glideView`）。 */
    view: CameraView;
    /** 歩き出した時点の、目指す先までの距離。奥の気配をどこまで濃くしたかの物差し。 */
    startDistance: number;
    lastTickAt: number;
  } | null = null;
  /** canvas を持ち出したか（`detach`）。 */
  let detached = false;

  /** 見えている窓の高さ（px）。null は canvas 全体。目標へ毎フレーム寄せる。 */
  let frameHeight: number | null = null;
  let frameTarget: number | null = null;
  /** canvas の大きさが変わった。窓の高さが同じでも投影を組み直す。 */
  let projectionDirty = true;

  let frame = 0;
  let readyAnnounced = false;
  const startedAt = performance.now();

  // ---- 動かす ------------------------------------------------------------

  function tick(): void {
    frame = requestAnimationFrame(tick);
    const now = performance.now();

    if (entering) {
      const elapsed = now - entering.startedAt;
      door.rotation.y = doorAngleWhileEntering(entering.plan, entering.fromAngle, elapsed);
      const walking = elapsed - entering.plan.walkDelayMs;
      if (walking > 0) {
        entering.view = glideView(entering.view, walking, now - entering.lastTickAt);
      }
      entering.lastTickAt = now;
      applyView(camera, entering.view);
      // 近づくにつれて、奥の書斎が見えてくる。どこまで来たかは残りの距離で測る。
      const remaining = distanceBetween(entering.view.position, GLIDE.target.position);
      const approached = 1 - remaining / entering.startDistance;
      // 扉が消え切るころには、奥の書斎は**書斎と同じ濃さ**になっている。渡した先の canvas と
      // 濃さが違うと、そこで絵が一段はっきりして切り替わりが読める。
      glimpse.reveal(clamp01(approached / ROOM_FADE.to));
      // 同時に、扉まわりは薄れていく。渡す瞬間、画面に残るのは扉の向こうの書斎だけになる。
      room.fade(1 - clamp01((approached - ROOM_FADE.from) / (ROOM_FADE.to - ROOM_FADE.from)));
    } else {
      doorAngle = approach(doorAngle, doorTarget, DOOR_SETTLE_LERP);
      door.rotation.y = doorAngle;
      applyView(camera, restingView(now - startedAt));
    }

    updateFrame();
    renderer.render(scene, camera);

    if (!readyAnnounced) {
      readyAnnounced = true;
      options.onReady?.();
    }
  }

  /** 待っているときの view。書斎のホームと同じく、呼吸とパララックスが乗る。 */
  function restingView(elapsed: number): CameraView {
    const lerp = layout.parallax?.lerp ?? 0;
    const wanted =
      pointerInside && layout.parallax !== null && !options.reducedMotion
        ? { x: pointer.x * layout.parallax.x, y: pointer.y * layout.parallax.y }
        : { x: 0, y: 0 };
    parallax.x += (wanted.x - parallax.x) * lerp;
    parallax.y += (wanted.y - parallax.y) * lerp;
    const breath = options.reducedMotion ? 0 : breathOffset(elapsed);
    return {
      position: {
        x: home.position.x + parallax.x,
        y: home.position.y + parallax.y + breath,
        z: home.position.z,
      },
      target: { ...home.target },
    };
  }

  /**
   * 見えている窓に合わせて投影を組み直す。
   *
   * 縦の画角と縦横比を**窓**のものにし、`setViewOffset` で canvas の残り（紙の下）へ
   * 延ばす。こうすると扉の大きさと位置は窓の高さに対して決まり、紙が伸び縮みしても
   * 扉が紙の下へ潜らない。窓が canvas と同じ高さなら、ふつうの投影に戻す。
   */
  function updateFrame(): void {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;
    const target = Math.min(height, Math.max(1, frameTarget ?? height));
    // 最初の 1 回は寄せずに合わせる。読み込んだ直後に扉が縮んでいく動きを見せない。
    const next = frameHeight === null ? target : approach(frameHeight, target, FRAME_SETTLE_LERP);
    const settled = Math.abs(next - target) < 0.5 ? target : next;
    if (settled === frameHeight && !projectionDirty) return;
    frameHeight = settled;
    projectionDirty = false;
    camera.aspect = width / settled;
    if (settled >= height) {
      camera.clearViewOffset();
    } else {
      camera.setViewOffset(width, settled, 0, 0, width, height);
    }
    camera.updateProjectionMatrix();
  }

  function currentView(): CameraView {
    const target = new Vector3();
    camera.getWorldDirection(target);
    target.multiplyScalar(5).add(camera.position);
    return {
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      target: { x: target.x, y: target.y, z: target.z },
    };
  }

  // ---- 入力 --------------------------------------------------------------

  function setWaiting(waiting: boolean): void {
    doorTarget = waiting ? DOOR_ANGLE.waiting : DOOR_ANGLE.rest;
  }

  function enter(plan: EnterPlan): Promise<void> {
    if (entering === null) {
      const now = performance.now();
      // 揺れを含んだ今の view から歩き出す。ホームから始めると 1 フレーム跳ぶ。
      const view = currentView();
      entering = {
        plan,
        startedAt: now,
        fromAngle: doorAngle,
        view,
        startDistance: Math.max(1e-6, distanceBetween(view.position, GLIDE.target.position)),
        lastTickAt: now,
      };
    }
    // rAF に頼らず時間で解決する。タブが裏に回ると rAF は止まるが、ログイン自体は
    // 済んでいるので、行き先へ進むのを止めてはいけない。
    return new Promise((resolve) => setTimeout(resolve, plan.totalMs));
  }

  function detach(): EntranceBridge | null {
    if (detached) return null;
    detached = true;
    // 元の入れ物はもう見ない（このあと外れる）。大きさは持ち出した先が同じ画面いっぱいなので変わらない。
    resizeObserver.disconnect();
    return { canvas: renderer.domElement, dispose };
  }

  function isDetached(): boolean {
    return detached;
  }

  function setFrame(visibleHeight: number): void {
    // `Infinity` は「canvas 全体」（紙が退いたとき）。updateFrame が canvas の高さに丸める。
    // 捨ててよいのは NaN だけ — 以前 `isFinite` で弾いていて、紙が退いても扉が上の窓に
    // 小さく残ったまま歩き出していた。
    if (Number.isNaN(visibleHeight)) return;
    frameTarget = visibleHeight;
  }

  function setPointer(x: number, y: number): void {
    pointer.x = Math.max(-1, Math.min(1, x));
    pointer.y = Math.max(-1, Math.min(1, y));
    pointerInside = true;
  }

  function clearPointer(): void {
    pointerInside = false;
  }

  // ---- 大きさの追従 -------------------------------------------------------

  const resizeObserver = new ResizeObserver(() => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height);
    // 投影は次のフレームの updateFrame が窓に合わせて組み直す。
    projectionDirty = true;
  });
  resizeObserver.observe(container);

  frame = requestAnimationFrame(tick);

  function dispose(): void {
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    for (const geometry of geometries) geometry.dispose();
    glimpse.dispose();
    room.disposeOwn();
    materials.dispose();
    renderer.dispose();
    // dispose() だけでは WebGL のコンテキストが解放されない（書斎の scene.ts と同じ理由）。
    renderer.forceContextLoss();
    // 持ち出したあとは親が変わっている。いまの親から外す。
    renderer.domElement.parentNode?.removeChild(renderer.domElement);
    while (container.firstChild) container.removeChild(container.firstChild);
  }

  return { setWaiting, enter, detach, isDetached, setFrame, setPointer, clearPointer, dispose };
}

// ============================================================================
// 物を組む
// ============================================================================

type OwnGeometry = <T extends BufferGeometry>(geometry: T) => T;

function aspectOf(container: HTMLElement): number {
  const height = container.clientHeight;
  return height > 0 ? container.clientWidth / height : 1;
}

function distanceBetween(a: CameraView['position'], b: CameraView['position']): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function applyView(camera: PerspectiveCamera, view: CameraView): void {
  camera.position.set(view.position.x, view.position.y, view.position.z);
  camera.lookAt(view.target.x, view.target.y, view.target.z);
}

/** 面 + 稜線の 1 組（書斎の `lineArt` と同じ）。面が無いと後ろが透ける。 */
function lineArt(geometry: BufferGeometry, materials: StudyMaterials, own: OwnGeometry): Group {
  const group = new Group();
  group.add(new Mesh(own(geometry), materials.solid));
  group.add(new LineSegments(own(new EdgesGeometry(geometry, 15)), materials.ink));
  return group;
}

function lineFrom(points: Vector3[], material: Material, own: OwnGeometry): Line {
  return new Line(own(new BufferGeometry().setFromPoints(points)), material);
}

/** 長方形の輪郭（z 一定の面の上）。 */
function rectOutline(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  z: number,
  material: Material,
  own: OwnGeometry,
): Line {
  return lineFrom(
    [
      new Vector3(x0, y0, z),
      new Vector3(x1, y0, z),
      new Vector3(x1, y1, z),
      new Vector3(x0, y1, z),
      new Vector3(x0, y0, z),
    ],
    material,
    own,
  );
}

/**
 * 床の格子。書斎と同じ濃度（気配だけ）。
 *
 * **壁の奥まで続けて引く。** 手前の格子は壁で止まり、扉の隙間からだけ奥の格子が覗く。
 * 同じ床が扉の向こうへ続いていることが、そのまま「奥に部屋がある」の表現になる。
 */
function buildFloorGrid(materials: StudyMaterials, own: OwnGeometry): LineSegments {
  const { halfWidth, near, far } = FLOOR_GRID;
  const points: Vector3[] = [];
  for (let x = -halfWidth; x <= halfWidth; x++) {
    // 書斎と同じく中央の 1 本は抜く。扉の中心線に線が立つと、敷居を割って見える。
    if (x === 0) continue;
    points.push(new Vector3(x, 0, far), new Vector3(x, 0, near));
  }
  for (let z: number = far; z <= near; z++) {
    if (z === 0) continue;
    points.push(new Vector3(-halfWidth, 0, z), new Vector3(halfWidth, 0, z));
  }
  return new LineSegments(own(new BufferGeometry().setFromPoints(points)), materials.gridFaint);
}

/**
 * 扉のある壁。**開口だけをくり抜いた 1 枚の面**で、線はほとんど引かない。
 *
 * 書斎の奥の壁が「立ち上がりの 2 本」だけで壁を語っているのと同じで、面の縁を線で囲むと
 * 壁が画面を仕切る看板になる。床との取り合い（幅木）だけを引き、壁は地の色の広がりとして読ませる。
 */
function buildWall(materials: StudyMaterials, own: OwnGeometry): Group {
  const group = new Group();
  const { halfWidth, height } = WALL;
  const opening = DOOR.width / 2;

  const shape = new Shape();
  shape.moveTo(-halfWidth, 0);
  shape.lineTo(-opening, 0);
  shape.lineTo(-opening, DOOR.height);
  shape.lineTo(opening, DOOR.height);
  shape.lineTo(opening, 0);
  shape.lineTo(halfWidth, 0);
  shape.lineTo(halfWidth, height);
  shape.lineTo(-halfWidth, height);
  shape.lineTo(-halfWidth, 0);
  group.add(new Mesh(own(new ShapeGeometry(shape)), materials.solid));

  const outer = opening + FRAME.width;
  for (const [from, to] of [
    [-halfWidth, -outer],
    [outer, halfWidth],
  ]) {
    // 床との取り合い。
    group.add(
      lineFrom(
        [new Vector3(from, 0.002, 0.01), new Vector3(to, 0.002, 0.01)],
        materials.faint(0.26),
        own,
      ),
    );
    // 幅木の上端。ここが 1 本あるだけで、面が「壁」に見える。
    group.add(
      lineFrom(
        [new Vector3(from, 0.24, 0.01), new Vector3(to, 0.24, 0.01)],
        materials.faint(0.12),
        own,
      ),
    );
  }

  return group;
}

/** 枠（額縁）と沓摺り。扉の輪郭を決める、いちばん濃い線。 */
function buildFrame(materials: StudyMaterials, own: OwnGeometry): Group {
  const group = new Group();
  const { width: fw, depth } = FRAME;
  const half = DOOR.width / 2;

  for (const side of [-1, 1]) {
    const jamb = lineArt(new BoxGeometry(fw, DOOR.height + fw, depth), materials, own);
    jamb.position.set(side * (half + fw / 2), (DOOR.height + fw) / 2, 0);
    group.add(jamb);
  }

  const head = lineArt(new BoxGeometry(DOOR.width + fw * 2, fw, depth), materials, own);
  head.position.set(0, DOOR.height + fw / 2, 0);
  group.add(head);

  const sill = lineArt(new BoxGeometry(DOOR.width, 0.04, depth), materials, own);
  sill.position.set(0, 0.02, 0);
  group.add(sill);

  return group;
}

/**
 * 扉板。蝶番（左端）を原点にしたグループで返す。`rotation.y` を正にすると奥へ開く。
 *
 * 描くのは鏡板 2 枚・取っ手・名札の枠だけ。**名札は空けておく** — 名乗るのは画面の紙の
 * ほうで、扉が先に名前を知っていると話が逆になる。
 */
function buildDoor(materials: StudyMaterials, own: OwnGeometry): Group {
  const pivot = new Group();
  pivot.position.set(-DOOR.width / 2, 0, -0.05);

  const { width: w, height: h, thickness: t } = DOOR;
  const slab = lineArt(new BoxGeometry(w - 0.02, h - 0.03, t), materials, own);
  slab.position.set(w / 2, h / 2 + 0.015, 0);
  pivot.add(slab);

  const face = t / 2 + 0.004;
  const inset = 0.3;
  // 鏡板。外の枠と、内側に一回り小さい枠（面取りの段）。
  const panels: [number, number][] = [
    [h * 0.53, h - 0.36],
    [0.36, h * 0.47],
  ];
  for (const [y0, y1] of panels) {
    pivot.add(rectOutline(inset, y0, w - inset, y1, face, materials.faint(0.3), own));
    pivot.add(
      rectOutline(
        inset + 0.09,
        y0 + 0.09,
        w - inset - 0.09,
        y1 - 0.09,
        face,
        materials.faint(0.11),
        own,
      ),
    );
  }

  // 名札の枠。上の鏡板の中ほど、目の高さ。
  pivot.add(rectOutline(w / 2 - 0.34, 3.34, w / 2 + 0.34, 3.56, face, materials.faint(0.42), own));

  // 取っ手。座金とレバー。
  const handleX = w - 0.26;
  const handleY = h * 0.47 - 0.02;
  const rosette = lineArt(new CylinderGeometry(0.075, 0.075, 0.03, 28), materials, own);
  rosette.rotation.x = Math.PI / 2;
  rosette.position.set(handleX, handleY, t / 2 + 0.015);
  pivot.add(rosette);
  const lever = lineArt(new BoxGeometry(0.36, 0.05, 0.05), materials, own);
  lever.position.set(handleX - 0.15, handleY, t / 2 + 0.07);
  pivot.add(lever);
  // 鍵穴。
  pivot.add(
    lineFrom(
      [new Vector3(handleX, handleY - 0.2, face), new Vector3(handleX, handleY - 0.28, face)],
      materials.faint(0.5),
      own,
    ),
  );

  return pivot;
}

/** 扉の前の敷物。床の格子の上に、面を 1 枚だけ置く。 */
function buildDoormat(materials: StudyMaterials, own: OwnGeometry): Group {
  const group = new Group();
  const mat = lineArt(new BoxGeometry(2.3, 0.03, 0.95), materials, own);
  mat.position.set(0, 0.015, 1.05);
  group.add(mat);
  const y = 0.032;
  group.add(
    lineFrom(
      [
        new Vector3(-1.02, y, 0.7),
        new Vector3(1.02, y, 0.7),
        new Vector3(1.02, y, 1.4),
        new Vector3(-1.02, y, 1.4),
        new Vector3(-1.02, y, 0.7),
      ],
      materials.faint(0.16),
      own,
    ),
  );
  return group;
}
/**
 * 扉の向こうに覗く、これから入る書斎。
 *
 * **書斎にある物を、書斎と同じ描き方で縮めて置く。** 気配だからと独自の部屋を描いていた頃は、
 * 壺の形も机の見え方も書斎と違い、「扉の壺と書斎の壺が同じには思えない」「机を白っぽくして
 * いるが、書斎に入った後は白っぽくない」「board やエントリーの本もあってもいい」と報告された
 * （PR #624 のレビュー）。**同じ物が同じところに、同じ描き方で見える**ことだけが、扉の向こうと
 * 書斎を 1 つの部屋にする。
 *
 * 濃さは書斎の値をそのまま持ち、遠さは `reveal` の倍率で表す（待っている間は `GLIMPSE_REST`、
 * 歩いて近づくと 1.0 ＝ 書斎と同じ濃さ）。置き場は `EntranceLayout.glimpse` と `STUDY_RELATIVE`。
 */
function buildStudyGlimpse(
  materials: StudyMaterials,
  own: OwnGeometry,
  layout: EntranceLayout,
): StudyGlimpse {
  const group = new Group();
  const shades: { material: Material & { opacity: number }; base: number }[] = [];
  /** 書斎と同じ濃さで線を 1 本。`reveal` が遠さのぶんだけ薄める。 */
  function shade(opacity: number): LineBasicMaterial {
    const material = materials.faint(opacity).clone();
    shades.push({ material, base: opacity });
    return material;
  }
  /**
   * 塗りも同じ扱いにする。
   *
   * 線だけを薄くして塗りをそのままにすると、**塗りのある物だけが浮く**（蓋のクリームが
   * 気配の中で 1 つだけ実物の濃さになっていた。実機レビュー「瓶が浮いてない？色合いとか」）。
   */
  function shadeFill(source: MeshBasicMaterial, opacity: number): MeshBasicMaterial {
    const material = source.clone();
    material.transparent = true;
    material.opacity = opacity;
    shades.push({ material, base: opacity });
    return material;
  }
  /** 面と稜線の 1 組（書斎の `lineArt` と同じ）。面が無いと後ろが透ける。 */
  function solidBox(geometry: BufferGeometry): Group {
    const box = new Group();
    box.add(new Mesh(own(geometry), shadeFill(materials.solid, 1)));
    box.add(new LineSegments(own(new EdgesGeometry(geometry, 15)), shade(0.5)));
    return box;
  }

  const { jarX, deskY, scale } = layout.glimpse;
  const at = (x: number, y: number, z: number) => ({
    x: jarX + x * scale,
    y: deskY + y * scale,
    z: GLIMPSE_Z + z * scale,
  });

  // ---- 机（書斎の `buildDesk` と同じ引き方。面は置かない） ----
  const desk = STUDY_RELATIVE.desk;
  const nearL = at(desk.x0, 0, desk.zNear);
  const nearR = at(desk.x1, 0, desk.zNear);
  const farL = at(desk.x0, 0, desk.zFar);
  const farR = at(desk.x1, 0, desk.zFar);
  group.add(
    lineFrom(
      [
        new Vector3(nearL.x, nearL.y, nearL.z),
        new Vector3(nearR.x, nearR.y, nearR.z),
        new Vector3(farR.x, farR.y, farR.z),
        new Vector3(farL.x, farL.y, farL.z),
        new Vector3(nearL.x, nearL.y, nearL.z),
      ],
      shade(0.13),
      own,
    ),
  );
  // 手前の木端。**ここだけ濃く引くと、平面が板に見える。** 書斎でも厚みはこの 1 本が担う。
  const edgeBottom = deskY - 0.22 * scale;
  group.add(
    lineFrom(
      [
        new Vector3(nearL.x, nearL.y, nearL.z),
        new Vector3(nearL.x, edgeBottom, nearL.z),
        new Vector3(nearR.x, edgeBottom, nearR.z),
        new Vector3(nearR.x, nearR.y, nearR.z),
      ],
      shade(0.34),
      own,
    ),
  );
  // 木目を示唆する長い 1 本。
  const grainA = at(desk.x0 + 0.8, 0, desk.zFar + 1.2);
  const grainB = at(desk.x1 - 0.8, 0, desk.zFar + 1.6);
  group.add(
    lineFrom(
      [new Vector3(grainA.x, grainA.y, grainA.z), new Vector3(grainB.x, grainB.y, grainB.z)],
      shade(0.06),
      own,
    ),
  );
  // 奥の壁の立ち上がり。
  for (const corner of [farL, farR]) {
    group.add(
      lineFrom(
        [
          new Vector3(corner.x, corner.y, corner.z),
          new Vector3(corner.x, corner.y + 4 * scale, corner.z),
        ],
        shade(0.07),
        own,
      ),
    );
  }

  // ---- 壁の板（書斎の `buildBoard` と同じ。面・枠・格子） ----
  const boardCenter = at(STUDY_RELATIVE.board.x, STUDY_RELATIVE.board.y, STUDY_RELATIVE.board.z);
  const boardW = STUDY_RELATIVE.board.width * scale;
  const boardH = STUDY_RELATIVE.board.height * scale;
  const board = new Group();
  board.position.set(boardCenter.x, boardCenter.y, boardCenter.z);
  // 面。抜けていると奥の壁が透ける。
  const boardFace = new Mesh(own(new PlaneGeometry(boardW, boardH)), shadeFill(materials.solid, 1));
  boardFace.position.z = -0.01;
  board.add(boardFace);
  board.add(
    lineFrom(
      [
        new Vector3(-boardW / 2, -boardH / 2, 0),
        new Vector3(boardW / 2, -boardH / 2, 0),
        new Vector3(boardW / 2, boardH / 2, 0),
        new Vector3(-boardW / 2, boardH / 2, 0),
        new Vector3(-boardW / 2, -boardH / 2, 0),
      ],
      shade(0.3),
      own,
    ),
  );
  // 板の格子。書斎と同じ刻み（1.0）を縮める。
  const boardGrid = shade(0.06);
  for (let x = -boardW / 2 + scale; x < boardW / 2; x += scale) {
    board.add(
      lineFrom([new Vector3(x, -boardH / 2, 0), new Vector3(x, boardH / 2, 0)], boardGrid, own),
    );
  }
  for (let y = -boardH / 2 + scale; y < boardH / 2; y += scale) {
    board.add(
      lineFrom([new Vector3(-boardW / 2, y, 0), new Vector3(boardW / 2, y, 0)], boardGrid, own),
    );
  }
  group.add(board);

  // ---- 机の上の手帳の積み（書斎の `buildBooks` と同じ箱の重ね方） ----
  const books = STUDY_RELATIVE.books;
  const stack = new Group();
  const stackAt = at(books.x, 0, books.z);
  stack.position.set(stackAt.x, stackAt.y, stackAt.z);
  stack.rotation.y = books.rotationY;
  let stacked = 0;
  for (const thickness of books.thicknesses) {
    const block = solidBox(
      new BoxGeometry(books.width * scale, thickness * scale, books.depth * scale),
    );
    block.position.y = (stacked + thickness / 2) * scale;
    stack.add(block);
    stacked += thickness;
  }
  group.add(stack);

  // ---- 瓶（書斎の `buildJar` と同じ。面・稜線・経線・蓋） ----
  const profile = sampleJarProfile();
  const jar = new Group();
  jar.position.set(jarX, deskY, GLIMPSE_Z);
  jar.scale.setScalar(scale);
  const bodyGeometry = own(new LatheGeometry(profile, 48));
  jar.add(new Mesh(bodyGeometry, shadeFill(materials.solid, 1)));
  // 稜線。しきい値 45° で口縁と角だけが残る（胴に横線が出ない）。
  jar.add(new LineSegments(own(new EdgesGeometry(bodyGeometry, EDGES_THRESHOLD_DEG)), shade(0.5)));
  // 経線。書斎と同じ本数・同じ薄さ。
  const meridian = shade(MERIDIAN_OPACITY);
  for (let i = 0; i < MERIDIAN_COUNT; i++) {
    const angle = (i / MERIDIAN_COUNT) * Math.PI * 2;
    jar.add(
      lineFrom(
        profile.map(
          (point) => new Vector3(Math.sin(angle) * point.x, point.y, Math.cos(angle) * point.x),
        ),
        meridian,
        own,
      ),
    );
  }
  // 蓋（コルク）。書斎と同じクリームの塗りと稜線。
  const corkGeometry = own(
    new CylinderGeometry(CORK.radiusTop, CORK.radiusBottom, CORK.height, 24),
  );
  const cork = new Mesh(corkGeometry, shadeFill(materials.cork, 1));
  cork.position.y = CORK.y;
  jar.add(cork);
  jar.add(
    new LineSegments(
      own(new EdgesGeometry(corkGeometry, EDGES_THRESHOLD_DEG)),
      shade(0.5),
    ).translateY(CORK.y),
  );
  group.add(jar);

  return {
    group,
    reveal(t: number): void {
      // 遠くにある同じ部屋。近づくほど書斎の濃さ（1.0）に寄る。
      const gain = GLIMPSE_REST + (1 - GLIMPSE_REST) * clamp01(t);
      for (const shade of shades) shade.material.opacity = shade.base * gain;
    },
    dispose(): void {
      for (const shade of shades) shade.material.dispose();
    },
  };
}

/**
 * 扉の左の、低い棚と一輪挿し。**玄関（書斎の手前の部屋）であることを言う物はこれ 1 つ。**
 *
 * 扉だけだと、壁に扉が描いてあるだけの「入口のアイコン」に読める。人が暮らしている
 * 前室には、帰ってきた手が物を置く高さの面がある。書斎が瓶と手帳で語るのと同じく、
 * ここも物 1 つで語り、線を足して部屋を説明しない。
 */
function buildCabinet(
  materials: StudyMaterials,
  own: OwnGeometry,
  layout: EntranceLayout,
  sprig: Sprig,
): Group {
  const group = new Group();
  // 扉の枠（外端 x = -1.3）から少し離し、PC の構図で左端に切れない位置と幅。
  const cabinet = { x: -2.8, width: 1.5, height: 1.02, depth: 0.52 };
  const frontZ = cabinet.depth;
  group.position.set(cabinet.x, 0, 0.02);

  const body = lineArt(
    new BoxGeometry(cabinet.width, cabinet.height, cabinet.depth),
    materials,
    own,
  );
  body.position.set(0, cabinet.height / 2 + 0.06, cabinet.depth / 2);
  group.add(body);

  // 天板は胴より少しだけ張り出す（箱ではなく家具に見せる 1 枚）。
  const topBoard = lineArt(
    new BoxGeometry(cabinet.width + 0.08, 0.05, cabinet.depth + 0.06),
    materials,
    own,
  );
  topBoard.position.set(0, cabinet.height + 0.085, cabinet.depth / 2 + 0.01);
  group.add(topBoard);

  // 観音開きの合わせ目と、つまみ 2 つ。
  const face = frontZ + 0.003;
  group.add(
    lineFrom(
      [new Vector3(0, 0.14, face), new Vector3(0, cabinet.height - 0.02, face)],
      materials.faint(0.3),
      own,
    ),
  );
  for (const side of [-1, 1]) {
    group.add(
      lineFrom(
        [
          new Vector3(side * 0.09, cabinet.height * 0.62, face),
          new Vector3(side * 0.09, cabinet.height * 0.74, face),
        ],
        materials.faint(0.55),
        own,
      ),
    );
  }

  const vaseLocal = { x: 0.36, z: cabinet.depth * 0.5 };
  const vase = buildVase(
    materials,
    own,
    layout,
    { x: cabinet.x + vaseLocal.x, z: group.position.z + vaseLocal.z },
    sprig,
  );
  vase.position.set(vaseLocal.x, cabinet.height + 0.11, vaseLocal.z);
  group.add(vase);

  return group;
}

/** 一輪挿しの母線 `[radius, y]`。胴が膨らみ、首が細く締まる。 */
const VASE_PROFILE: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.1, 0],
  [0.14, 0.05],
  [0.155, 0.16],
  [0.14, 0.28],
  [0.095, 0.4],
  [0.052, 0.5],
  [0.046, 0.6],
  [0.062, 0.65],
  [0, 0.65],
];

/**
 * 一輪挿しと、挿してある枝。
 *
 * 輪郭はカメラから見た真横の母線 2 本で閉じる。書斎の瓶のように毎フレーム解き直すほどの
 * 大きさではないので、ホームの視点から一度だけ決める（揺れの幅では輪郭はずれて見えない）。
 */
function buildVase(
  materials: StudyMaterials,
  own: OwnGeometry,
  layout: EntranceLayout,
  /** 花瓶の world 上の位置（輪郭の向きを決めるためだけに使う）。 */
  world: { x: number; z: number },
  /** 挿してある枝の姿（季節）。 */
  sprig: Sprig,
): Group {
  const group = new Group();
  const profile = VASE_PROFILE.map(([r, y]) => new Vector2(r, y));
  group.add(new Mesh(own(new LatheGeometry(profile, 40)), materials.solid));

  // カメラへ向かう方位。輪郭の母線はそこから ±90°。
  const toCamera = Math.atan2(
    layout.camera.position.x - world.x,
    layout.camera.position.z - world.z,
  );
  const side = toCamera + Math.PI / 2;
  const outline = [
    ...profile.map((p) => new Vector3(Math.sin(side) * p.x, p.y, Math.cos(side) * p.x)),
    ...profile.map((p) => new Vector3(-Math.sin(side) * p.x, p.y, -Math.cos(side) * p.x)).reverse(),
  ];
  group.add(lineFrom(outline, materials.ink, own));

  // 草花はカメラに向いた面の上に描く（花器の口を原点にした 2 次元）。
  const along = (u: number, y: number) => new Vector3(Math.sin(side) * u, y, Math.cos(side) * u);
  drawSprig(group, materials, own, along, VASE_MOUTH_Y, sprig);

  return group;
}

/** 花器の口の高さ（草花はここから立ち上がる）。 */
const VASE_MOUTH_Y = 0.63;

/** 面の上の点（u = 横、y = 縦）。`along` が world へ移す。 */
interface Flat {
  u: number;
  y: number;
}

type Along = (u: number, y: number) => Vector3;

/**
 * 一輪挿しに挿さった草花を描く（`entrance/season.ts` の `Sprig`）。
 *
 * **一種を投げ入れた姿**にする。整えず、まっすぐ立てず、余白を残す — 川瀬敏郎の
 * 「一日一花」の見え方に倣っている（`season.ts` の注釈）。線は細く、葉と花は枝より薄い。
 */
function drawSprig(
  group: Group,
  materials: StudyMaterials,
  own: OwnGeometry,
  along: Along,
  mouthY: number,
  sprig: Sprig,
): void {
  const stemInk = materials.faint(0.62);
  const leafInk = materials.faint(0.45);
  const flowerInk = materials.faint(0.52);

  const draw = (points: Flat[], material: Material) => {
    group.add(
      lineFrom(
        points.map((p) => along(p.u, p.y)),
        material,
        own,
      ),
    );
  };

  for (let index = 0; index < Math.max(1, sprig.stems); index++) {
    const spread = index - (sprig.stems - 1) / 2;
    const lean = sprig.lean + spread * 0.28;
    const height = sprig.height * (1 - Math.abs(spread) * 0.14);
    const stem = stemPath(sprig.form, lean, height, mouthY, index);
    draw(stem, stemInk);

    const tip = stem[stem.length - 1];
    const direction = headingAt(stem);

    if (sprig.form === 'needle') drawNeedles(draw, stem, stemInk);
    if (sprig.form === 'plume') drawPlume(draw, tip, direction, sprig.bloom, flowerInk);
    if (sprig.form === 'broadleaf') drawBroadLeaf(draw, tip, direction, leafInk);

    // 葉・実・花は 1 本目にだけ付ける（何本も同じ物が付くと作り物に見える）。
    if (index > 0) continue;

    for (let leaf = 0; leaf < sprig.leaves; leaf++) {
      const at = pointAt(stem, 0.34 + leaf * 0.19);
      const tilt = (leaf % 2 === 0 ? 1 : -1) * 0.8 + direction * 0.2;
      drawLeaf(draw, at, tilt, sprig.leafShape ?? 'oval', leafInk);
    }

    for (let berry = 0; berry < sprig.berries; berry++) {
      const at = pointAt(stem, 0.46 + berry * 0.12);
      drawBerry(draw, at, flowerInk);
    }

    if (sprig.petals > 0) {
      drawFlower(draw, tip, direction, sprig, flowerInk);
      // 枝物は先だけでなく、途中にもひとつ咲かせる（一輪では寂しい）。
      if (sprig.form === 'branch' && sprig.bloom > 0.5) {
        drawFlower(draw, pointAt(stem, 0.62), direction + 0.6, sprig, flowerInk);
      }
    }
  }
}

/**
 * 茎・枝の道筋。姿の型ごとに曲がり方が違う。
 *
 * 2 次ベジエ 1 本で描き、枝だけ節で小さく折る。**まっすぐ立てない** — 立てると
 * 生け花ではなく標本に見える。
 */
function stemPath(
  form: Sprig['form'],
  lean: number,
  height: number,
  mouthY: number,
  index: number,
): Flat[] {
  const tip = { u: Math.sin(lean) * height, y: mouthY + Math.cos(lean) * height };
  // 制御点の置き方で「しなり」が決まる。草は上の方でしなり、花はほぼ直線。
  const bend =
    form === 'grass' || form === 'plume'
      ? { u: 0.12, y: 0.82 }
      : form === 'vine'
        ? { u: 0.75, y: 0.55 }
        : form === 'flower'
          ? { u: 0.38, y: 0.52 }
          : { u: 0.18, y: 0.6 };
  const control = { u: tip.u * bend.u, y: mouthY + (tip.y - mouthY) * bend.y };

  const points: Flat[] = [];
  const steps = 22;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const inverse = 1 - t;
    let u = inverse ** 2 * 0 + 2 * inverse * t * control.u + t ** 2 * tip.u;
    let y = inverse ** 2 * mouthY + 2 * inverse * t * control.y + t ** 2 * tip.y;
    // つるはうねる。枝は節で小さく折れる。
    if (form === 'vine') u += Math.sin(t * Math.PI * 2.4 + index) * 0.06 * t;
    if (form === 'branch') {
      u += Math.sin(t * Math.PI * 3) * 0.022;
      y += Math.cos(t * Math.PI * 3) * 0.012;
    }
    points.push({ u, y });
  }
  return points;
}

/** 先端での向き（rad）。付ける物の傾きに使う。 */
function headingAt(path: Flat[]): number {
  const last = path[path.length - 1];
  const before = path[Math.max(0, path.length - 3)];
  return Math.atan2(last.y - before.y, last.u - before.u);
}

/** 道筋の途中の点（t は 0..1）。 */
function pointAt(path: Flat[], t: number): Flat {
  const clamped = Math.max(0, Math.min(1, t));
  return path[Math.round(clamped * (path.length - 1))];
}

/** 閉じた輪郭を作る（葉・花びら・実）。 */
function ellipsePoints(at: Flat, tilt: number, long: number, short: number): Flat[] {
  const points: Flat[] = [];
  for (let i = 0; i <= 18; i++) {
    const angle = (i / 18) * Math.PI * 2;
    const x = Math.cos(angle) * long + long;
    const y = Math.sin(angle) * short;
    points.push({
      u: at.u + x * Math.cos(tilt) - y * Math.sin(tilt),
      y: at.y + x * Math.sin(tilt) + y * Math.cos(tilt),
    });
  }
  return points;
}

function drawLeaf(
  draw: (points: Flat[], material: Material) => void,
  at: Flat,
  tilt: number,
  shape: NonNullable<Sprig['leafShape']>,
  material: Material,
): void {
  if (shape === 'lobed') {
    // 楓。**小さく、葉柄を付ける** — 大きく描くと切れ込みが花びらに見える。
    const stalk = 0.045;
    const base = { u: at.u + Math.cos(tilt) * stalk, y: at.y + Math.sin(tilt) * stalk };
    draw([at, base], material);
    const points: Flat[] = [];
    for (let i = 0; i <= 40; i++) {
      const angle = (i / 40) * Math.PI * 2;
      const radius = 0.05 * (0.74 + 0.26 * Math.cos(5 * angle));
      const x = Math.cos(angle) * radius + 0.05;
      const y = Math.sin(angle) * radius;
      points.push({
        u: base.u + x * Math.cos(tilt) - y * Math.sin(tilt),
        y: base.y + x * Math.sin(tilt) + y * Math.cos(tilt),
      });
    }
    draw(points, material);
    return;
  }
  const long = shape === 'narrow' ? 0.15 : 0.1;
  const short = shape === 'narrow' ? 0.018 : 0.036;
  draw(ellipsePoints(at, tilt, long, short), material);
}

function drawBerry(
  draw: (points: Flat[], material: Material) => void,
  at: Flat,
  material: Material,
): void {
  draw(ellipsePoints({ u: at.u - 0.026, y: at.y - 0.03 }, 0, 0.026, 0.026), material);
}

/**
 * 花。蕾のうちは閉じた 1 枚、開くほど花びらが広がる。
 *
 * `petals === 1` は釣鐘（蛍袋）。下を向いて垂れる。
 */
function drawFlower(
  draw: (points: Flat[], material: Material) => void,
  at: Flat,
  heading: number,
  sprig: Sprig,
  material: Material,
): void {
  const open = Math.max(0, Math.min(1, sprig.bloom));
  if (sprig.petals === 1) {
    draw(ellipsePoints({ u: at.u, y: at.y - 0.11 }, Math.PI / 2, 0.055, 0.035), material);
    return;
  }
  if (open < 0.34) {
    // 蕾。枝の先に細い粒が付く。
    draw(ellipsePoints(at, heading, 0.05, 0.026), material);
    return;
  }
  const length = 0.045 + 0.055 * open;
  const width = sprig.petals >= 6 ? 0.012 : 0.022;
  // 花びらが 3 枚以下（菖蒲）は**垂れる**。放射させるとプロペラに見える。
  const droops = sprig.petals <= 3;
  for (let petal = 0; petal < sprig.petals; petal++) {
    const angle = droops
      ? heading - Math.PI / 2 + (petal - (sprig.petals - 1) / 2) * 0.85
      : heading + (petal / sprig.petals) * Math.PI * 2;
    draw(ellipsePoints(at, angle, length, width), material);
  }
}

/** 穂（芒・土筆）。先から短い線が開く。 */
function drawPlume(
  draw: (points: Flat[], material: Material) => void,
  tip: Flat,
  heading: number,
  bloom: number,
  material: Material,
): void {
  const open = 0.2 + 0.8 * Math.max(0, Math.min(1, bloom));
  const count = 7;
  for (let i = 0; i < count; i++) {
    const spread = (i / (count - 1) - 0.5) * 1.5 * open;
    const angle = heading + spread;
    const length = 0.12 + 0.1 * open;
    draw(
      [tip, { u: tip.u + Math.cos(angle) * length, y: tip.y + Math.sin(angle) * length }],
      material,
    );
  }
}

/** 松の針。茎に沿って短い線が並ぶ。 */
function drawNeedles(
  draw: (points: Flat[], material: Material) => void,
  stem: Flat[],
  material: Material,
): void {
  for (let i = 6; i < stem.length; i += 3) {
    const at = stem[i];
    const before = stem[i - 1];
    const heading = Math.atan2(at.y - before.y, at.u - before.u);
    for (const side of [0.55, -0.55]) {
      const angle = heading + side;
      draw([at, { u: at.u + Math.cos(angle) * 0.1, y: at.y + Math.sin(angle) * 0.1 }], material);
    }
  }
}

/** 大きな一枚（蓮の葉）。茎の先から葉脈が広がる。 */
function drawBroadLeaf(
  draw: (points: Flat[], material: Material) => void,
  tip: Flat,
  heading: number,
  material: Material,
): void {
  const radius = 0.18;
  const center = { u: tip.u + Math.cos(heading) * radius, y: tip.y + Math.sin(heading) * radius };
  const points: Flat[] = [];
  for (let i = 0; i <= 36; i++) {
    const angle = (i / 36) * Math.PI * 2;
    // 茎の付け根だけ浅く切れ込む（真円だと皿に見える）。
    const r = radius * (1 - 0.12 * Math.exp(-(((angle - (heading + Math.PI)) / 0.45) ** 2)));
    points.push({ u: center.u + Math.cos(angle) * r, y: center.y + Math.sin(angle) * r * 0.66 });
  }
  draw(points, material);
  // 葉脈は**茎の先から**広がる。中心から引くと葉が宙に浮いて見える。
  for (const spread of [-0.6, 0, 0.6]) {
    const angle = heading + spread;
    draw(
      [
        tip,
        {
          u: tip.u + Math.cos(angle) * radius * 1.5,
          y: tip.y + Math.sin(angle) * radius * 1.1,
        },
      ],
      material,
    );
  }
}
