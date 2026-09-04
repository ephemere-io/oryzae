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
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  RingGeometry,
  Scene,
  SphereGeometry,
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
  notebookThickness,
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
  /** 状態を差し替えて物を組み直す。遷移中は何もしない。 */
  setState(state: StudyState): void;
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

/**
 * 状態で作り替わる部分。**renderer と camera は含めない。**
 *
 * WebGL のコンテキストはタブごとに十数個しか持てず、renderer を作り直すたびに 1 つ
 * 食う（`Too many active WebGL contexts` で実際に踏んだ）。状態が変わるたびに
 * renderer ごと捨てていたのが原因で、あわせて遷移中のカメラも巻き戻っていた。
 */
interface SceneContent {
  materials: StudyMaterials;
  geometries: BufferGeometry[];
  textures: CanvasTexture[];
  registry: ReturnType<typeof buildHitRegistry>;
  notebooks: ReturnType<typeof layoutNotebooks>;
  letter: StudyState['fermentation']['letters'][number] | null;
  groups: Object3D[];
  hitboxes: Mesh[];
  jar: JarParts;
  seal: { group: Group } | null;
  books: BooksParts;
}

export function initScene(options: StudySceneOptions): StudySceneHandle {
  const { container, layout, theme } = options;

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

  /** 物を組む。renderer と camera はそのまま使い回す。 */
  function buildContent(state: StudyState): SceneContent {
    const materials = createMaterials(theme);
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

    const deskGroup = buildDesk(layout, materials, ownGeometry);
    const floorGroup = buildFloorGrid(layout, materials, ownGeometry);
    const jar = buildJar(state, layout, materials, ownGeometry, textures);
    const seal = completed && letter !== null ? buildSeal(layout, materials, ownGeometry) : null;
    const books = buildBooks(notebooks, layout, materials, ownGeometry, textures);
    const board = buildBoard(state, layout, materials, ownGeometry);

    const groups: Object3D[] = [deskGroup, floorGroup, jar.group, books.group, board.group];
    if (seal) groups.push(seal.group);

    const hitboxes = buildHitboxes({
      layout,
      materials,
      ownGeometry,
      desk: books.deskPlacements,
      shelf: books.shelfSpines,
      hasSeal: seal !== null,
      shelfAsSingleTarget: layout.pillOffsets !== null,
      jarGroup: jar.group,
      sealGroup: seal?.group ?? null,
      shelfGroup: books.shelfGroup,
      boardGroup: board.group,
    });

    for (const group of groups) scene.add(group);
    for (const hitbox of hitboxes) scene.add(hitbox);

    return {
      materials,
      geometries,
      textures,
      registry,
      notebooks,
      letter,
      groups,
      hitboxes,
      jar,
      seal,
      books,
    };
  }

  /** 物だけを捨てる（renderer は残す）。 */
  function disposeContent(current: SceneContent): void {
    for (const group of current.groups) scene.remove(group);
    for (const hitbox of current.hitboxes) scene.remove(hitbox);
    for (const geometry of current.geometries) geometry.dispose();
    for (const texture of current.textures) texture.dispose();
    current.jar.disposeFadeables();
    current.materials.dispose();
    current.registry.clear();
  }

  /** いま描いている状態。更新時にだけ差し替える。 */
  let currentState = options.state;
  /** 遷移中に届いた更新。手が空いたら反映する。 */
  let pendingState: StudyState | null = null;
  let content = buildContent(currentState);

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

    // 遷移中に預かった更新は、手が空いた最初のフレームで反映する。
    if (pendingState !== null && transition === null && settled === null) {
      applyState(pendingState);
    }

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
      const topY = layout.desk.y + stackTopY(content.notebooks.desk);
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
    content.books.group.rotation.y = content.books.baseRotationY * (1 - flatten);

    const cover = active.plan.steps.find((step) => step.name === 'cover-open');
    if (!cover || !content.books.topCover) return;
    const open = progressOf(active.plan, 'cover-open', elapsed);
    content.books.topCover.rotation.z = -COVER_OPEN_ANGLE * open;

    content.books.topPages.forEach((page, index) => {
      page.rotation.z = -SPREAD_PAGES.angleAt(index) * pageProgress(cover, index, elapsed);
    });
  }

  function updateJar(elapsed: number): void {
    const readiness = currentState.fermentation.readiness;

    // 泡は液面まで上がったら底へ戻す。横にも少し揺らす（まっすぐ上がると機械的に見える）。
    const bubbleSeconds = elapsed / MS_PER_SECOND;
    for (const bubble of content.jar.bubbles) {
      bubble.mesh.position.y += bubble.speed;
      bubble.mesh.position.x = bubble.baseX + Math.sin(bubbleSeconds + bubble.wobble) * 0.03;
      bubble.mesh.position.z = bubble.baseZ + Math.cos(bubbleSeconds + bubble.wobble) * 0.03;
      if (bubble.mesh.position.y > content.jar.level) {
        bubble.mesh.position.y = 0.05;
        bubble.baseX = (Math.random() - 0.5) * 0.6;
        bubble.baseZ = (Math.random() - 0.5) * 0.6;
      }
    }

    // 輪郭は毎フレーム解き直す。頂点バッファは一度だけ確保してある。
    updateSilhouette();

    const phase = (elapsed % OUTLINE_BREATH_MS) / OUTLINE_BREATH_MS;
    content.jar.silhouetteMaterial.opacity = outlineOpacity(readiness, phase) * content.jar.fade;

    // 言葉は上下に揺れながら周回する。**係数は rad/s。** 2π を掛けると 6 倍速くなり、
    // 呼吸と同じ「せわしない」揺れになる（原案は sin(t * 0.3) / cos(t * 0.1)）。
    const seconds = elapsed / MS_PER_SECOND;
    content.jar.words.forEach((word, index) => {
      const bob = Math.sin(seconds * 0.3 + index) * WORD_BOB_AMPLITUDE;
      const orbit = seconds * 0.1 + word.angle;
      word.sprite.position.set(
        Math.cos(orbit) * WORD_ORBIT_RADIUS,
        word.y + bob,
        Math.sin(orbit) * WORD_ORBIT_RADIUS,
      );
    });
  }

  function updateSilhouette(): void {
    const jarWorld = new Vector3();
    content.jar.group.getWorldPosition(jarWorld);
    const dx = camera.position.x - jarWorld.x;
    const dz = camera.position.z - jarWorld.z;

    const points = solveJarSilhouette(content.jar.profile, {
      horizontalDistance: Math.hypot(dx, dz),
      azimuth: Math.atan2(dx, dz),
      y: camera.position.y - jarWorld.y,
    });

    const positions = content.jar.silhouettePositions;
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
    content.jar.silhouette.geometry.setDrawRange(0, count);
  }

  function updateSeal(elapsed: number): void {
    if (!content.seal) return;
    const float = sealFloat(elapsed / MS_PER_SECOND);
    content.seal.group.position.y = layout.jar.y + SEAL_BASE_Y + float.yOffset;
    content.seal.group.rotation.z = float.rotationZ;
  }

  /**
   * 瓶（瓶体・中身・コルク・封・輪郭線）の不透明度をまとめて動かす。
   *
   * 素材は `initScene` の中で専用インスタンスに clone してある。共有したまま触ると
   * 机やボードまで一緒に消える。
   */
  function setJarOpacity(value: number): void {
    content.jar.fade = value;
    for (const owned of content.jar.fadeables) {
      owned.material.opacity = owned.baseOpacity * value;
      owned.material.transparent = true;
    }
    const hidden = value <= 0.02;
    content.jar.group.visible = !hidden;
    if (content.seal) content.seal.group.visible = !hidden;
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
    const intersects = raycaster.intersectObjects(content.hitboxes, false);
    const first = intersects[0];
    if (!first) return { id: null, object: null };
    const hitId = first.object.userData.hitId;
    if (typeof hitId !== 'string') return { id: null, object: null };
    // 拡大するのは見えている方。ヒットボックスは不可視なので、そこを拡大しても何も起きない。
    const visible = first.object.userData.parentGroup;
    return { id: hitId, object: visible instanceof Object3D ? visible : first.object };
  }

  function setHovered(id: HitId | null, object: Object3D | null): void {
    if (id === hoveredId) return;

    // ホバーは scale とカーソルだけ。色は変えない。
    // 戻すときは 1 ではなく**基準の倍率**へ。棚とボードは配置表で 0.68 / 0.72 に
    // 縮めてあるので、1 に戻すと触るたびに大きくなってしまう。
    if (hoveredObject) hoveredObject.scale.setScalar(baseScaleOf(hoveredObject));
    hoveredId = id;
    hoveredObject = object;
    if (hoveredObject) hoveredObject.scale.setScalar(baseScaleOf(hoveredObject) * HOVER_SCALE);

    renderer.domElement.style.cursor = id ? 'pointer' : 'default';

    const entry = content.registry.get(id);
    options.onHoverChange?.(
      entry
        ? { label: entry.label, month: entry.month, screen: projectHover(hoveredObject) }
        : null,
    );
  }

  /** ホバー前の倍率。初回に今の倍率を憶えておく。 */
  function baseScaleOf(object: Object3D): number {
    const remembered = object.userData.baseScale;
    if (typeof remembered === 'number') return remembered;
    const current = object.scale.x;
    object.userData.baseScale = current;
    return current;
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
    const entry = content.registry.get(id);
    if (!entry) return;

    // 封は手紙の id を載せて渡す。
    const target: StudyTarget =
      id === 'seal' && content.letter
        ? {
            kind: 'letter',
            fermentationId: content.letter.fermentationId,
            questionId: content.letter.questionId,
          }
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
    content.books.group.rotation.y = content.books.baseRotationY;
    if (content.books.topCover) content.books.topCover.rotation.z = 0;
    for (const page of content.books.topPages) page.rotation.z = 0;

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
        return journalSpreadView(layout, layout.desk.y + stackTopY(content.notebooks.desk));
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

    disposeContent(content);

    renderer.dispose();
    // dispose() だけでは WebGL のコンテキストが解放されない。明示的に落とさないと
    // タブごとの上限（十数個）に達し、`Too many active WebGL contexts` で古い層から
    // 失われていく。
    renderer.forceContextLoss();
    // renderer.domElement を含め、コンテナを空にする。
    while (container.firstChild) container.removeChild(container.firstChild);
  }

  /**
   * 状態が変わったら物を組み直す（差分更新はしない）。renderer と camera は使い回す。
   *
   * **遷移中は組み直さない。** 組み直すとカメラがホームに戻り、進行中の `goTo` の
   * Promise も宙に浮くので、押したのに何も起きずホームへ巻き戻る（実機で
   * 「トランジションが始まったのにリセットされる」として出ていた）。取得が落ち着く
   * まで数回 state が変わるので、その間に押すと必ず踏む。
   */
  function setState(next: StudyState): void {
    if (transition !== null || settled !== null) {
      // 捨てずに預かる。捨てると、遷移中に届いた更新が二度と反映されない。
      pendingState = next;
      return;
    }
    applyState(next);
  }

  function applyState(next: StudyState): void {
    pendingState = null;
    currentState = next;
    disposeContent(content);
    content = buildContent(next);
    setHovered(null, null);
  }

  return {
    goTo,
    returnHome,
    setState,
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

/**
 * 面 + 稜線の 1 組（原案の `lineArt`）。
 *
 * **書斎の立体はすべてこれで作る。** 面が無いと後ろが透けて、机やボードが物の中を
 * 通って見える。`solid` は polygonOffset 付きなので、上に引く罫はこの面に負けない。
 * ホバーで拡大したあと元に戻せるよう、基準の倍率を持たせておく。
 */
function lineArt(
  geometry: BufferGeometry,
  materials: StudyMaterials,
  own: OwnGeometry,
  options: { face?: Material; threshold?: number } = {},
): Group {
  const group = new Group();
  group.add(new Mesh(own(geometry), options.face ?? materials.solid));
  group.add(
    new LineSegments(own(new EdgesGeometry(geometry, options.threshold ?? 15)), materials.ink),
  );
  group.userData.baseScale = 1;
  return group;
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
    // 中央の 2 本は原案でも地の色（＝ほぼ見えない）。ここだけ抜くと格子が締まる。
    if (i === 0) continue;
    points.push(new Vector3(-half, layout.floorY, i), new Vector3(half, layout.floorY, i));
    points.push(new Vector3(i, layout.floorY, -half), new Vector3(i, layout.floorY, half));
  }
  const geometry = own(new BufferGeometry().setFromPoints(points));
  // 床は**気配だけ**。原案では格子がほとんど知覚されず、机の天板と手前の木端が
  // 主役になっている。同じ 20 分割のまま濃度を落として、格子が絵を仕切らないようにする。
  group.add(new LineSegments(geometry, materials.gridFaint));
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
  bubbles: { mesh: Mesh; speed: number; wobble: number; baseX: number; baseZ: number }[];
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

  // 泡。**球**にする。平らなリングだと向きによって線に潰れ、沈んだ点にしか見えない。
  const bubbles: { mesh: Mesh; speed: number; wobble: number; baseX: number; baseZ: number }[] = [];
  const bubbleGeometry = own(new SphereGeometry(0.028, 8, 8));
  const bubbleMaterial = fadeable(materials.xray(completed ? 0.18 : 0.34).clone());
  const count = bubbleCount(readiness, completed);
  for (let i = 0; i < count; i++) {
    const mesh = new Mesh(bubbleGeometry, bubbleMaterial);
    const angle = Math.random() * Math.PI * 2;
    const radius = jarRadiusAt(profile, Math.random() * level) * 0.7;
    const baseX = Math.cos(angle) * radius;
    const baseZ = Math.sin(angle) * radius;
    mesh.position.set(baseX, Math.random() * level, baseZ);
    group.add(mesh);
    bubbles.push({
      mesh,
      speed: bubbleSpeed(readiness, completed, Math.random()),
      wobble: Math.random() * Math.PI * 2,
      baseX,
      baseZ,
    });
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
    // 幅は文字幅の実測から決め、高さは語ごとの倍率を掛ける（全語同じ大きさにしない）。
    const height = WORD_SPRITE_HEIGHT * placement.scale;
    sprite.scale.set((texture.image.width / texture.image.height) * height, height, 1);
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
  /** 棚ごと 1 つの的にするとき（SP）にホバーで拡大するグループ。 */
  shelfGroup: Group;
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

  // 表紙と束の寸法は lineArt に渡す。奥行きの半分だけは開いたページの罫で使う。
  const halfD = NOTEBOOK_SIZE.depth / 2;

  const deskPlacements: { group: Group; topY: number; thickness: number }[] = [];
  let topCover: Group | null = null;
  const topPages: Group[] = [];

  notebooks.desk.forEach((placement, index) => {
    const book = new Group();
    book.position.y = placement.baseY;

    // 束は表紙より一回り小さく作る（表紙がわずかに出ることで箱に見えない）。
    // 面と稜線の 1 組にしないと後ろが透ける。
    const blockW = NOTEBOOK_SIZE.width - BLOCK_INSET * 2;
    const blockD = NOTEBOOK_SIZE.depth - BLOCK_INSET * 2;
    const block = lineArt(new BoxGeometry(blockW, placement.thickness, blockD), materials, own);
    block.position.y = placement.thickness / 2;
    book.add(block);

    // 表紙。束より少し大きく、薄い板として上に載せる。
    const coverSlab = lineArt(
      new BoxGeometry(NOTEBOOK_SIZE.width, COVER_THICKNESS, NOTEBOOK_SIZE.depth),
      materials,
      own,
    );
    coverSlab.position.y = placement.thickness + COVER_THICKNESS / 2;
    book.add(coverSlab);

    // 小口・天・地の三方に紙の断面を引く。**束の面より外側**に置くこと。
    // 内側に引くと面に埋もれて 1 本も見えない（面で埋めたときに実際そうなった）。
    const halfBlockW = blockW / 2 + 0.002;
    const halfBlockD = blockD / 2 + 0.002;
    const lines = edgeLineCount(placement.thickness);
    for (let i = 0; i < lines; i++) {
      const t = (i + 1) / (lines + 1);
      const y = placement.thickness * t;
      const jitter = (i % 3) * EDGE_LINE_JITTER;
      const material = materials.faint(EDGE_LINE_OPACITIES[i % 2]);
      book.add(
        lineFrom(
          [
            new Vector3(halfBlockW - jitter, y, -halfBlockD),
            new Vector3(halfBlockW - jitter, y, halfBlockD),
          ],
          material,
          own,
        ),
      );
      book.add(
        lineFrom(
          [
            new Vector3(-halfBlockW, y, halfBlockD - jitter),
            new Vector3(halfBlockW, y, halfBlockD - jitter),
          ],
          material,
          own,
        ),
      );
      book.add(
        lineFrom(
          [
            new Vector3(-halfBlockW, y, -halfBlockD + jitter),
            new Vector3(halfBlockW, y, -halfBlockD + jitter),
          ],
          material,
          own,
        ),
      );
    }

    // 表紙のラベル枠。表紙の面のすぐ上に置く。
    const labelY = placement.thickness + COVER_THICKNESS + 0.002;
    const lw = COVER_LABEL.width / 2;
    const lh = COVER_LABEL.height / 2;
    book.add(
      lineFrom(
        [
          new Vector3(-lw, labelY, -lh),
          new Vector3(lw, labelY, -lh),
          new Vector3(lw, labelY, lh),
          new Vector3(-lw, labelY, lh),
          new Vector3(-lw, labelY, -lh),
        ],
        materials.faint(COVER_LABEL.opacity),
        own,
      ),
    );

    // 当月だけが開く表紙とページを持つ。
    if (index === 0) {
      const cover = new Group();
      cover.position.set(COVER_HINGE_X, placement.thickness + COVER_THICKNESS, 0);
      // 開いたときに向こうが透けないよう、表紙にも面を持たせる。
      const coverFace = new Mesh(
        own(new BoxGeometry(NOTEBOOK_SIZE.width, COVER_THICKNESS, NOTEBOOK_SIZE.depth)),
        materials.solid,
      );
      coverFace.position.set(NOTEBOOK_SIZE.width / 2, -COVER_THICKNESS / 2, 0);
      cover.add(coverFace);
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
        const pageFace = new Mesh(
          own(new BoxGeometry(NOTEBOOK_SIZE.width, SPREAD_PAGES.thickness, NOTEBOOK_SIZE.depth)),
          materials.solid,
        );
        pageFace.position.set(NOTEBOOK_SIZE.width / 2, 0, 0);
        page.add(pageFace);
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

  // ブックスタンド（2.6 × 1.7 × 1.1）。**天板も背板も無い**、底板と側面だけの形。
  // 箱にすると棚に見えてしまい、原案の「本を立てて置く台」から離れる。
  const standW = 2.6 / 2;
  const standH = 1.7;
  const standD = 1.1 / 2;
  const standBaseThickness = 0.06;

  // 底板だけは面を持つ（背表紙が宙に浮いて見えないように）。
  const standBase = lineArt(
    new BoxGeometry(standW * 2, standBaseThickness, standD * 2),
    materials,
    own,
  );
  shelfGroup.add(standBase);

  // 側面は輪郭線だけ。下辺は底板が兼ねるので、開いたコの字にする。
  for (const x of [-standW, standW]) {
    shelfGroup.add(
      lineFrom(
        [
          new Vector3(x, 0, -standD),
          new Vector3(x, standH, -standD),
          new Vector3(x, standH, standD),
          new Vector3(x, 0, standD),
        ],
        materials.faint(0.4),
        own,
      ),
    );
  }

  const shelfSpines: Group[] = [];
  const offsets = shelfSpineOffsets(notebooks.shelf.length);
  notebooks.shelf.forEach((notebook, index) => {
    const spine = new Group();
    spine.position.x = offsets[index];
    // 背表紙は面 + 稜線。厚みはその月の件数から決める（原案と同じ）。
    const thickness = Math.max(0.16, notebookThickness(notebook.entryCount));
    const height = 1.5;
    const spineBody = lineArt(new BoxGeometry(thickness, height, standD * 1.8), materials, own);
    spineBody.position.y = standBaseThickness / 2 + height / 2;
    spine.add(spineBody);

    // 背表紙には年月を刷る。棚が「本が並んでいる場所」だと一目で分かる。
    const texture = createTextTexture(spineLabelText(notebook.month), SPINE_LABEL.fontPx);
    if (texture) {
      textures.push(texture);
      const sprite = new Sprite(materials.sprite(texture, SPINE_LABEL.opacity));
      const width = thickness * SPINE_LABEL.fitRatio;
      sprite.scale.set(width, width * (texture.image.height / texture.image.width), 1);
      sprite.position.set(0, standBaseThickness / 2 + height / 2, standD * 1.8 * 0.5 + 0.01);
      spine.add(sprite);
    }

    shelfGroup.add(spine);
    shelfSpines.push(spine);
  });
  group.add(shelfGroup);

  return { group, baseRotationY, topCover, topPages, deskPlacements, shelfSpines, shelfGroup };
}

/** 胴＋ペン先の円錐＋バンド 2 本。線画でもペンとして読める最小の構成。 */
function buildPen(layout: StudyLayout, materials: StudyMaterials, own: OwnGeometry): Group {
  const pen = new Group();
  pen.position.set(layout.pen.x, layout.pen.y, layout.pen.z);
  pen.rotation.x = Math.PI / 2;
  pen.rotation.y = 0.3;

  const bodyGeometry = own(new CylinderGeometry(0.055, 0.055, 1.9, 12));
  // 胴も面で埋める。線だけだと机の輪郭が軸の中を通って見える。
  pen.add(new Mesh(bodyGeometry, materials.solid));
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

  // 板の面。カードはこの手前に貼るので、板が抜けていると奥の壁が透けて見える。
  const face = new Mesh(
    own(new PlaneGeometry(BOARD_FACE.width, BOARD_FACE.height)),
    materials.solid,
  );
  face.position.z = -0.01;
  group.add(face);

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

    // カードも面で埋める。写真は白、スニペットは紙の地色。
    const face = new Mesh(
      own(new PlaneGeometry(placed.width, placed.height)),
      placed.card.cardType === 'photo' ? materials.paper : materials.solid,
    );
    card.add(face);

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
  /** ホバーで拡大する可視グループ。 */
  jarGroup: Group;
  sealGroup: Group | null;
  shelfGroup: Group;
  boardGroup: Group;
}): Mesh[] {
  const { layout, materials, ownGeometry } = options;
  const boxes: Mesh[] = [];

  function box(
    id: HitId,
    size: [number, number, number],
    position: Vector3,
    visible?: Object3D,
  ): void {
    const mesh = new Mesh(ownGeometry(new BoxGeometry(...size)), materials.hitbox);
    mesh.position.copy(position);
    mesh.userData.hitId = id;
    // ホバーで拡大するのは**見えている方**。ヒットボックスを拡大しても何も起きない
    // （原案は `hit.parentGroup` を辿って可視グループを拡大している）。
    mesh.userData.parentGroup = visible ?? null;
    boxes.push(mesh);
  }

  // 瓶は円柱で囲む。
  box(
    'jar',
    [2.8, 3.4, 2.8],
    new Vector3(layout.jar.x, layout.jar.y + 1.5, layout.jar.z),
    options.jarGroup,
  );

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
      placement.group,
    );
  });

  if (options.shelfAsSingleTarget) {
    // SP は棚ごと 1 つの的。背表紙 1 本は指より細く、当たりを広げると隣の月を拾う。
    box(
      'shelf',
      [2.8, 2.0, 1.2],
      new Vector3(layout.shelf.position.x, layout.shelf.position.y + 0.9, layout.shelf.position.z),
      options.shelfGroup,
    );
  } else {
    options.shelf.forEach((spine, index) => {
      const world = new Vector3();
      spine.getWorldPosition(world);
      box(`spine-${index}`, [0.3, 1.5, 0.4], new Vector3(world.x, world.y + 0.7, world.z), spine);
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
    options.boardGroup,
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
