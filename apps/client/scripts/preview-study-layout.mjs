// 書斎の構図を three.js の投影で SVG に描く。WebGL 無しで、物どうし・ピルと物の重なりや
// 天板からのはみ出しを見るための道具（`docs/work/2026-09-13-sp-polish.md` §A2）。
//
// 実行（apps/client で）:
//   node scripts/preview-study-layout.mjs '<override JSON>' <out.svg> [幅] [高さ]
//   例: node scripts/preview-study-layout.mjs '{"jar":{"x":-1.4}}' /tmp/study.svg 430 860
// 既定値は SP_LAYOUT の写し。override は同じ形で部分的に上書きできる（deepMerge）。
// 描くもの: 天板・壁の立ち上がり・ボード・瓶（口縁・コルク・真の輪郭）・手帳・鉛筆・棚・ピル。
// 見た目の正はあくまで scene.ts。ここは配置の当たりを付けるだけ。
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Group, Object3D, PerspectiveCamera, Vector2, Vector3 } = require('three');

const DEFAULT = {
  fov: 58,
  camera: { x: 0, y: 10.6, z: 7.8 },
  target: { x: 0, y: -0.35, z: -0.7 },
  jar: { x: -1.4, y: -1.2, z: -0.3 },
  board: { x: 0, y: 2.7, z: -4.2, scale: 0.68 },
  boardFace: { width: 8, height: 5 },
  desk: { x: 1.5, y: -1, z: 2.2 },
  deskRotationY: -0.15,
  /** null で置かない。 */
  pen: null,
  /** world。scene.ts は机の回転の逆を掛けて置くので、ここでも同じ。 */
  shelf: { x: 2.0, y: -1.2, z: -2.7, scale: 0.72, tiltX: -0.42 },
  deskTop: { y: -1.2, xLeft: -3.4, xRight: 3.4, zNear: 4.3, zFar: -4.7 },
  labelAnchors: {
    jar: { x: -1.4, y: -1.14, z: 1.15 },
    journal: { x: 1.5, y: -1.14, z: 4.1 },
    board: { x: 0, y: 1.5, z: -4.0 },
    archive: { x: 2.0, y: -1.14, z: -1.35 },
  },
  pillOffsets: {
    jar: { x: 0, y: 24 },
    journal: { x: 0, y: 22 },
    board: { x: -92, y: 40 },
    archive: { x: 0, y: 10 },
  },
  /** ピルの実測幅の目安（px）。文字量で変わる。 */
  pillWidths: { jar: 116, journal: 118, board: 112, archive: 120 },
  deskNotebooks: 1,
  entryCounts: [3, 8, 12],
  shelfCount: 3,
};

const override = JSON.parse(process.argv[2] ?? 'null') ?? {};
const out = process.argv[3] ?? 'study-preview.svg';
const W = Number(process.argv[4] ?? 430);
const H = Number(process.argv[5] ?? 860);
const L = deepMerge(DEFAULT, override);

function deepMerge(base, patch) {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  const result = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const nested =
      key in base &&
      typeof base[key] === 'object' &&
      base[key] !== null &&
      !Array.isArray(base[key]);
    result[key] = nested ? deepMerge(base[key], value) : value;
  }
  return result;
}

const camera = new PerspectiveCamera(L.fov, W / H, 0.1, 100);
camera.position.set(L.camera.x, L.camera.y, L.camera.z);
camera.lookAt(new Vector3(L.target.x, L.target.y, L.target.z));
camera.updateMatrixWorld();
camera.updateProjectionMatrix();

function px(v) {
  const ndc = v.clone().project(camera);
  return [((ndc.x + 1) / 2) * W, ((1 - ndc.y) / 2) * H];
}

const shapes = [];
function poly(points, stroke = '#1A1918', width = 1, extra = {}) {
  shapes.push({ points: points.map((p) => px(p)), stroke, width, ...extra });
}
function polyWorld(objectPoints, object, stroke, width, extra) {
  object.updateMatrixWorld(true);
  poly(
    objectPoints.map((p) => p.clone().applyMatrix4(object.matrixWorld)),
    stroke,
    width,
    extra,
  );
}
function boxEdges(w, h, d, offset = new Vector3()) {
  const [hw, hd] = [w / 2, d / 2];
  const c = (x, y, z) => new Vector3(x, y, z).add(offset);
  const top = [c(-hw, h, -hd), c(hw, h, -hd), c(hw, h, hd), c(-hw, h, hd), c(-hw, h, -hd)];
  const bottom = [c(-hw, 0, -hd), c(hw, 0, -hd), c(hw, 0, hd), c(-hw, 0, hd), c(-hw, 0, -hd)];
  const verticals = [
    [c(-hw, 0, -hd), c(-hw, h, -hd)],
    [c(hw, 0, -hd), c(hw, h, -hd)],
    [c(hw, 0, hd), c(hw, h, hd)],
    [c(-hw, 0, hd), c(-hw, h, hd)],
  ];
  return { top, bottom, verticals };
}

// 天板。
{
  const { y, xLeft, xRight, zNear, zFar } = L.deskTop;
  poly(
    [
      new Vector3(xLeft, y, zNear),
      new Vector3(xRight, y, zNear),
      new Vector3(xRight, y, zFar),
      new Vector3(xLeft, y, zFar),
      new Vector3(xLeft, y, zNear),
    ],
    '#9a958c',
    1,
  );
  const eb = y - 0.22;
  poly(
    [
      new Vector3(xLeft, y, zNear),
      new Vector3(xLeft, eb, zNear),
      new Vector3(xRight, eb, zNear),
      new Vector3(xRight, y, zNear),
    ],
    '#6d685f',
    1.2,
  );
  for (const x of [xLeft, xRight]) {
    poly([new Vector3(x, y, zFar), new Vector3(x, y + 4, zFar)], '#cfcbc3', 1);
  }
}

// ボード。
{
  const bw = (L.boardFace.width / 2) * L.board.scale;
  const bh = (L.boardFace.height / 2) * L.board.scale;
  const { x, y, z } = L.board;
  poly(
    [
      new Vector3(x - bw, y - bh, z),
      new Vector3(x + bw, y - bh, z),
      new Vector3(x + bw, y + bh, z),
      new Vector3(x - bw, y + bh, z),
      new Vector3(x - bw, y - bh, z),
    ],
    '#1A1918',
    1,
  );
}

// 瓶（jar.ts の母線と輪郭の解法の写し）。
const JAR_BODY = [
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
  [1.0, 2.9],
  [1.0, 2.94],
  [0.86, 2.94],
  [0, 2.94],
];
const jarGroup = new Group();
jarGroup.position.set(L.jar.x, L.jar.y, L.jar.z);
jarGroup.updateMatrixWorld(true);
function ring(r, y, n = 72) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(new Vector3(Math.sin(a) * r, y, Math.cos(a) * r));
  }
  return pts;
}
polyWorld(ring(1.0, 2.94), jarGroup, '#1A1918', 1);
polyWorld(ring(0.83, 3.18), jarGroup, '#1A1918', 1, { fill: '#F2EDE0' });
function silhouette(profilePairs, group, origin) {
  const profile = profilePairs.map(([r, y]) => new Vector2(r, y));
  const dx = camera.position.x - origin.x;
  const dz = camera.position.z - origin.z;
  const cam = { A: Math.hypot(dx, dz), alpha: Math.atan2(dx, dz), y: camera.position.y - origin.y };
  const right = [];
  const left = [];
  for (let i = 0; i < profile.length; i++) {
    const p = profile[i];
    if (p.x <= 1e-6) continue;
    const prev = profile[Math.max(0, i - 1)];
    const next = profile[Math.min(profile.length - 1, i + 1)];
    const t = new Vector2(next.x - prev.x, next.y - prev.y);
    const len = t.length();
    const n = len <= 1e-9 ? new Vector2(1, 0) : new Vector2(t.y / len, -t.x / len);
    const den = n.x * cam.A;
    if (Math.abs(den) <= 1e-9) continue;
    const c = (n.x * p.x + n.y * (p.y - cam.y)) / den;
    if (c < -1 || c > 1) continue;
    const d = Math.acos(c);
    right.push({ angle: cam.alpha + d, y: p.y, r: p.x });
    left.push({ angle: cam.alpha - d, y: p.y, r: p.x });
  }
  if (right.length === 0) return;
  const desc = [...right].sort((a, b) => b.y - a.y);
  const asc = [...left].sort((a, b) => a.y - b.y);
  const arc = (from, to) => {
    let delta = to.angle - from.angle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    const pts = [];
    for (let i = 1; i < 15; i++) {
      const t = i / 15;
      pts.push({
        angle: from.angle + delta * t,
        y: from.y + (to.y - from.y) * t,
        r: from.r + (to.r - from.r) * t,
      });
    }
    return pts;
  };
  const loop = [
    ...desc,
    ...arc(desc[desc.length - 1], asc[0]),
    ...asc,
    ...arc(asc[asc.length - 1], desc[0]),
    desc[0],
  ];
  polyWorld(
    loop.map((p) => new Vector3(Math.sin(p.angle) * p.r, p.y, Math.cos(p.angle) * p.r)),
    group,
    '#1A1918',
    1.4,
  );
}
silhouette(JAR_BODY, jarGroup, L.jar);
silhouette(
  [
    [0.74, 2.99 - 0.19],
    [0.83, 2.99 + 0.19],
  ],
  jarGroup,
  L.jar,
);

// 机のグループ（手帳・鉛筆・棚）。scene.ts の buildBooks と同じ変換。
const books = new Group();
books.position.set(L.desk.x, L.desk.y, L.desk.z);
books.rotation.y = L.deskRotationY;
books.updateMatrixWorld(true);
{
  const counts = L.entryCounts.slice(0, L.deskNotebooks);
  const thick = counts.map((c) => 0.2 + Math.min(40, c) * 0.01);
  let baseY = 0;
  const placements = [];
  for (let i = counts.length - 1; i >= 0; i--) {
    placements.push({ baseY, t: thick[i] });
    baseY += thick[i] + 0.012;
  }
  for (const { baseY: base, t } of placements) {
    const { top, bottom, verticals } = boxEdges(2.6, t + 0.05, 3.4, new Vector3(0, base, 0));
    polyWorld(top, books, '#1A1918', 1, { fill: '#FDFCF9' });
    polyWorld(bottom, books, '#1A1918', 0.8);
    for (const v of verticals) polyWorld(v, books, '#1A1918', 0.8);
  }
}
if (L.pen) {
  const pen = new Object3D();
  pen.position.set(L.pen.x, L.pen.y, L.pen.z);
  pen.rotation.x = Math.PI / 2;
  pen.rotation.y = 0.3;
  books.add(pen);
  polyWorld([new Vector3(0, -(1.9 / 2 + 0.34), 0), new Vector3(0, 1.9 / 2, 0)], pen, '#1A1918', 3);
}
{
  const shelf = new Group();
  const lift = L.shelf.tiltX !== 0 ? 0.22 : 0;
  shelf.position
    .set(L.shelf.x - L.desk.x, L.shelf.y - L.desk.y + lift, L.shelf.z - L.desk.z)
    .applyAxisAngle(new Vector3(0, 1, 0), -L.deskRotationY);
  shelf.rotation.y = -0.35 - L.deskRotationY;
  shelf.rotation.x = L.shelf.tiltX;
  shelf.scale.setScalar(L.shelf.scale);
  books.add(shelf);
  const { top, bottom, verticals } = boxEdges(2.6, 0.06, 1.1);
  polyWorld(top, shelf, '#1A1918', 1, { fill: '#FDFCF9' });
  polyWorld(bottom, shelf, '#1A1918', 0.8);
  for (const v of verticals) polyWorld(v, shelf, '#1A1918', 0.8);
  for (const x of [-1.3, 1.3]) {
    polyWorld(
      [
        new Vector3(x, 0, -0.55),
        new Vector3(x, 1.7, -0.55),
        new Vector3(x, 1.7, 0.55),
        new Vector3(x, 0, 0.55),
      ],
      shelf,
      '#6d685f',
      1,
    );
  }
  const n = L.shelfCount;
  const step = (2.6 * 0.82) / Math.max(n, 3);
  const start = -((n - 1) * step) / 2;
  for (let i = 0; i < n; i++) {
    const spine = boxEdges(0.26, 1.5, 0.99, new Vector3(start + step * i, 0.03, 0));
    polyWorld(spine.top, shelf, '#1A1918', 0.8);
    polyWorld(spine.bottom, shelf, '#1A1918', 0.8);
    for (const v of spine.verticals) polyWorld(v, shelf, '#1A1918', 0.8);
  }
  const world = new Vector3();
  shelf.updateMatrixWorld(true);
  shelf.getWorldPosition(world);
  console.log(
    `shelf world = (${world.x.toFixed(2)}, ${world.y.toFixed(2)}, ${world.z.toFixed(2)})`,
  );
}

// ピル（labels.ts の clampPillToScreen と同じ押し戻し）。
const pills = [];
for (const kind of ['jar', 'journal', 'board', 'archive']) {
  const a = L.labelAnchors[kind];
  const [x0, y0] = px(new Vector3(a.x, a.y, a.z));
  const off = L.pillOffsets[kind];
  const w = L.pillWidths[kind];
  const h = 44;
  const margin = 10;
  const x = Math.min(Math.max(x0 + off.x, w / 2 + margin), W - w / 2 - margin);
  const y = Math.min(Math.max(y0 + off.y, h / 2 + margin), H - h / 2 - margin);
  pills.push({ kind, x, y, w, h, ax: x0, ay: y0 });
  console.log(
    `${kind.padEnd(8)} anchor px(${x0.toFixed(0)}, ${y0.toFixed(0)}) pill x[${(x - w / 2).toFixed(0)}..${(x + w / 2).toFixed(0)}] y[${(y - h / 2).toFixed(0)}..${(y + h / 2).toFixed(0)}]`,
  );
}

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n<rect width="100%" height="100%" fill="#FAF8F3"/>\n`;
for (const s of shapes) {
  const d = s.points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(' ');
  svg += `<path d="${d}" fill="${s.fill ?? 'none'}" stroke="${s.stroke}" stroke-width="${s.width}" stroke-linejoin="round"/>\n`;
}
for (const p of pills) {
  svg += `<circle cx="${p.ax.toFixed(1)}" cy="${p.ay.toFixed(1)}" r="3" fill="#c0392b"/>\n`;
  svg += `<rect x="${(p.x - p.w / 2).toFixed(1)}" y="${(p.y - p.h / 2).toFixed(1)}" width="${p.w}" height="${p.h}" rx="22" fill="rgba(253,251,247,0.9)" stroke="#7a7440" stroke-opacity="0.35"/>\n`;
  svg += `<text x="${p.x.toFixed(1)}" y="${(p.y + 4).toFixed(1)}" font-family="Helvetica" font-size="10" letter-spacing="2" text-anchor="middle" fill="#5C4F3F">${p.kind.toUpperCase()}</text>\n`;
}
svg += '</svg>\n';
writeFileSync(out, svg);
console.log('wrote', out, `${W}x${H}`);
