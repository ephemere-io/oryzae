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
  LineSegments,
  type Material,
  Mesh,
  PerspectiveCamera,
  Scene,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { RENDER_LIMITS } from '@/features/shared/study/constants';
import { approach, breathOffset, type CameraView } from '@/features/shared/study/scene/camera';
import { sampleJarProfile } from '@/features/shared/study/scene/jar';
import { createMaterials, type StudyMaterials } from '@/features/shared/study/scene/materials';
import {
  DOOR,
  DOOR_ANGLE,
  DOOR_SETTLE_LERP,
  doorAngleWhileEntering,
  type EnterPlan,
  FRAME,
  homeEntranceView,
  walkProgress,
  walkView,
} from './door';
import type { EntranceLayout } from './layout';

export interface EntranceSceneOptions {
  container: HTMLElement;
  layout: EntranceLayout;
  reducedMotion: boolean;
  /** 最初の 1 フレームを描き終えたとき（1 度だけ）。地から扉を浮かび上がらせる合図。 */
  onReady?: () => void;
}

export interface EntranceSceneHandle {
  /** 送信中・認証中か。扉が少し大きく開く。 */
  setWaiting(waiting: boolean): void;
  /** 扉を押し開けて奥へ歩く。`plan.totalMs` 経ったら resolve する。 */
  enter(plan: EnterPlan): Promise<void>;
  /** 画面上のポインタ位置（-1..1）。パララックスに使う。 */
  setPointer(x: number, y: number): void;
  clearPointer(): void;
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

  scene.add(buildFloorGrid(materials, own));
  scene.add(buildWall(materials, own));
  scene.add(buildFrame(materials, own));
  scene.add(buildDoormat(materials, own));
  scene.add(buildStudyGlimpse(materials, own));
  scene.add(buildCabinet(materials, own, layout));
  const door = buildDoor(materials, own);
  scene.add(door);

  // ---- 状態 --------------------------------------------------------------

  const home = homeEntranceView(layout);
  applyView(camera, home);

  let doorAngle: number = DOOR_ANGLE.rest;
  let doorTarget: number = DOOR_ANGLE.rest;
  door.rotation.y = doorAngle;

  const pointer = { x: 0, y: 0 };
  let pointerInside = false;
  const parallax = { x: 0, y: 0 };

  let entering: {
    plan: EnterPlan;
    startedAt: number;
    fromAngle: number;
    fromView: CameraView;
    resolve: () => void;
  } | null = null;

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
      applyView(camera, walkView(entering.fromView, walkProgress(entering.plan, elapsed)));
    } else {
      doorAngle = approach(doorAngle, doorTarget, DOOR_SETTLE_LERP);
      door.rotation.y = doorAngle;
      applyView(camera, restingView(now - startedAt));
    }

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
    if (entering) return new Promise((resolve) => setTimeout(resolve, plan.totalMs));
    return new Promise<void>((resolve) => {
      entering = {
        plan,
        startedAt: performance.now(),
        fromAngle: doorAngle,
        // 揺れを含んだ今の view から歩き出す。ホームから始めると 1 フレーム跳ぶ。
        fromView: currentView(),
        resolve,
      };
      // rAF に頼らず時間で解決する。タブが裏に回ると rAF は止まるが、ログイン自体は
      // 済んでいるので、行き先へ進むのを止めてはいけない。
      setTimeout(resolve, plan.totalMs);
    });
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
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  });
  resizeObserver.observe(container);

  frame = requestAnimationFrame(tick);

  function dispose(): void {
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    for (const geometry of geometries) geometry.dispose();
    materials.dispose();
    renderer.dispose();
    // dispose() だけでは WebGL のコンテキストが解放されない（書斎の scene.ts と同じ理由）。
    renderer.forceContextLoss();
    while (container.firstChild) container.removeChild(container.firstChild);
  }

  return { setWaiting, enter, setPointer, clearPointer, dispose };
}

// ============================================================================
// 物を組む
// ============================================================================

type OwnGeometry = <T extends BufferGeometry>(geometry: T) => T;

function aspectOf(container: HTMLElement): number {
  const height = container.clientHeight;
  return height > 0 ? container.clientWidth / height : 1;
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
 * 扉の向こうに覗く書斎の気配。**机の天板と瓶の輪郭だけを、ごく薄く。**
 *
 * 待っている間は扉の隙間からわずかに見え、押し開けると正面に来る。ここで書斎の物を
 * 描き込むと、入る前に部屋を見せてしまう — 見せるのは「何かがある」までにする。
 */
function buildStudyGlimpse(materials: StudyMaterials, own: OwnGeometry): Group {
  const group = new Group();
  const line = materials.faint(0.14);
  const faint = materials.faint(0.08);

  // 奥の壁の足元と、壁のボード。
  group.add(lineFrom([new Vector3(-7, 0, -11), new Vector3(7, 0, -11)], faint, own));
  group.add(rectOutline(-1.6, 2.2, 1.9, 4.4, -10.98, faint, own));

  // 机の天板（手前の木端つき）。
  const deskY = 1.5;
  group.add(
    lineFrom(
      [
        new Vector3(-3.2, deskY, -5.2),
        new Vector3(3.2, deskY, -5.2),
        new Vector3(3.2, deskY, -8.6),
        new Vector3(-3.2, deskY, -8.6),
        new Vector3(-3.2, deskY, -5.2),
      ],
      line,
      own,
    ),
  );
  group.add(
    lineFrom(
      [new Vector3(-3.2, deskY - 0.14, -5.2), new Vector3(3.2, deskY - 0.14, -5.2)],
      faint,
      own,
    ),
  );

  // 瓶。経線だけで形を示す（書斎の瓶と同じ母線）。本数を絞る — 多いと縞の壺に見える。
  const profile = sampleJarProfile();
  const jar = new Group();
  jar.position.set(-1.1, deskY, -6.6);
  jar.scale.setScalar(0.42);
  const meridians = 4;
  for (let i = 0; i < meridians; i++) {
    const angle = (i / meridians) * Math.PI;
    const points = profile.map(
      (point) => new Vector3(Math.sin(angle) * point.x, point.y, Math.cos(angle) * point.x),
    );
    // 手前と奥の 2 本を 1 本の輪郭に繋げる（半周ずつ）。真横（π/2）の 1 本が輪郭になるので、
    // そこだけ一段濃くする。
    const back = profile
      .map((point) => new Vector3(-Math.sin(angle) * point.x, point.y, -Math.cos(angle) * point.x))
      .reverse();
    jar.add(lineFrom([...points, ...back], i === meridians / 2 ? line : faint, own));
  }
  group.add(jar);

  return group;
}

/**
 * 扉の左の、低い棚と一輪挿し。**玄関（書斎の手前の部屋）であることを言う物はこれ 1 つ。**
 *
 * 扉だけだと、壁に扉が描いてあるだけの「入口のアイコン」に読める。人が暮らしている
 * 前室には、帰ってきた手が物を置く高さの面がある。書斎が瓶と手帳で語るのと同じく、
 * ここも物 1 つで語り、線を足して部屋を説明しない。
 */
function buildCabinet(materials: StudyMaterials, own: OwnGeometry, layout: EntranceLayout): Group {
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
  const vase = buildVase(materials, own, layout, {
    x: cabinet.x + vaseLocal.x,
    z: group.position.z + vaseLocal.z,
  });
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

  // 枝。カメラに向いた面の上で、少し右へ傾いて伸びる。
  const along = (u: number, y: number) => new Vector3(Math.sin(side) * u, y, Math.cos(side) * u);
  const stem = [
    along(0, 0.62),
    along(0.03, 0.9),
    along(0.12, 1.18),
    along(0.26, 1.42),
    along(0.36, 1.55),
  ];
  group.add(lineFrom(stem, materials.faint(0.6), own));

  // 葉。枝の途中に 3 枚、小さな紡錘形の輪郭で。
  const leaves: [number, number, number][] = [
    [0.03, 0.92, 0.9],
    [0.13, 1.2, -0.5],
    [0.27, 1.43, 0.7],
  ];
  for (const [u, y, tilt] of leaves) {
    const points: Vector3[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = (i / 16) * Math.PI * 2;
      const lx = Math.cos(t) * 0.11;
      const ly = Math.sin(t) * 0.035;
      const rx = lx * Math.cos(tilt) - ly * Math.sin(tilt);
      const ry = lx * Math.sin(tilt) + ly * Math.cos(tilt);
      points.push(along(u + rx + Math.cos(tilt) * 0.1, y + ry + Math.sin(tilt) * 0.1));
    }
    group.add(lineFrom(points, materials.faint(0.45), own));
  }

  return group;
}
