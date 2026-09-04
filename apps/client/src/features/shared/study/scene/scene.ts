/**
 * 書斎のシーンを組み立てて動かす（`docs/oryzae-study/20-3d-component.md`）。
 *
 * ここだけが three.js のシーングラフと rAF を持つ。座標と規則は同じ `scene/` の純関数が
 * 決めていて、このファイルはそれを three.js の物に置き換える仕事しかしない。
 *
 * **React は知らない。** `study-canvas.tsx` が `initScene` を呼び、cleanup で `dispose` する。
 */

import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  LatheGeometry,
  Line,
  LineLoop,
  LineSegments,
  type Material,
  Mesh,
  type Object3D,
  PerspectiveCamera,
  Raycaster,
  RingGeometry,
  Scene,
  Sprite,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { RENDER_LIMITS } from '../constants';
import type { StudyLayout } from '../layout';
import type { StudyState, StudyTarget } from '../types';
import { BOARD_FACE, BOARD_GRID_SPACING, PHOTO_INNER_INSET, placeBoardCards } from './board';
import {
  BLOCK_INSET,
  COVER_HINGE_X,
  COVER_LABEL,
  COVER_OPEN_ANGLE,
  COVER_THICKNESS,
  EDGE_LINE_JITTER,
  EDGE_LINE_OPACITIES,
  edgeLineCount,
  layoutNotebooks,
  NOTEBOOK_SIZE,
  RULES,
  SPINE_LABEL,
  SPREAD_PAGES,
  shelfSpineOffsets,
  spineLabelText,
  stackTopY,
} from './books';
import {
  boardCloseView,
  boardView,
  breathOffset,
  type CameraView,
  homeView,
  jarView,
  journalSpreadView,
  journalTopView,
  lerpView,
  parallaxOffset,
  shelfView,
} from './camera';
import { buildHitRegistry, type HitId, HOVER_SCALE, resolveClickTarget } from './hit-targets';
import {
  bubbleCount,
  bubbleSpeed,
  CORK,
  EDGES_THRESHOLD_DEG,
  hazeOpacity,
  hazeVisible,
  hazeY,
  jarRadiusAt,
  liquidLevel,
  MERIDIAN_COUNT,
  MERIDIAN_OPACITY,
  outlineOpacity,
  placeWords,
  SEAL_BASE_Y,
  sampleJarProfile,
  sealFloat,
  silhouetteBufferSize,
  solveJarSilhouette,
  WORD_BOB_AMPLITUDE,
  WORD_ORBIT_RADIUS,
  WORD_SPRITE_HEIGHT,
} from './jar';
import { createMaterials, type StudyMaterials, type StudyTheme } from './materials';
import {
  isPlanDone,
  pageProgress,
  planBackToStudy,
  planFor,
  progressOf,
  type TransitionPlan,
} from './transitions';

export interface StudySceneOptions {
  container: HTMLElement;
  state: StudyState;
  layout: StudyLayout;
  theme: StudyTheme;
  reducedMotion: boolean;
  /** ホバーが変わったとき（PC のラベル濃度とカーソル）。 */
  onHoverChange?: (hovered: HoverInfo | null) => void;
  /** 3D の物が押されたとき。 */
  onPick?: (target: StudyTarget) => void;
  /** ラベルを毎フレーム貼り直すための画面座標。 */
  onLabelPositions?: (positions: LabelPositions) => void;
}

export interface HoverInfo {
  label: 'jar' | 'journal' | 'board' | 'archive' | null;
  month: string | null;
  /** ツールチップを出す画面座標。 */
  screen: { x: number; y: number };
}

export interface LabelPositions {
  jar: ScreenPoint | null;
  journal: ScreenPoint | null;
  board: ScreenPoint | null;
  archive: ScreenPoint | null;
}

interface ScreenPoint {
  x: number;
  y: number;
  /** カメラの後ろに回ったら false。 */
  visible: boolean;
}

export interface StudySceneHandle {
  /** 対象へカメラを動かす。**着いてから** resolve する。 */
  goTo(target: StudyTarget): Promise<void>;
  /** 書斎へ戻す。 */
  returnHome(): Promise<void>;
  /** マウス位置（-1..1）。パララックスとホバーに使う。 */
  setPointer(x: number, y: number): void;
  /** ポインタが canvas から外れた。 */
  clearPointer(): void;
  /** クリック。`hovered` に頼らずその場で拾い直す。 */
  pick(): void;
  /** 遷移中・サブ画面ではラベルを消す。 */
  isBusy(): boolean;
  dispose(): void;
}

/** 秒。四方の計算で使う。 */
const MS_PER_SECOND = 1000;

/** 輪郭の呼吸の周期（ms）。 */
const OUTLINE_BREATH_MS = 4000;

export function initScene(options: StudySceneOptions): StudySceneHandle {
  const { container, state, layout, theme } = options;

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

  const materials = createMaterials(theme);
  /** 破棄すべきジオメトリ。素材は materials がまとめて持つ。 */
  const geometries: BufferGeometry[] = [];
  const textures: CanvasTexture[] = [];

  function ownGeometry<T extends BufferGeometry>(geometry: T): T {
    geometries.push(geometry);
    return geometry;
  }

  const notebooks = layoutNotebooks(state.notebooks, state.now);
  const completed = state.fermentation.status === 'completed';
  const letter = state.fermentation.letters[0] ?? null;

  const registry = buildHitRegistry({
    desk: notebooks.desk.map((placement) => placement.notebook),
    shelf: notebooks.shelf,
    hasLetter: completed && letter !== null,
    shelfAsSingleTarget: layout.pillOffsets !== null,
  });

  // ---- 物を組む ----------------------------------------------------------

  const deskGroup = buildDesk(layout, materials, ownGeometry);
  scene.add(deskGroup);

  const floorGroup = buildFloorGrid(layout, materials, ownGeometry);
  scene.add(floorGroup);

  const jar = buildJar(state, layout, materials, ownGeometry, textures);
  scene.add(jar.group);

  const seal = completed && letter !== null ? buildSeal(layout, materials, ownGeometry) : null;
  if (seal) scene.add(seal.group);

  const books = buildBooks(notebooks, layout, materials, ownGeometry, textures);
  scene.add(books.group);

  const board = buildBoard(state, layout, materials, ownGeometry);
  scene.add(board.group);

  const hitboxes = buildHitboxes({
    layout,
    materials,
    ownGeometry,
    desk: books.deskPlacements,
    shelf: books.shelfSpines,
    hasSeal: seal !== null,
    shelfAsSingleTarget: layout.pillOffsets !== null,
  });
  for (const hitbox of hitboxes) scene.add(hitbox);

  // ---- 状態 --------------------------------------------------------------

  const pointer = new Vector2(0, 0);
  let pointerInside = false;
  const raycaster = new Raycaster();

  let hoveredId: HitId | null = null;
  let hoveredObject: Object3D | null = null;

  const parallax = { x: 0, y: 0 };

  /** 遷移の状態。`null` ならホーム。 */
  let transition: {
    plan: TransitionPlan;
    from: CameraView;
    to: CameraView;
    target: StudyTarget;
    startedAt: number;
    resolve: () => void;
  } | null = null;

  /** 遷移が終わって留まっている view（サブ画面に入っている間）。 */
  let settled: CameraView | null = null;

  let frame = 0;
  let startedAt = performance.now();

  const homeCamera = homeView(layout);
  applyView(camera, homeCamera);

  // ---- 動かす ------------------------------------------------------------

  function tick(): void {
    frame = requestAnimationFrame(tick);
    const now = performance.now();
    const elapsed = now - startedAt;

    updateCamera(now, elapsed);
    updateJar(elapsed);
    updateSeal(elapsed);
    updateHover();
    reportLabels();

    renderer.render(scene, camera);
  }

  function updateCamera(now: number, elapsed: number): void {
    if (transition) {
      const view = viewAtTransition(transition, now);
      applyView(camera, view);
      // 手帳は表紙とページが遅れて開く。
      updateOpening(transition, now);
      if (isPlanDone(transition.plan, now - transition.startedAt)) {
        settled = transition.to;
        const resolve = transition.resolve;
        transition = null;
        resolve();
      }
      return;
    }

    if (settled) {
      // サブ画面に入っている間は動かさない。
      applyView(camera, settled);
      return;
    }

    // ホームだけ呼吸とパララックスが乗る。**遷移中と遷移待ちの間は乗せない** —
    // tween 完了直後に揺らぎが復帰すると y が一段跳ぶ（着地がカクッと見える原因）。
    const wanted = pointerInside
      ? parallaxOffset(layout, { x: pointer.x, y: pointer.y })
      : { x: 0, y: 0 };
    const lerp = layout.parallax?.lerp ?? 0;
    parallax.x += (wanted.x - parallax.x) * lerp;
    parallax.y += (wanted.y - parallax.y) * lerp;

    camera.position.set(
      homeCamera.position.x + parallax.x,
      homeCamera.position.y + parallax.y + breathOffset(elapsed),
      homeCamera.position.z,
    );
    camera.lookAt(homeCamera.target.x, homeCamera.target.y, homeCamera.target.z);
  }

  function viewAtTransition(active: NonNullable<typeof transition>, now: number): CameraView {
    const elapsed = now - active.startedAt;
    const kind = active.target.kind;

    if (kind === 'journal-new' || kind === 'journal-month') {
      const topY = layout.desk.y + stackTopY(notebooks.desk);
      const top = journalTopView(layout, topY);
      const spread = journalSpreadView(layout, topY);
      const toTop = progressOf(active.plan, 'journal-top', elapsed);
      const toSpread = progressOf(active.plan, 'spread-in', elapsed);
      return lerpView(lerpView(active.from, top, toTop), spread, toSpread);
    }

    if (kind === 'board') {
      const front = boardView(layout);
      const close = boardCloseView(layout);
      const toFront = progressOf(active.plan, 'board-front', elapsed);
      const toClose = progressOf(active.plan, 'board-close', elapsed);
      // SP だけ第 2 段がある。並走して瓶を消す。
      const fade = progressOf(active.plan, 'jar-fade', elapsed);
      if (active.plan.steps.some((step) => step.name === 'jar-fade')) setJarOpacity(1 - fade);
      return lerpView(lerpView(active.from, front, toFront), close, toClose);
    }

    if (kind === 'archive') {
      const to = shelfView(layout);
      return lerpView(active.from, to, progressOf(active.plan, 'shelf-pan', elapsed));
    }

    const to = jarView(layout);
    return lerpView(active.from, to, progressOf(active.plan, 'jar-pan', elapsed));
  }

  /** 手帳が開く。表紙とページの角度を進める。 */
  function updateOpening(active: NonNullable<typeof transition>, now: number): void {
    const kind = active.target.kind;
    if (kind !== 'journal-new' && kind !== 'journal-month') return;
    const elapsed = now - active.startedAt;

    // 傾きを 0 に戻すのは真上へ寄るのと並走。
    const flatten = progressOf(active.plan, 'journal-flatten', elapsed);
    books.group.rotation.y = books.baseRotationY * (1 - flatten);

    const cover = active.plan.steps.find((step) => step.name === 'cover-open');
    if (!cover || !books.topCover) return;
    const open = progressOf(active.plan, 'cover-open', elapsed);
    books.topCover.rotation.z = -COVER_OPEN_ANGLE * open;

    books.topPages.forEach((page, index) => {
      page.rotation.z = -SPREAD_PAGES.angleAt(index) * pageProgress(cover, index, elapsed);
    });
  }

  function updateJar(elapsed: number): void {
    const readiness = state.fermentation.readiness;

    // 泡は液面まで上がったら底へ戻す。
    for (const bubble of jar.bubbles) {
      bubble.mesh.position.y += bubble.speed;
      if (bubble.mesh.position.y > jar.level) bubble.mesh.position.y = 0.2;
    }

    // 輪郭は毎フレーム解き直す。頂点バッファは一度だけ確保してある。
    updateSilhouette();

    const phase = (elapsed % OUTLINE_BREATH_MS) / OUTLINE_BREATH_MS;
    jar.silhouetteMaterial.opacity = outlineOpacity(readiness, phase) * jar.fade;

    // 言葉は上下に揺れながら周回する。
    const seconds = elapsed / MS_PER_SECOND;
    jar.words.forEach((word, index) => {
      const bob = Math.sin(seconds * 0.3 * Math.PI * 2 + index) * WORD_BOB_AMPLITUDE;
      const orbit = seconds * 0.1 * Math.PI * 2 + word.angle;
      word.sprite.position.set(
        Math.cos(orbit) * WORD_ORBIT_RADIUS,
        word.y + bob,
        Math.sin(orbit) * WORD_ORBIT_RADIUS,
      );
    });
  }

  function updateSilhouette(): void {
    const jarWorld = new Vector3();
    jar.group.getWorldPosition(jarWorld);
    const dx = camera.position.x - jarWorld.x;
    const dz = camera.position.z - jarWorld.z;

    const points = solveJarSilhouette(jar.profile, {
      horizontalDistance: Math.hypot(dx, dz),
      azimuth: Math.atan2(dx, dz),
      y: camera.position.y - jarWorld.y,
    });

    const positions = jar.silhouettePositions;
    const count = Math.min(points.length, positions.count);
    for (let i = 0; i < count; i++) {
      const point = points[i];
      positions.setXYZ(
        i,
        Math.sin(point.angle) * point.radius,
        point.y,
        Math.cos(point.angle) * point.radius,
      );
    }
    positions.needsUpdate = true;
    jar.silhouette.geometry.setDrawRange(0, count);
  }

  function updateSeal(elapsed: number): void {
    if (!seal) return;
    const float = sealFloat(elapsed / MS_PER_SECOND);
    seal.group.position.y = layout.jar.y + SEAL_BASE_Y + float.yOffset;
    seal.group.rotation.z = float.rotationZ;
  }

  /**
   * 瓶（瓶体・中身・コルク・封・輪郭線）の不透明度をまとめて動かす。
   *
   * 素材は `initScene` の中で専用インスタンスに clone してある。共有したまま触ると
   * 机やボードまで一緒に消える。
   */
  function setJarOpacity(value: number): void {
    jar.fade = value;
    for (const owned of jar.fadeables) {
      owned.material.opacity = owned.baseOpacity * value;
      owned.material.transparent = true;
    }
    const hidden = value <= 0.02;
    jar.group.visible = !hidden;
    if (seal) seal.group.visible = !hidden;
  }

  function updateHover(): void {
    if (transition || settled || !pointerInside) {
      setHovered(null, null);
      return;
    }
    const hit = raycast();
    setHovered(hit.id, hit.object);
  }

  function raycast(): { id: HitId | null; object: Object3D | null } {
    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(hitboxes, false);
    const first = intersects[0];
    if (!first) return { id: null, object: null };
    const hitId = first.object.userData.hitId;
    if (typeof hitId !== 'string') return { id: null, object: null };
    return { id: hitId, object: first.object };
  }

  function setHovered(id: HitId | null, object: Object3D | null): void {
    if (id === hoveredId) return;

    // ホバーは scale とカーソルだけ。色は変えない。
    if (hoveredObject) hoveredObject.scale.setScalar(1);
    hoveredId = id;
    hoveredObject = object;
    if (hoveredObject) hoveredObject.scale.setScalar(HOVER_SCALE);

    renderer.domElement.style.cursor = id ? 'pointer' : 'default';

    const entry = registry.get(id);
    options.onHoverChange?.(
      entry
        ? { label: entry.label, month: entry.month, screen: projectHover(hoveredObject) }
        : null,
    );
  }

  function projectHover(object: Object3D | null): { x: number; y: number } {
    if (!object) return { x: 0, y: 0 };
    const world = new Vector3();
    object.getWorldPosition(world);
    // ツールチップは対象の少し上に出す。
    world.y += 0.85;
    const point = toScreen(world);
    return { x: point.x, y: point.y };
  }

  function reportLabels(): void {
    if (!options.onLabelPositions) return;
    // サブ画面と遷移中はラベルを消す。
    if (transition || settled) {
      options.onLabelPositions({ jar: null, journal: null, board: null, archive: null });
      return;
    }
    const anchors = layout.labelAnchors;
    options.onLabelPositions({
      jar: toScreen(new Vector3(anchors.jar.x, anchors.jar.y, anchors.jar.z)),
      journal: toScreen(new Vector3(anchors.journal.x, anchors.journal.y, anchors.journal.z)),
      board: toScreen(new Vector3(anchors.board.x, anchors.board.y, anchors.board.z)),
      archive: anchors.archive
        ? toScreen(new Vector3(anchors.archive.x, anchors.archive.y, anchors.archive.z))
        : null,
    });
  }

  /**
   * world 座標を canvas の画面座標へ。
   *
   * 透視スケールはかけない（注釈は UI の側であって、遠近で小さくならない）。
   */
  function toScreen(world: Vector3): ScreenPoint {
    const projected = world.clone().project(camera);
    return {
      x: ((projected.x + 1) / 2) * container.clientWidth,
      y: ((1 - projected.y) / 2) * container.clientHeight,
      visible: projected.z < 1,
    };
  }

  // ---- 入力 --------------------------------------------------------------

  function setPointer(x: number, y: number): void {
    pointer.set(x, y);
    pointerInside = true;
  }

  function clearPointer(): void {
    pointerInside = false;
    setHovered(null, null);
  }

  function pick(): void {
    if (transition || settled) return;
    // タッチでは pointermove が click より先に来ないことがある。その場で拾い直す。
    const id = resolveClickTarget(hoveredId, () => raycast().id);
    const entry = registry.get(id);
    if (!entry) return;

    // 封は手紙の id を載せて渡す。
    const target: StudyTarget =
      id === 'seal' && letter
        ? { kind: 'letter', fermentationId: letter.fermentationId, questionId: letter.questionId }
        : entry.target;
    options.onPick?.(target);
  }

  function goTo(target: StudyTarget): Promise<void> {
    if (transition) transition.resolve();
    const from = currentView();
    const plan = planFor(target, {
      reducedMotion: options.reducedMotion,
      // SP だけ 2 段構え。PC は俯瞰から正対するので瓶が視界に入らない。
      twoStageBoard: layout.pillOffsets !== null && target.kind === 'board',
    });

    return new Promise<void>((resolve) => {
      transition = {
        plan,
        from,
        to: destinationView(target),
        target,
        startedAt: performance.now(),
        resolve,
      };
    });
  }

  function returnHome(): Promise<void> {
    const from = currentView();
    const plan = planBackToStudy(options.reducedMotion);
    setJarOpacity(1);
    // 手帳の表紙と傾きを元に戻す。
    books.group.rotation.y = books.baseRotationY;
    if (books.topCover) books.topCover.rotation.z = 0;
    for (const page of books.topPages) page.rotation.z = 0;

    return new Promise<void>((resolve) => {
      settled = null;
      transition = {
        plan,
        from,
        to: homeCamera,
        target: { kind: 'jar' },
        startedAt: performance.now(),
        resolve: () => {
          settled = null;
          startedAt = performance.now();
          resolve();
        },
      };
    });
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

  function destinationView(target: StudyTarget): CameraView {
    switch (target.kind) {
      case 'jar':
      case 'letter':
        return jarView(layout);
      case 'journal-new':
      case 'journal-month':
        return journalSpreadView(layout, layout.desk.y + stackTopY(notebooks.desk));
      case 'archive':
        return shelfView(layout);
      case 'board':
        return layout.pillOffsets !== null ? boardCloseView(layout) : boardView(layout);
    }
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

  // ---- 片付け ------------------------------------------------------------

  function dispose(): void {
    // ここを怠ると再マウントで canvas が積み上がり、古い層のイベントだけが生き残る。
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();

    for (const geometry of geometries) geometry.dispose();
    for (const texture of textures) texture.dispose();
    materials.dispose();
    jar.disposeFadeables();

    renderer.dispose();
    // renderer.domElement を含め、コンテナを空にする。
    while (container.firstChild) container.removeChild(container.firstChild);
    registry.clear();
  }

  return {
    goTo,
    returnHome,
    setPointer,
    clearPointer,
    pick,
    isBusy: () => transition !== null || settled !== null,
    dispose,
  };
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

function lineFrom(points: Vector3[], material: Material, own: OwnGeometry): Line {
  const geometry = own(new BufferGeometry().setFromPoints(points));
  return new Line(geometry, material);
}

/**
 * 机の天板。表現は最小限 — 輪郭・手前の木端・前脚 2 本・木目を示唆する 1 本だけ。
 * 木端をここだけ濃く引くと、平面が板に見える。
 */
function buildDesk(layout: StudyLayout, materials: StudyMaterials, own: OwnGeometry): Group {
  const group = new Group();
  const { y, halfWidth, zNear, zFar } = layout.deskTop;

  group.add(
    lineFrom(
      [
        new Vector3(-halfWidth, y, zNear),
        new Vector3(halfWidth, y, zNear),
        new Vector3(halfWidth, y, zFar),
        new Vector3(-halfWidth, y, zFar),
        new Vector3(-halfWidth, y, zNear),
      ],
      materials.faint(0.13),
      own,
    ),
  );

  // 手前の木端（厚み 0.16）。ここだけ濃い。
  const edgeBottom = y - 0.16;
  group.add(
    lineFrom(
      [
        new Vector3(-halfWidth, y, zNear),
        new Vector3(-halfWidth, edgeBottom, zNear),
        new Vector3(halfWidth, edgeBottom, zNear),
        new Vector3(halfWidth, y, zNear),
      ],
      materials.faint(0.34),
      own,
    ),
  );

  // 前脚 2 本。床まで伸ばす。
  for (const x of [-halfWidth + 0.5, halfWidth - 0.5]) {
    group.add(
      lineFrom(
        [new Vector3(x, edgeBottom, zNear - 0.2), new Vector3(x, layout.floorY, zNear - 0.2)],
        materials.faint(0.2),
        own,
      ),
    );
  }

  // 木目を示唆する長い 1 本。
  group.add(
    lineFrom(
      [new Vector3(-halfWidth + 0.8, y, zFar + 1.2), new Vector3(halfWidth - 0.8, y, zFar + 1.6)],
      materials.faint(0.06),
      own,
    ),
  );

  // 奥の壁の立ち上がり。
  for (const x of [-halfWidth, halfWidth]) {
    group.add(
      lineFrom([new Vector3(x, y, zFar), new Vector3(x, y + 4, zFar)], materials.faint(0.07), own),
    );
  }

  return group;
}

function buildFloorGrid(layout: StudyLayout, materials: StudyMaterials, own: OwnGeometry): Group {
  const group = new Group();
  const half = 10;
  const step = 1;
  const points: Vector3[] = [];
  for (let i = -half; i <= half; i += step) {
    points.push(new Vector3(-half, layout.floorY, i), new Vector3(half, layout.floorY, i));
    points.push(new Vector3(i, layout.floorY, -half), new Vector3(i, layout.floorY, half));
  }
  const geometry = own(new BufferGeometry().setFromPoints(points));
  group.add(new LineSegments(geometry, materials.grid));
  return group;
}

interface FadeableMaterial {
  material: Material & { opacity: number; transparent: boolean };
  baseOpacity: number;
}

interface JarParts {
  group: Group;
  profile: Vector2[];
  level: number;
  bubbles: { mesh: Mesh; speed: number }[];
  words: { sprite: Sprite; y: number; angle: number }[];
  silhouette: Line;
  silhouettePositions: BufferAttribute;
  silhouetteMaterial: Material & { opacity: number };
  fadeables: FadeableMaterial[];
  fade: number;
  disposeFadeables(): void;
}

function buildJar(
  state: StudyState,
  layout: StudyLayout,
  materials: StudyMaterials,
  own: OwnGeometry,
  textures: CanvasTexture[],
): JarParts {
  const group = new Group();
  group.position.set(layout.jar.x, layout.jar.y, layout.jar.z);

  const profile = sampleJarProfile();
  const readiness = state.fermentation.readiness;
  const completed = state.fermentation.status === 'completed';
  const level = liquidLevel(readiness);

  // 瓶の素材は専用インスタンスに clone する。共有したまま不透明度を触ると
  // 机やボードまで一緒に消える。
  const fadeables: FadeableMaterial[] = [];
  function fadeable<T extends Material & { opacity: number; transparent: boolean }>(source: T): T {
    const cloned = source.clone();
    fadeables.push({ material: cloned, baseOpacity: cloned.opacity });
    return cloned;
  }

  // 瓶体（不透明。奥のボードは透けない）。
  const bodyGeometry = own(new LatheGeometry(profile, 72));
  const bodyMaterial = fadeable(materials.solid.clone());
  group.add(new Mesh(bodyGeometry, bodyMaterial));

  // 稜線。しきい値 45° で口縁とコルクの角だけが残る（底・胴・首に横線が出ない）。
  const edges = own(new EdgesGeometry(bodyGeometry, EDGES_THRESHOLD_DEG));
  group.add(new LineSegments(edges, fadeable(materials.ink.clone())));

  // 経線 8 本。緯線リングは置かない。
  const meridianMaterial = fadeable(materials.faint(MERIDIAN_OPACITY).clone());
  for (let i = 0; i < MERIDIAN_COUNT; i++) {
    const angle = (i / MERIDIAN_COUNT) * Math.PI * 2;
    const points = profile.map(
      (point) => new Vector3(Math.sin(angle) * point.x, point.y, Math.cos(angle) * point.x),
    );
    group.add(lineFrom(points, meridianMaterial, own));
  }

  // 真の輪郭。毎フレーム解き直すので、頂点は一度だけ確保して setDrawRange で使う。
  const capacity = silhouetteBufferSize(profile.length);
  const silhouetteGeometry = own(new BufferGeometry());
  const silhouettePositions = new BufferAttribute(new Float32Array(capacity * 3), 3);
  silhouetteGeometry.setAttribute('position', silhouettePositions);
  const silhouetteMaterial = fadeable(materials.xray(1).clone());
  const silhouette = new LineLoop(silhouetteGeometry, silhouetteMaterial);
  // 頂点を毎フレーム書き換えるので、既定の bounding sphere は当てにならない。
  silhouette.frustumCulled = false;
  silhouette.renderOrder = 5;
  group.add(silhouette);

  // コルク。塗りはクリーム（テラコッタは使わない）。
  const corkGeometry = own(
    new CylinderGeometry(CORK.radiusTop, CORK.radiusBottom, CORK.height, CORK.segments),
  );
  const cork = new Mesh(corkGeometry, fadeable(materials.cork.clone()));
  cork.position.y = CORK.y;
  group.add(cork);
  group.add(
    new LineSegments(
      own(new EdgesGeometry(corkGeometry, EDGES_THRESHOLD_DEG)),
      fadeable(materials.ink.clone()),
    ).translateY(CORK.y),
  );

  // 液面（瓶の内径に沿ったリング）。
  const levelRadius = jarRadiusAt(profile, level);
  const ringGeometry = own(new RingGeometry(levelRadius * 0.92, levelRadius * 0.96, 48));
  const ring = new Mesh(ringGeometry, fadeable(materials.xray(0.3).clone()));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = level;
  group.add(ring);

  // 泡。
  const bubbles: { mesh: Mesh; speed: number }[] = [];
  const bubbleGeometry = own(new RingGeometry(0.03, 0.045, 10));
  const bubbleMaterial = fadeable(materials.xray(0.35).clone());
  const count = bubbleCount(readiness, completed);
  for (let i = 0; i < count; i++) {
    const mesh = new Mesh(bubbleGeometry, bubbleMaterial);
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * levelRadius * 0.7;
    mesh.position.set(Math.cos(angle) * radius, Math.random() * level, Math.sin(angle) * radius);
    group.add(mesh);
    bubbles.push({ mesh, speed: bubbleSpeed(readiness, completed, Math.random()) });
  }

  // 漂う言葉。液面までの高さを実際の語数で割って並べる。
  const words: { sprite: Sprite; y: number; angle: number }[] = [];
  for (const placement of placeWords(state.words, level)) {
    const texture = createTextTexture(placement.word);
    if (!texture) continue;
    textures.push(texture);
    const material = materials.sprite(texture, 0.5);
    fadeables.push({ material, baseOpacity: 0.5 });
    const sprite = new Sprite(material);
    // 幅は文字幅の実測から決める（全語同幅にしない）。
    sprite.scale.set(
      (texture.image.width / texture.image.height) * WORD_SPRITE_HEIGHT,
      WORD_SPRITE_HEIGHT,
      1,
    );
    sprite.position.y = placement.y;
    group.add(sprite);
    words.push({ sprite, y: placement.y, angle: placement.angle });
  }

  // 上部のもや。
  if (hazeVisible(readiness)) {
    const texture = createHazeTexture();
    if (texture) {
      textures.push(texture);
      const material = materials.sprite(texture, hazeOpacity(readiness));
      fadeables.push({ material, baseOpacity: hazeOpacity(readiness) });
      const haze = new Sprite(material);
      haze.scale.set(1.5, 1.2, 1);
      haze.position.y = hazeY(level);
      group.add(haze);
    }
  }

  return {
    group,
    profile,
    level,
    bubbles,
    words,
    silhouette,
    silhouettePositions,
    silhouetteMaterial,
    fadeables,
    fade: 1,
    disposeFadeables(): void {
      for (const owned of fadeables) owned.material.dispose();
    },
  };
}

function buildSeal(
  layout: StudyLayout,
  materials: StudyMaterials,
  own: OwnGeometry,
): { group: Group } {
  const group = new Group();
  group.position.set(layout.seal.x, layout.jar.y + SEAL_BASE_Y, layout.seal.z);
  group.rotation.x = -0.5;

  const points = [
    new Vector3(-0.55, 0, -0.36),
    new Vector3(0.55, 0, -0.36),
    new Vector3(0.55, 0, 0.36),
    new Vector3(-0.55, 0, 0.36),
    new Vector3(-0.55, 0, -0.36),
  ];
  group.add(lineFrom(points, materials.ink, own));
  // 封緘の折り目。
  group.add(
    lineFrom(
      [new Vector3(-0.55, 0, -0.36), new Vector3(0, 0, 0.1), new Vector3(0.55, 0, -0.36)],
      materials.faint(0.4),
      own,
    ),
  );
  return { group };
}

interface BooksParts {
  group: Group;
  baseRotationY: number;
  topCover: Group | null;
  topPages: Group[];
  deskPlacements: { group: Group; topY: number; thickness: number }[];
  shelfSpines: Group[];
}

function buildBooks(
  notebooks: ReturnType<typeof layoutNotebooks>,
  layout: StudyLayout,
  materials: StudyMaterials,
  own: OwnGeometry,
  textures: CanvasTexture[],
): BooksParts {
  const group = new Group();
  group.position.set(layout.desk.x, layout.desk.y, layout.desk.z);
  const baseRotationY = -0.15;
  group.rotation.y = baseRotationY;

  const halfW = NOTEBOOK_SIZE.width / 2;
  const halfD = NOTEBOOK_SIZE.depth / 2;

  const deskPlacements: { group: Group; topY: number; thickness: number }[] = [];
  let topCover: Group | null = null;
  const topPages: Group[] = [];

  notebooks.desk.forEach((placement, index) => {
    const book = new Group();
    book.position.y = placement.baseY;

    // 表紙の輪郭。
    book.add(
      lineFrom(
        [
          new Vector3(-halfW, placement.thickness, -halfD),
          new Vector3(halfW, placement.thickness, -halfD),
          new Vector3(halfW, placement.thickness, halfD),
          new Vector3(-halfW, placement.thickness, halfD),
          new Vector3(-halfW, placement.thickness, -halfD),
        ],
        materials.faint(0.4),
        own,
      ),
    );

    // 束は表紙より小さく作る（表紙がわずかに出ることで箱に見えない）。
    const blockW = halfW - BLOCK_INSET;
    const blockD = halfD - BLOCK_INSET;
    const lines = edgeLineCount(placement.thickness);
    for (let i = 0; i < lines; i++) {
      const t = (i + 1) / (lines + 1);
      const y = placement.thickness * t;
      const jitter = (i % 3) * EDGE_LINE_JITTER;
      const opacity = EDGE_LINE_OPACITIES[i % 2];
      const material = materials.faint(opacity);
      // 小口・天・地の三方。クオータービューでどの角度からでも断面が見える。
      book.add(
        lineFrom(
          [new Vector3(blockW - jitter, y, -blockD), new Vector3(blockW - jitter, y, blockD)],
          material,
          own,
        ),
      );
      book.add(
        lineFrom(
          [new Vector3(-blockW, y, blockD - jitter), new Vector3(blockW, y, blockD - jitter)],
          material,
          own,
        ),
      );
      book.add(
        lineFrom(
          [new Vector3(-blockW, y, -blockD + jitter), new Vector3(blockW, y, -blockD + jitter)],
          material,
          own,
        ),
      );
    }

    // 表紙のラベル枠。
    const lw = COVER_LABEL.width / 2;
    const lh = COVER_LABEL.height / 2;
    book.add(
      lineFrom(
        [
          new Vector3(-lw, placement.thickness + 0.001, -lh),
          new Vector3(lw, placement.thickness + 0.001, -lh),
          new Vector3(lw, placement.thickness + 0.001, lh),
          new Vector3(-lw, placement.thickness + 0.001, lh),
          new Vector3(-lw, placement.thickness + 0.001, -lh),
        ],
        materials.faint(COVER_LABEL.opacity),
        own,
      ),
    );

    // 当月だけが開く表紙とページを持つ。
    if (index === 0) {
      const cover = new Group();
      cover.position.set(COVER_HINGE_X, placement.thickness + COVER_THICKNESS, 0);
      cover.add(
        lineFrom(
          [
            new Vector3(0, 0, -halfD),
            new Vector3(NOTEBOOK_SIZE.width, 0, -halfD),
            new Vector3(NOTEBOOK_SIZE.width, 0, halfD),
            new Vector3(0, 0, halfD),
            new Vector3(0, 0, -halfD),
          ],
          materials.faint(0.45),
          own,
        ),
      );
      book.add(cover);
      topCover = cover;

      for (let i = 0; i < SPREAD_PAGES.count; i++) {
        const page = new Group();
        page.position.set(
          COVER_HINGE_X,
          placement.thickness + 0.002 + i * SPREAD_PAGES.thickness,
          0,
        );
        for (let r = 0; r < RULES.spreadCount; r++) {
          const z = -halfD + (r + 1) * RULES.spreadSpacing;
          page.add(
            lineFrom(
              [new Vector3(0.2, 0, z), new Vector3(NOTEBOOK_SIZE.width - 0.2, 0, z)],
              materials.faint(RULES.spreadOpacity),
              own,
            ),
          );
        }
        book.add(page);
        topPages.push(page);
      }
    }

    group.add(book);
    deskPlacements.push({
      group: book,
      topY: placement.baseY + placement.thickness,
      thickness: placement.thickness,
    });
  });

  // ペンは手帳の右脇に単体で寝かせる。本の輪郭に重なると軸だけが見えて何か分からなくなる。
  group.add(buildPen(layout, materials, own));

  // 奥の棚。
  const shelfGroup = new Group();
  shelfGroup.position.set(
    layout.shelf.position.x - layout.desk.x,
    layout.shelf.position.y - layout.desk.y + (layout.shelf.tiltX !== 0 ? 0.22 : 0),
    layout.shelf.position.z - layout.desk.z,
  );
  shelfGroup.rotation.y = -0.35 - baseRotationY;
  shelfGroup.rotation.x = layout.shelf.tiltX;
  shelfGroup.scale.setScalar(layout.shelf.scale);

  // 棚の躯体（2.6 × 1.7 × 1.1）。これが無いと背表紙が宙に浮いて見える。
  // 側板・棚板・奥の見切りだけの最小限で、箱として閉じない（線が増えると机と競合する）。
  const shelfW = 2.6 / 2;
  const shelfH = 1.7;
  const shelfD = 1.1 / 2;
  for (const x of [-shelfW, shelfW]) {
    shelfGroup.add(
      lineFrom(
        [
          new Vector3(x, 0, shelfD),
          new Vector3(x, shelfH, shelfD),
          new Vector3(x, shelfH, -shelfD),
          new Vector3(x, 0, -shelfD),
        ],
        materials.faint(0.28),
        own,
      ),
    );
  }
  for (const y of [0, shelfH]) {
    shelfGroup.add(
      lineFrom(
        [
          new Vector3(-shelfW, y, shelfD),
          new Vector3(shelfW, y, shelfD),
          new Vector3(shelfW, y, -shelfD),
          new Vector3(-shelfW, y, -shelfD),
          new Vector3(-shelfW, y, shelfD),
        ],
        materials.faint(y === 0 ? 0.32 : 0.22),
        own,
      ),
    );
  }

  const shelfSpines: Group[] = [];
  const offsets = shelfSpineOffsets(notebooks.shelf.length);
  notebooks.shelf.forEach((notebook, index) => {
    const spine = new Group();
    spine.position.x = offsets[index];
    const thickness = 0.22;
    const height = 1.4;
    spine.add(
      lineFrom(
        [
          new Vector3(-thickness / 2, 0, 0),
          new Vector3(thickness / 2, 0, 0),
          new Vector3(thickness / 2, height, 0),
          new Vector3(-thickness / 2, height, 0),
          new Vector3(-thickness / 2, 0, 0),
        ],
        materials.faint(0.35),
        own,
      ),
    );

    // 背表紙には年月を刷る。棚が「本が並んでいる場所」だと一目で分かる。
    const texture = createTextTexture(spineLabelText(notebook.month), SPINE_LABEL.fontPx);
    if (texture) {
      textures.push(texture);
      const sprite = new Sprite(materials.sprite(texture, SPINE_LABEL.opacity));
      const width = thickness * SPINE_LABEL.fitRatio;
      sprite.scale.set(width, width * (texture.image.height / texture.image.width), 1);
      sprite.position.set(0, height / 2, 0.01);
      spine.add(sprite);
    }

    shelfGroup.add(spine);
    shelfSpines.push(spine);
  });
  group.add(shelfGroup);

  return { group, baseRotationY, topCover, topPages, deskPlacements, shelfSpines };
}

/** 胴＋ペン先の円錐＋バンド 2 本。線画でもペンとして読める最小の構成。 */
function buildPen(layout: StudyLayout, materials: StudyMaterials, own: OwnGeometry): Group {
  const pen = new Group();
  pen.position.set(layout.pen.x, layout.pen.y, layout.pen.z);
  pen.rotation.x = Math.PI / 2;
  pen.rotation.y = 0.3;

  const bodyGeometry = own(new CylinderGeometry(0.055, 0.055, 1.9, 12));
  pen.add(new LineSegments(own(new EdgesGeometry(bodyGeometry, 30)), materials.faint(0.35)));

  const tipGeometry = own(new CylinderGeometry(0.055, 0.004, 0.34, 12));
  const tip = new Mesh(tipGeometry, materials.solid);
  tip.position.y = -(1.9 / 2 + 0.34 / 2);
  pen.add(tip);
  pen.add(
    new LineSegments(own(new EdgesGeometry(tipGeometry, 30)), materials.faint(0.35)).translateY(
      -(1.9 / 2 + 0.34 / 2),
    ),
  );

  for (const y of [0.4, 0.55]) {
    const bandGeometry = own(new CylinderGeometry(0.058, 0.058, 0.02, 12));
    pen.add(
      new LineSegments(own(new EdgesGeometry(bandGeometry, 30)), materials.faint(0.3)).translateY(
        y,
      ),
    );
  }
  return pen;
}

function buildBoard(
  state: StudyState,
  layout: StudyLayout,
  materials: StudyMaterials,
  own: OwnGeometry,
): { group: Group } {
  const group = new Group();
  group.position.set(layout.board.position.x, layout.board.position.y, layout.board.position.z);
  group.scale.setScalar(layout.board.scale);

  const halfW = BOARD_FACE.width / 2;
  const halfH = BOARD_FACE.height / 2;

  group.add(
    lineFrom(
      [
        new Vector3(-halfW, -halfH, 0),
        new Vector3(halfW, -halfH, 0),
        new Vector3(halfW, halfH, 0),
        new Vector3(-halfW, halfH, 0),
        new Vector3(-halfW, -halfH, 0),
      ],
      materials.faint(0.3),
      own,
    ),
  );

  // 板の格子。
  for (let x = -halfW + BOARD_GRID_SPACING; x < halfW; x += BOARD_GRID_SPACING) {
    group.add(
      lineFrom([new Vector3(x, -halfH, 0), new Vector3(x, halfH, 0)], materials.faint(0.06), own),
    );
  }
  for (let y = -halfH + BOARD_GRID_SPACING; y < halfH; y += BOARD_GRID_SPACING) {
    group.add(
      lineFrom([new Vector3(-halfW, y, 0), new Vector3(halfW, y, 0)], materials.faint(0.06), own),
    );
  }

  // カードは board 画面と同じ位置・回転・サイズ・重なり順で貼る。
  for (const placed of placeBoardCards(state.board.cards)) {
    const card = new Group();
    card.position.set(placed.x, placed.y, placed.z);
    card.rotation.z = placed.rotationZ;

    const w = placed.width / 2;
    const h = placed.height / 2;

    card.add(
      lineFrom(
        [
          new Vector3(-w, -h, 0),
          new Vector3(w, -h, 0),
          new Vector3(w, h, 0),
          new Vector3(-w, h, 0),
          new Vector3(-w, -h, 0),
        ],
        materials.faint(0.4),
        own,
      ),
    );

    if (placed.card.cardType === 'photo') {
      // 写真は内枠 1 本だけ。
      const iw = w - PHOTO_INNER_INSET;
      const ih = h - PHOTO_INNER_INSET;
      card.add(
        lineFrom(
          [
            new Vector3(-iw, -ih, 0.001),
            new Vector3(iw, -ih, 0.001),
            new Vector3(iw, ih, 0.001),
            new Vector3(-iw, ih, 0.001),
            new Vector3(-iw, -ih, 0.001),
          ],
          materials.faint(0.2),
          own,
        ),
      );
    } else {
      // snippet は罫線 n 本。本文そのものは書斎に出さない。
      for (let i = 0; i < placed.lines; i++) {
        const t = (i + 1) / (placed.lines + 1);
        const y = h - placed.height * t;
        card.add(
          lineFrom(
            [new Vector3(-w * 0.8, y, 0.001), new Vector3(w * 0.8, y, 0.001)],
            materials.faint(0.22),
            own,
          ),
        );
      }
    }

    group.add(card);
  }

  return { group };
}

/**
 * 当たり判定は見た目のメッシュではなく**不可視のヒットボックス**で取る。
 * 線だけの物はレイキャストに引っかからないため。
 */
function buildHitboxes(options: {
  layout: StudyLayout;
  materials: StudyMaterials;
  ownGeometry: OwnGeometry;
  desk: { group: Group; topY: number; thickness: number }[];
  shelf: Group[];
  hasSeal: boolean;
  shelfAsSingleTarget: boolean;
}): Mesh[] {
  const { layout, materials, ownGeometry } = options;
  const boxes: Mesh[] = [];

  function box(
    id: HitId,
    size: [number, number, number],
    position: Vector3,
    parent?: Object3D,
  ): void {
    const mesh = new Mesh(ownGeometry(new BoxGeometry(...size)), materials.hitbox);
    mesh.position.copy(position);
    mesh.userData.hitId = id;
    if (parent) parent.add(mesh);
    boxes.push(mesh);
  }

  // 瓶は円柱で囲む。
  box('jar', [2.8, 3.4, 2.8], new Vector3(layout.jar.x, layout.jar.y + 1.5, layout.jar.z));

  if (options.hasSeal) {
    box(
      'seal',
      [1.4, 0.8, 1.0],
      new Vector3(layout.seal.x, layout.jar.y + SEAL_BASE_Y, layout.seal.z),
    );
  }

  // 机の冊はそれぞれを囲む箱。
  options.desk.forEach((placement, index) => {
    const world = new Vector3();
    placement.group.getWorldPosition(world);
    box(
      `notebook-${index}`,
      [NOTEBOOK_SIZE.width, Math.max(placement.thickness, 0.12), NOTEBOOK_SIZE.depth],
      new Vector3(world.x, world.y + placement.thickness / 2, world.z),
    );
  });

  if (options.shelfAsSingleTarget) {
    // SP は棚ごと 1 つの的。背表紙 1 本は指より細く、当たりを広げると隣の月を拾う。
    box(
      'shelf',
      [2.8, 2.0, 1.2],
      new Vector3(layout.shelf.position.x, layout.shelf.position.y + 0.9, layout.shelf.position.z),
    );
  } else {
    options.shelf.forEach((spine, index) => {
      const world = new Vector3();
      spine.getWorldPosition(world);
      box(`spine-${index}`, [0.3, 1.5, 0.4], new Vector3(world.x, world.y + 0.7, world.z));
    });
  }

  // ボードは板より 0.2 大きい箱。
  box(
    'board',
    [
      (BOARD_FACE.width + 0.2) * layout.board.scale,
      (BOARD_FACE.height + 0.2) * layout.board.scale,
      0.4,
    ],
    new Vector3(layout.board.position.x, layout.board.position.y, layout.board.position.z),
  );

  return boxes;
}

/**
 * 文字を描いたテクスチャ。幅は `measureText` の実測から決める（全語同幅にしない）。
 *
 * canvas が取れない環境（SSR・古い端末）では null を返し、呼び出し側がその語を諦める。
 */
function createTextTexture(text: string, fontPx = 48): CanvasTexture | null {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return null;

  const font = `${fontPx}px "Hiragino Mincho ProN", "Yu Mincho", serif`;
  context.font = font;
  const width = Math.ceil(context.measureText(text).width) + fontPx * 0.4;
  const height = Math.ceil(fontPx * 1.4);

  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);

  // サイズを変えると context の状態が戻るので、font はここでもう一度入れる。
  context.font = font;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#1A1918';
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/** 上部のもや。中心が濃く外へ向かって消える円。 */
function createHazeTexture(): CanvasTexture | null {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(26,25,24,0.28)');
  gradient.addColorStop(1, 'rgba(26,25,24,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);

  return new CanvasTexture(canvas);
}
