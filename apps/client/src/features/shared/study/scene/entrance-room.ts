/**
 * 書斎の入口 — 扉のある前室を組み立てる。
 *
 * **書斎の一部**として持つ。扉は「書斎の入口」であって別の世界ではない、というのがこの PR の
 * 結論（`docs/oryzae-study/70-entrance.md`）。認証画面と書斎が同じシーンを見て、カメラが外から
 * 中へ 1 本で移動するために、扉もここ（書斎の側）に置く。
 *
 * 座標は**扉の部屋の足元を原点**にして組む（床 y = 0、壁は z = 0 の面、開口の中心が x = 0）。
 * 書斎へ置くときは、返ってきた `group` の位置で合わせる。
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
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
} from 'three';
import type { StudyMaterials } from './materials';
import type { Sprig } from './sprig';

/** 扉板。蝶番は左端（x = -width / 2）。 */
export const DOOR = { width: 2.2, height: 4.6, thickness: 0.12 } as const;

/** 枠（額縁）。壁から少し手前へ出す。 */
const FRAME = { width: 0.2, depth: 0.34 } as const;

/** 壁の広がり。どの構図でも画面の外まで続く幅と高さ。 */
const WALL = { halfWidth: 18, height: 11 } as const;

/** 床の格子。書斎と同じ 1 unit 刻み。 */
const FLOOR_GRID = { halfWidth: 14, near: 12, far: -16 } as const;

/** 扉のある前室。`door` は扉板（`rotation.y` で開く）。 */
export interface EntranceRoom {
  group: Group;
  door: Group;
}

type OwnGeometry = <T extends BufferGeometry>(geometry: T) => T;

/**
 * 前室を組む。**開いた扉の向こうには、置いた先の部屋がそのまま見える**ので、奥を描き込まない。
 */
export function buildEntranceRoom(
  materials: StudyMaterials,
  own: OwnGeometry,
  /** 一輪挿しに挿さる枝（七十二候）。 */
  sprig: Sprig,
  /** 扉を見る視点。一輪挿しの輪郭の向きを決めるためだけに使う。 */
  viewFrom: { x: number; z: number },
): EntranceRoom {
  const group = new Group();
  group.add(buildFloorGrid(materials, own));
  group.add(buildWall(materials, own));
  group.add(buildFrame(materials, own));
  group.add(buildDoormat(materials, own));
  group.add(buildCabinet(materials, own, sprig, viewFrom));
  const door = buildDoor(materials, own);
  group.add(door);
  return { group, door };
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
 * 扉の左の、低い棚と一輪挿し。**玄関（書斎の手前の部屋）であることを言う物はこれ 1 つ。**
 *
 * 扉だけだと、壁に扉が描いてあるだけの「入口のアイコン」に読める。人が暮らしている
 * 前室には、帰ってきた手が物を置く高さの面がある。書斎が瓶と手帳で語るのと同じく、
 * ここも物 1 つで語り、線を足して部屋を説明しない。
 */
function buildCabinet(
  materials: StudyMaterials,
  own: OwnGeometry,
  sprig: Sprig,
  viewFrom: { x: number; z: number },
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
    viewFrom,
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
  viewFrom: { x: number; z: number },
  /** 花瓶の world 上の位置（輪郭の向きを決めるためだけに使う）。 */
  world: { x: number; z: number },
  /** 挿してある枝の姿（季節）。 */
  sprig: Sprig,
): Group {
  const group = new Group();
  const profile = VASE_PROFILE.map(([r, y]) => new Vector2(r, y));
  group.add(new Mesh(own(new LatheGeometry(profile, 40)), materials.solid));

  // カメラへ向かう方位。輪郭の母線はそこから ±90°。
  const toCamera = Math.atan2(viewFrom.x - world.x, viewFrom.z - world.z);
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
 * 一輪挿しに挿さった草花を描く（`study/scene/sprig.ts` の `Sprig`）。
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
