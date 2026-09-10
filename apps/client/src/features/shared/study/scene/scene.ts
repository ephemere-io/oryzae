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
import { HOME_ZOOM, RENDER_LIMITS } from '../constants';
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
  STACK_GAP,
  shelfSpineOffsets,
  spineLabelText,
  stackTopY,
} from './books';
import {
  approach,
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
  zoomByPinch,
  zoomByWheel,
  zoomedView,
  zoomTargetRise,
} from './camera';
import { contentSignature } from './content-signature';
import {
  buildHitRegistry,
  type HitHint,
  type HitId,
  HOVER_SCALE,
  resolveClickTarget,
} from './hit-targets';
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
  sampleJarProfile,
  silhouetteBufferSize,
  solveJarSilhouette,
} from './jar';
import {
  createMaterials,
  DARK_PALETTE,
  fadedMaterialState,
  LIGHT_PALETTE,
  type StudyMaterials,
  type StudyTheme,
} from './materials';
import {
  isPlanDone,
  leaveFadeDuration,
  leaveFadeStart,
  pageProgress,
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
  /**
   * 書斎から出ていく遷移が、薄くなり始めたとき（遷移の後半に 1 回だけ）。
   *
   * 呼び出し側は `durationMs` かけて書斎全体を消す。カメラが着くのと同時に消え終わる
   * ので、行き先の画面へは切り替わりではなく**溶暗**で入る。
   */
  onLeaveStart?: (durationMs: number) => void;
  /**
   * 出ていく直前の書斎を 1 枚の画像（data URL）にして渡す。
   *
   * **部屋は消えたのではなく、遠くなっただけ**という見立てを、サブ画面と戻り道で
   * 保つための地。3D を裏で回し続けずに済むよう、静止画に畳んでから渡す。
   */
  onCapture?: (dataUrl: string) => void;
  /**
   * 最初の 1 フレームを描き終えたとき（1 度だけ）。
   *
   * 戻り道では、憶えた部屋の絵を敷いた上に canvas が乗る。**絵を外してよいのは
   * canvas が実際に描いたあと**で、それより早く外すと地の色だけの 1 フレームが
   * 挟まって画面が点滅する。
   */
  onReady?: () => void;
}

export interface HoverInfo {
  label: 'jar' | 'journal' | 'board' | 'archive' | 'pen' | null;
  month: string | null;
  /** 触れている的が一言を持つとき、その種類。文面は呼び出し側が状態から決める。 */
  hint: HitHint | null;
  /** ツールチップを出す画面座標。 */
  screen: { x: number; y: number };
}

export interface LabelPositions {
  jar: ScreenPoint | null;
  journal: ScreenPoint | null;
  board: ScreenPoint | null;
  archive: ScreenPoint | null;
  pen: ScreenPoint | null;
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
  /** 状態を差し替えて物を組み直す。遷移中は何もしない。 */
  setState(state: StudyState): void;
  /** マウス位置（-1..1）。パララックスとホバーに使う。 */
  setPointer(x: number, y: number): void;
  /** ポインタが canvas から外れた。 */
  clearPointer(): void;
  /** ホイールで寄り引きする（ホームのみ）。 */
  zoomBy(deltaY: number): void;
  /** 2 本指を置いた。以後の比はここを基準にする。 */
  startPinch(): void;
  /** 2 本指の間隔の比（置いた時点を 1 とする）。 */
  pinchTo(ratio: number): void;
  /** クリック。`hovered` に頼らずその場で拾い直す。 */
  pick(): void;
  /** 遷移中・サブ画面ではラベルを消す。 */
  isBusy(): boolean;
  dispose(): void;
}

/** 秒。四方の計算で使う。 */
const MS_PER_SECOND = 1000;

/**
 * 憶えておく 1 枚の撮り方。
 *
 * ### 拡大も縮小もしない
 *
 * 「押すと画面がガビガビになる」の正体は**拡大縮小そのもの**だった。書斎は 1px の
 * 細線で出来ていて、線画は縮小 → 拡大の往復に耐えない（線が破線と粒に割れる）。
 * はじめは 960px の JPEG で撮っていて、JPEG のリンギングと 3 倍の引き伸ばしが
 * 重なっていた。PNG にしてリンギングは消えたが、**引き伸ばしのほうが主犯**だった。
 *
 * `renderer.domElement.width` は既にデバイス画素（pixelRatio 込み、上限 2）。敷く先も
 * 同じ画面なので、**そのままの大きさで撮れば 1:1 になり、再標本化そのものが起きない**。
 * 上限はごく大きな画面（4K を超える窓）への保険で、そこだけは縮めて諦める。
 *
 * 形式は PNG。JPEG の周波数変換は白地に細い黒線という形が最も苦手で、線の周りに
 * リンギングが出る。白地が大半なので PNG でもよく縮む。
 */
const CAPTURE = { maxWidth: 3840 } as const;

/**
 * `sessionStorage` に置く 1 枚の上限（文字数）。
 *
 * 超えたら**憶えない**。地が無くても引き戻しは地の色で成立するので、保存に失敗して
 * 他の憶えごとを押し出すより、諦めるほうが安全。
 */
const CAPTURE_MAX_CHARS = 3_000_000;

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
  groups: Object3D[];
  hitboxes: Mesh[];
  jar: JarParts;
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

    const registry = buildHitRegistry({
      desk: notebooks.desk.map((placement) => placement.notebook),
      shelf: notebooks.shelf,
      shelfAsSingleTarget: layout.pillOffsets !== null,
    });

    const deskGroup = buildDesk(layout, materials, ownGeometry);
    const floorGroup = buildFloorGrid(layout, materials, ownGeometry);
    const jar = buildJar(state, layout, materials, ownGeometry, textures);
    const books = buildBooks(notebooks, layout, materials, ownGeometry, textures);
    const board = buildBoard(state, layout, materials, ownGeometry);

    const groups: Object3D[] = [deskGroup, floorGroup, jar.group, books.group, board.group];

    const hitboxes = buildHitboxes({
      layout,
      materials,
      ownGeometry,
      desk: books.deskPlacements,
      shelf: books.shelfSpines,
      shelfAsSingleTarget: layout.pillOffsets !== null,
      jarGroup: jar.group,
      shelfGroup: books.shelfGroup,
      boardGroup: board.group,
      penGroup: books.penGroup,
    });

    for (const group of groups) scene.add(group);
    for (const hitbox of hitboxes) scene.add(hitbox);

    return {
      materials,
      geometries,
      textures,
      registry,
      notebooks,
      groups,
      hitboxes,
      jar,
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
  /**
   * いま組んである中身の指紋。**同じなら組み直さない。**
   *
   * 状態は 5 つの取得が別々に届くので、素直に受けると 1 秒のあいだに何度も部屋を
   * 作り直す。憶えてある書斎を敷いているときは、あとから届く本物が前回と同じ内容で
   * あることがほとんどで、その作り直しは絵を 1px も変えないまま 1 フレーム落とす
   * （戻ってきた直後の「カクカク」の正体）。
   */
  let signature = contentSignature(options.state);
  /** 遷移中に届いた更新。手が空いたら反映する。 */
  let pendingState: StudyState | null = null;
  let content = buildContent(currentState);

  // ---- 状態 --------------------------------------------------------------

  const pointer = new Vector2(0, 0);
  let pointerInside = false;
  const raycaster = new Raycaster();

  let hoveredId: HitId | null = null;
  let hoveredObject: Object3D | null = null;
  /** ホームの寄り引き。目標へ lerp で寄せる（指を離しても少し滑る）。 */
  let zoom = 1;
  let zoomTarget = 1;
  /** 2 本指を置いた時点の倍率。 */
  let pinchBase = 1;

  const parallax = { x: 0, y: 0 };

  /** 出ていくフェードを 1 回だけ知らせるための印。 */
  let leaveAnnounced = false;
  /**
   * 次の描画の直後に 1 枚掴む、という予約。
   *
   * **描画の後でなければならない。** WebGL の描画バッファは既定で描画のたびに破棄
   * されるので（`preserveDrawingBuffer` を立てていない）、別のタイミングで
   * `toDataURL` を呼ぶと真っ白が返る。立てるのは `renderer.render` の直後だけ。
   */
  let captureRequested = false;

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
  /** 最初の描画を 1 度だけ知らせるための印。 */
  let readyAnnounced = false;
  const startedAt = performance.now();

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
    updateHover();
    reportLabels();

    renderer.render(scene, camera);

    if (!readyAnnounced) {
      readyAnnounced = true;
      options.onReady?.();
    }

    if (captureRequested) {
      captureRequested = false;
      captureFrame((frame) => {
        if (frame !== null) options.onCapture?.(frame);
      });
    }
  }

  /**
   * いま描いたフレームを 1 枚の画像にする。
   *
   * **画素を取るのは同期、符号化は非同期。** 描画バッファは次のフレームで捨てられる
   * ので、`drawImage` でこの場に写し取る必要がある（これは GPU の転送なので速い）。
   * 一方 PNG の符号化は等倍だと重く、その場でやるとカメラが動き出す 1 フレームが
   * 引っかかる。`toBlob` に渡して符号化だけ後回しにする。
   *
   * 撮れない環境（2D コンテキストが取れない・canvas が 0 幅・符号化に失敗）では
   * null を返す。地が無くても遷移そのものは成立するので、諦めても失うものは無い。
   */
  function captureFrame(done: (dataUrl: string | null) => void): void {
    const source = renderer.domElement;
    if (source.width === 0 || source.height === 0) {
      done(null);
      return;
    }

    const width = Math.min(source.width, CAPTURE.maxWidth);
    const flat = document.createElement('canvas');
    flat.width = width;
    flat.height = Math.max(1, Math.round((source.height / source.width) * width));
    const context = flat.getContext('2d');
    if (context === null) {
      done(null);
      return;
    }

    // 書斎は alpha 付きで描いている。地の色を先に塗ってから重ねる
    // （透明のまま敷くと、敷いた先の画面が透けて二重写しになる）。
    context.fillStyle = theme === 'dark' ? DARK_PALETTE.solid : LIGHT_PALETTE.solid;
    context.fillRect(0, 0, flat.width, flat.height);
    context.drawImage(source, 0, 0, flat.width, flat.height);

    try {
      flat.toBlob((blob) => {
        if (blob === null) {
          done(null);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const url = typeof reader.result === 'string' ? reader.result : null;
          done(url !== null && url.length <= CAPTURE_MAX_CHARS ? url : null);
        };
        reader.onerror = () => done(null);
        reader.readAsDataURL(blob);
      }, 'image/png');
    } catch {
      // 汚れた canvas（外部テクスチャ）なら諦める。いまは自前の描画だけなので通常は来ない。
      done(null);
    }
  }

  function updateCamera(now: number, elapsed: number): void {
    if (transition) {
      const view = viewAtTransition(transition, now);
      applyView(camera, view);
      // 手帳は表紙とページが遅れて開く。
      updateOpening(transition, now);
      announceLeave(transition, now - transition.startedAt);
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

    // 寄り引き。近づくぶんだけ注視点が上がる（絵の上端を画面に留めるため）。
    zoom = approach(zoom, zoomTarget, HOME_ZOOM.lerp);
    const view = zoomedView(homeCamera, zoom, zoomTargetRise(layout, zoom));

    camera.position.set(
      view.position.x + parallax.x,
      view.position.y + parallax.y + breathOffset(elapsed),
      view.position.z,
    );
    camera.lookAt(view.target.x, view.target.y, view.target.z);
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
    // 蝶番は左端（x = COVER_HINGE_X）にあり、表紙はそこから右へ伸びている。**正の回転**で
    // 表紙が持ち上がって左へ倒れる。負にすると机を突き抜けて下から回り込む。
    content.books.topCover.rotation.z = COVER_OPEN_ANGLE * open;

    const pages = content.books.topPages;
    pages.forEach((page, index) => {
      // 紙は下から積んであるが、めくるのは**上から**。下からめくると、上に載っている
      // 紙に隠れて 1 枚しか動いて見えない。
      const order = SPREAD_PAGES.turnOrderOf(index, pages.length);
      page.rotation.z = SPREAD_PAGES.angleAt(order) * pageProgress(cover, order, elapsed);
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

  /**
   * 瓶（瓶体・中身・コルク・輪郭線）の不透明度をまとめて動かす。
   *
   * 素材は `initScene` の中で専用インスタンスに clone してある。共有したまま触ると
   * 机やボードまで一緒に消える。
   */
  function setJarOpacity(value: number): void {
    content.jar.fade = value;
    for (const owned of content.jar.fadeables) {
      const next = fadedMaterialState(
        { opacity: owned.baseOpacity, transparent: owned.baseTransparent },
        value,
      );
      owned.material.opacity = next.opacity;
      if (owned.material.transparent !== next.transparent) {
        owned.material.transparent = next.transparent;
        // transparent はシェーダの選択に効く。切り替えたら作り直させる。
        owned.material.needsUpdate = true;
      }
    }
    content.jar.group.visible = value > 0.02;
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
        ? {
            label: entry.label,
            month: entry.month,
            hint: entry.hint ?? null,
            screen: projectHover(hoveredObject),
          }
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
      options.onLabelPositions({ jar: null, journal: null, board: null, archive: null, pen: null });
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
      pen: anchors.pen ? toScreen(new Vector3(anchors.pen.x, anchors.pen.y, anchors.pen.z)) : null,
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

  /**
   * 寄り引き。**ホームだけ**で効かせる。
   *
   * 遷移中に効かせると、着いた先のカメラと喧嘩して目的地がずれる。行き先の画面では
   * そもそも書斎が見えていない。
   */
  function zoomBy(deltaY: number): void {
    if (transition || settled) return;
    zoomTarget = zoomByWheel(zoomTarget, deltaY);
  }

  function startPinch(): void {
    if (transition || settled) return;
    pinchBase = zoomTarget;
  }

  function pinchTo(ratio: number): void {
    if (transition || settled) return;
    zoomTarget = zoomByPinch(pinchBase, ratio);
  }

  function pick(): void {
    if (transition || settled) return;

    // タッチでは pointermove が click より先に来ないことがある。その場で拾い直す。
    const id = resolveClickTarget(hoveredId, () => raycast().id);
    const entry = content.registry.get(id);
    if (!entry) return;
    options.onPick?.(entry.target);
  }

  function goTo(target: StudyTarget): Promise<void> {
    if (transition) transition.resolve();
    leaveAnnounced = false;
    /**
     * **動き出す前に掴む。**
     *
     * 憶えた 1 枚は「戻ってきたときに見える部屋」として使う。遷移の途中で掴むと、
     * 既に瓶や板へ寄ったあとの絵になり、戻り道の地としては別の景色になってしまう。
     * ここで掴めば、次の描画＝まだホームに居るフレームが残る。
     */
    captureRequested = options.onCapture !== undefined;
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

  /**
   * 遷移の後半に入ったら、書斎を薄くし始めてよいと 1 回だけ知らせる。
   *
   * 出ていく遷移だけ。書斎の中で完結する的はそもそもカメラを動かさないので、ここへは来ない。
   */
  function announceLeave(active: NonNullable<typeof transition>, elapsed: number): void {
    if (leaveAnnounced) return;
    const total = active.plan.totalMs;
    if (elapsed < leaveFadeStart(total)) return;
    leaveAnnounced = true;
    options.onLeaveStart?.(leaveFadeDuration(total));
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
    const nextSignature = contentSignature(next);
    // 絵に出ない部分だけが変わったとき（一覧の記録・問いなど）は、値だけ受け取って
    // 物はそのまま。組み直すと、触れている物のホバーまで外れる。
    if (nextSignature === signature) {
      currentState = next;
      return;
    }
    signature = nextSignature;
    currentState = next;
    disposeContent(content);
    content = buildContent(next);
    setHovered(null, null);
  }

  return {
    goTo,
    setState,
    setPointer,
    clearPointer,
    zoomBy,
    startPinch,
    pinchTo,
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
 * 机の天板。**輪郭・手前の木端・木目 1 本だけ。脚は描かない。**
 *
 * ### 脚をやめた経緯
 *
 * 3 度いじって 3 度とも外している場所:
 *
 *  1. 線 1 本の前脚 2 本 → 「ちゃぶ台のように質素」
 *  2. 幕板・引き出し・板の脚 → 「現実的かつ具体的で稚拙」
 *  3. 細い箱の脚 4 本 + 接地 → 「貧しい感じ。いっそ生やさない方がいい」
 *
 * **俯瞰の構図では脚が絵にならない。** 天板をほぼ真上から見ているので、脚は天板の
 * 下から短く覗くだけになり、どう描いても「棒」か「未熟なデッサン」に見える。3 で
 * 「足の付け根が机の底辺ラインより上に出ている」と言われたのがまさにそれで、脚の面は
 * 木端より奥（`zNear` より内側）にあるため、俯瞰では木端の線より上に投影される。
 * 遠近法としては正しいが、絵としては透けているようにしか見えない。
 *
 * 描かなければ、天板は「面」として素直に読める。宙に浮いて見える心配は、床の格子と
 * 奥の壁の立ち上がりが受け持っている。**ここは線を足して解く場所ではない。**
 */
function buildDesk(layout: StudyLayout, materials: StudyMaterials, own: OwnGeometry): Group {
  const group = new Group();
  const { y, xLeft, xRight, zNear, zFar } = layout.deskTop;

  group.add(
    lineFrom(
      [
        new Vector3(xLeft, y, zNear),
        new Vector3(xRight, y, zNear),
        new Vector3(xRight, y, zFar),
        new Vector3(xLeft, y, zFar),
        new Vector3(xLeft, y, zNear),
      ],
      materials.faint(0.13),
      own,
    ),
  );

  // 手前の木端。ここだけ濃く引くと、平面が板に見える。
  // 脚を描かなくなったので、厚みはこの 1 本が全部を担う。薄すぎると紙に見える。
  const edgeBottom = y - 0.22;
  group.add(
    lineFrom(
      [
        new Vector3(xLeft, y, zNear),
        new Vector3(xLeft, edgeBottom, zNear),
        new Vector3(xRight, edgeBottom, zNear),
        new Vector3(xRight, y, zNear),
      ],
      materials.faint(0.34),
      own,
    ),
  );

  // 木目を示唆する長い 1 本。
  group.add(
    lineFrom(
      [new Vector3(xLeft + 0.8, y, zFar + 1.2), new Vector3(xRight - 0.8, y, zFar + 1.6)],
      materials.faint(0.06),
      own,
    ),
  );

  // 奥の壁の立ち上がり。
  for (const x of [xLeft, xRight]) {
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
  /** 作ったときの透明フラグ。戻すときにここへ返す（fadedMaterialState の注釈を参照）。 */
  baseTransparent: boolean;
}

interface JarParts {
  group: Group;
  profile: Vector2[];
  level: number;
  bubbles: { mesh: Mesh; speed: number; wobble: number; baseX: number; baseZ: number }[];
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
    fadeables.push({
      material: cloned,
      baseOpacity: cloned.opacity,
      baseTransparent: cloned.transparent,
    });
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
  // 液面のリングも一段薄く（0.3 → 0.22）。もやと合わせて「濃い水」に見えていた。
  const ring = new Mesh(ringGeometry, fadeable(materials.xray(0.22).clone()));
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

  // 上部のもや。
  if (hazeVisible(readiness)) {
    const texture = createHazeTexture();
    if (texture) {
      textures.push(texture);
      const material = materials.sprite(texture, hazeOpacity(readiness));
      fadeables.push({
        material,
        baseOpacity: hazeOpacity(readiness),
        baseTransparent: material.transparent,
      });
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

interface BooksParts {
  group: Group;
  baseRotationY: number;
  topCover: Group | null;
  topPages: Group[];
  deskPlacements: { group: Group; topY: number; thickness: number }[];
  shelfSpines: Group[];
  /** 棚ごと 1 つの的にするとき（SP）にホバーで拡大するグループ。 */
  shelfGroup: Group;
  /** 鉛筆。押すと新しいエントリーを書き始める（ホバーで少し持ち上がる）。 */
  penGroup: Group;
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

    // 見開きの右の頁。**束の上面**に引く。表紙が開いたときにここが現れるので、
    // 紙（leaf）ではなく束に引かないと、紙をめくり終えた先が白紙になる。
    const spreadZ = halfBlockD - RULES.spreadEdgeInset;
    for (let r = 0; r < RULES.spreadCount; r++) {
      const x = (r - (RULES.spreadCount - 1) / 2) * RULES.spreadSpacing;
      book.add(
        lineFrom(
          [
            new Vector3(x, placement.thickness + 0.002, -spreadZ),
            new Vector3(x, placement.thickness + 0.002, spreadZ),
          ],
          materials.faint(RULES.spreadOpacity),
          own,
        ),
      );
    }

    // 表紙は**開く蝶番の中だけ**に置く。板を別に敷いてしまうと、開いても同じ位置に
    // 表紙が残り、右半分がいつまでも閉じたままに見える（実機でそうなっていた）。
    const cover = new Group();
    cover.position.set(COVER_HINGE_X, placement.thickness + COVER_THICKNESS / 2 + 0.002, 0);
    const coverSlab = lineArt(
      new BoxGeometry(NOTEBOOK_SIZE.width, COVER_THICKNESS, NOTEBOOK_SIZE.depth),
      materials,
      own,
    );
    coverSlab.position.x = NOTEBOOK_SIZE.width / 2;
    cover.add(coverSlab);

    // 表紙のラベル枠。表紙と一緒に動く。
    const labelY = COVER_THICKNESS / 2 + 0.002;
    const lw = COVER_LABEL.width / 2;
    const lh = COVER_LABEL.height / 2;
    const lx = NOTEBOOK_SIZE.width / 2;
    cover.add(
      lineFrom(
        [
          new Vector3(lx - lw, labelY, -lh),
          new Vector3(lx + lw, labelY, -lh),
          new Vector3(lx + lw, labelY, lh),
          new Vector3(lx - lw, labelY, lh),
          new Vector3(lx - lw, labelY, -lh),
        ],
        materials.faint(COVER_LABEL.opacity),
        own,
      ),
    );

    // 見開きの左の頁＝表紙の裏。開くまで見えないが、開いた先が白紙にならないよう引く。
    const innerY = -COVER_THICKNESS / 2 - 0.003;
    const innerZ = halfD - 0.4;
    for (let r = 0; r < RULES.coverInnerCount; r++) {
      const x = lx + (r - (RULES.coverInnerCount - 1) / 2) * RULES.spreadSpacing;
      cover.add(
        lineFrom(
          [new Vector3(x, innerY, -innerZ), new Vector3(x, innerY, innerZ)],
          materials.faint(RULES.coverInnerOpacity),
          own,
        ),
      );
    }

    book.add(cover);

    // 当月（積みの一番上）だけが、表紙を追ってめくれる紙を持つ。
    if (index === 0) {
      topCover = cover;

      for (let i = 0; i < SPREAD_PAGES.count; i++) {
        const page = new Group();
        page.position.set(
          COVER_HINGE_X,
          placement.thickness + SPREAD_PAGES.liftBase + i * SPREAD_PAGES.gap,
          0,
        );
        const leaf = lineArt(
          new BoxGeometry(
            NOTEBOOK_SIZE.width - SPREAD_PAGES.inset,
            SPREAD_PAGES.thickness,
            NOTEBOOK_SIZE.depth - SPREAD_PAGES.inset,
          ),
          materials,
          own,
        );
        leaf.position.x = NOTEBOOK_SIZE.width / 2;
        page.add(leaf);
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
  const penGroup = buildPen(layout, materials, own);
  group.add(penGroup);

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

  return {
    group,
    baseRotationY,
    topCover,
    topPages,
    deskPlacements,
    shelfSpines,
    shelfGroup,
    penGroup,
  };
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
  shelfAsSingleTarget: boolean;
  /** ホバーで拡大する可視グループ。 */
  jarGroup: Group;
  shelfGroup: Group;
  boardGroup: Group;
  penGroup: Group;
}): Mesh[] {
  const { layout, materials, ownGeometry } = options;
  const boxes: Mesh[] = [];

  function box(
    id: HitId,
    size: [number, number, number],
    position: Vector3,
    visible?: Object3D,
    /** 当たりを傾ける元。渡すとその world 姿勢をそのまま被せる。 */
    orientation?: Object3D,
  ): void {
    const mesh = new Mesh(ownGeometry(new BoxGeometry(...size)), materials.hitbox);
    mesh.position.copy(position);
    if (orientation) orientation.getWorldQuaternion(mesh.quaternion);
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

  // 机の冊はそれぞれを囲む箱。
  //
  // 高さに積みの隙間（STACK_GAP）を足す。冊と冊のあいだに当たりの無い帯が残ると、
  // そこを狙ったつもりの指がすり抜ける。隙間は隣り合う 2 冊で分け合う。
  options.desk.forEach((placement, index) => {
    const world = new Vector3();
    placement.group.getWorldPosition(world);
    box(
      `notebook-${index}`,
      [NOTEBOOK_SIZE.width, placement.thickness + STACK_GAP, NOTEBOOK_SIZE.depth],
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

  /**
   * 鉛筆。**物より大きく囲む。**
   *
   * 軸の太さは半径 0.055 しかなく、そのまま囲うと矢印でも指でも当たらない
   * （押せる物の中で鉛筆だけが押せなかった理由の半分はこれ）。物の見た目は
   * 変えずに、当たりだけ手に馴染む太さにする。
   *
   * **位置と向きは鉛筆そのものから取る。** `layout.pen` は机（books グループ）の
   * ローカル座標で、机は world で平行移動したうえ y 軸まわりに回っている。配置表の
   * 値を world としてそのまま置いていたころ、当たりは鉛筆から 3 world unit 以上
   * 離れた何も無い場所にあった —「鉛筆はホバーしても何も起きない」の正体がこれ。
   * 箱の長辺は鉛筆のローカル y（＝軸の向き）に合わせ、姿勢ごと被せる。
   */
  const penWorld = new Vector3();
  options.penGroup.getWorldPosition(penWorld);
  box('pen', [0.6, 2.6, 0.6], penWorld, options.penGroup, options.penGroup);

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

  // 中心の濃さは 0.28 → 0.18。掛かる不透明度（`hazeOpacity`）も一緒に下げてある。
  // 濃い面が 1 か所だけあると、線画の部屋の中でそこだけ「塗り」に見える。
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(26,25,24,0.18)');
  gradient.addColorStop(1, 'rgba(26,25,24,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);

  return new CanvasTexture(canvas);
}
