import * as THREE from 'three';
import { X, Z } from '../core/units';
import type { ItemOf } from '../data/query';
import { FACING_YAW, add, gbox, lathe, rng, worldUV, type Build } from './prims';
import { skin } from './shapes';

/*
 * 陳設（2026-10 依調查重做；公尺）：
 *  琴葉榕  室內 150–170 盆栽：單幹、樹冠從約 0.9 m 開始；約 35 片提琴形葉（長 20–30、寬 15–22，最寬在 7–8 成、腰在 4 成，
 *          葉基心形、葉端平截），葉柄 2–5、互生螺旋（約 137°）、往枝端聚集；盆 Ø40 × 40 灰褐纖維土盆（NParks、UF/IFAS）
 *  橄欖樹  半標準型：淨幹到約 0.9 m、圓頭 Ø70–80；葉 4–8 × 0.8–1.2 對生，表面灰綠、背面銀白；盆 Ø42 × 41（Rodborough）
 *  花瓶    Kähler Hammershøi 200：Ø16.5 × 20 桶形（最寬在 6 成高）、約 40 道直向凹槽、1 cm 素面頸、亮釉；插乾燥枝
 *  收納箱  IKEA TJENA 50 × 35 × 30 白色紙板、套蓋 3 cm，短邊各一個 8.5 × 2.75 把手孔（離蓋緣 0.5）
 *  掛畫    IKEA RÖDALM 50 × 70：外框 52 × 72 × 3、框面 2；卡紙開口 39 × 49；聚苯乙烯面板
 */

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/* ---------- 盆栽 ---------- */

/** 一片葉：沿長度 t（0 葉基、1 葉端）給半寬比例 w(t)；葉面沿中脈對折 fold、往下垂 droop。本地：長沿 +z、寬沿 x、正面 +y */
function leafGeo(w: (t: number) => number, fold: number, droop: number, nt = 12, ns = 6): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= nt; i++) {
    // 兩端加密（葉基、葉端的輪廓變化最大）
    const t = 0.5 - 0.5 * Math.cos((Math.PI * i) / nt), hw = w(t);
    for (let j = 0; j <= ns; j++) {
      const s = (j / ns) * 2 - 1;
      pos.push(s * hw, fold * Math.abs(s) * hw - droop * t * t, t);
      uv.push(s, t);
    }
  }
  const W = ns + 1;
  for (let i = 0; i < nt; i++) for (let j = 0; j < ns; j++) {
    const a = i * W + j, b = a + 1, c = a + W, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 提琴形葉：葉基窄（心形）、4 成處收腰、7–8 成最寬、葉端平截 */
const fiddleW = (t: number) => {
  const base = Math.min(1, t / 0.06) * 0.42;
  const body = 0.62 + 0.38 * Math.exp(-(((t - 0.76) / 0.2) ** 2)) - 0.1 * Math.exp(-(((t - 0.4) / 0.12) ** 2));
  // 葉端平截：到 95% 還很寬，最後 5% 才收
  const tip = t > 0.93 ? Math.sqrt(Math.max(0, 1 - ((t - 0.93) / 0.07) ** 2)) : 1;
  return 0.5 * Math.min(t < 0.06 ? base : body, body) * tip;
};
/** 橄欖葉：細長披針形 */
const oliveW = (t: number) => 0.5 * Math.sin(Math.PI * Math.min(1, t)) ** 0.8 * (1 - 0.25 * t);

/** 盆：lathe 外形 [半徑, 高]，內壁與土面 */
function pot(b: Build, g: THREE.Group, profile: [number, number][], m: THREE.Material, soilH: number, soilR: number): void {
  add(g, lathe(profile, 48), m);
  add(g, new THREE.CircleGeometry(soilR, 40).rotateX(-Math.PI / 2), b.mat.soil, 0, soilH, 0, false);
}

/** 樹枝：沿點列的漸細管 */
function branch(g: THREE.Object3D, pts: THREE.Vector3[], r0: number, r1: number, m: THREE.Material): void {
  const curve = new THREE.CatmullRomCurve3(pts), seg = Math.max(4, pts.length * 4);
  const geo = new THREE.TubeGeometry(curve, seg, 1, 8, false), p = geo.attributes.position, n = geo.attributes.normal;
  // TubeGeometry 等粗：依長度位置把每圈往中心縮
  for (let i = 0; i <= seg; i++) {
    const c = curve.getPointAt(i / seg), r = r0 + (r1 - r0) * (i / seg);
    for (let k = 0; k <= 8; k++) {
      const v = i * 9 + k;
      p.setXYZ(v, c.x + n.getX(v) * r, c.y + n.getY(v) * r, c.z + n.getZ(v) * r);
    }
  }
  geo.computeVertexNormals();
  add(g, geo, m);
}

/** 葉片實例：正面、背面各一個 InstancedMesh（背面顏色較淺） */
function leaves(g: THREE.Object3D, geo: THREE.BufferGeometry, mats: [THREE.Material, THREE.Material], list: THREE.Matrix4[]): void {
  for (const m of mats) {
    const im = new THREE.InstancedMesh(geo, m, list.length);
    list.forEach((mx, i) => im.setMatrixAt(i, mx));
    im.castShadow = im.receiveShadow = true;
    g.add(im);
  }
}

/** 一片葉的擺法：從 base 沿方向 dir（水平方位 yaw、仰角 pitch）伸出，繞自身長軸轉 roll，大小 len × wid */
function leafMatrix(base: THREE.Vector3, yaw: number, pitch: number, roll: number, len: number, wid: number): THREE.Matrix4 {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch, yaw, roll, 'YXZ'));
  return new THREE.Matrix4().compose(base, q, V(wid, wid, len));
}

export function plant(b: Build, it: ItemOf<'plant'>): void {
  const g = new THREE.Group();
  g.position.set(X(it.at[0]), 0, Z(it.at[1]));
  b.root.add(g);
  if (it.kind === 'fiddleLeaf') fiddleLeaf(b, g, it.seed);
  else olive(b, g, it.seed);
  const R = it.kind === 'fiddleLeaf' ? 0.2 : 0.21;
  b.solids.push([X(it.at[0]) - R, Z(it.at[1]) - R, X(it.at[0]) + R, Z(it.at[1]) + R]);
}

/** 琴葉榕（標準型）：單幹到約 0.9 m 分三枝，葉片互生螺旋、往枝端聚集 */
function fiddleLeaf(b: Build, g: THREE.Group, seed: number): void {
  const { mat } = b, r = rng(seed);
  pot(b, g, [[0.001, 0], [0.17, 0], [0.19, 0.02], [0.2, 0.38], [0.2, 0.4], [0.188, 0.4], [0.186, 0.33], [0.001, 0.33]], mat.potFibre, 0.36, 0.186);
  const trunk = [V(0, 0.36, 0), V(0.01, 0.6, 0.005), V(-0.005, 0.85, 0.01), V(0, 0.95, 0)];
  branch(g, trunk, 0.016, 0.011, mat.bark);
  const list: THREE.Matrix4[] = [];
  const top = trunk[trunk.length - 1];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + r() * 0.6, lean = 0.12 + r() * 0.12, len = 0.45 + r() * 0.25;
    const end = top.clone().add(V(Math.cos(a) * lean, len, Math.sin(a) * lean));
    const mid = top.clone().lerp(end, 0.5).add(V(Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04));
    const pts = [top.clone(), mid, end];
    branch(g, pts, 0.009, 0.005, mat.bark);
    // 每枝 11–13 片，越往枝端越密、越大
    const curve = new THREE.CatmullRomCurve3(pts), n = 11 + ((r() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const t = 0.25 + 0.75 * Math.sqrt(i / (n - 1)), p = curve.getPointAt(t);
      const yaw = a + i * 2.4 + (r() - 0.5) * 0.4, s = 0.8 + 0.4 * t + (r() - 0.5) * 0.15;
      // 葉柄 3 cm，往外上 45°
      const pet = p.clone().add(V(Math.sin(yaw) * 0.022, 0.022, Math.cos(yaw) * 0.022));
      list.push(leafMatrix(pet, yaw, 0.1 + r() * 0.35 - 0.2 * (1 - t), (r() - 0.5) * 0.4, 0.26 * s, 0.24 * s));
      branch(g, [p, pet], 0.003, 0.0025, mat.plantStem);
    }
  }
  leaves(g, leafGeo(fiddleW, 0.1, 0.05, 14, 8), [mat.plant, mat.plantUnder], list);
}

/** 橄欖樹（半標準型）：淨幹到約 0.9 m，主枝 8 支、每支 9 根細枝（多半再分一小枝）伸到圓頭樹冠外殼，葉十字對生 */
function olive(b: Build, g: THREE.Group, seed: number): void {
  const { mat } = b, r = rng(seed);
  // Rodborough 盆：圓柱、上緣捲邊
  pot(b, g, [[0.001, 0], [0.19, 0], [0.205, 0.015], [0.205, 0.375], [0.214, 0.385], [0.214, 0.405], [0.205, 0.41], [0.19, 0.41], [0.188, 0.34], [0.001, 0.34]], mat.potStone, 0.37, 0.188);
  const trunk = [V(0, 0.37, 0), V(0.012, 0.55, -0.008), V(-0.01, 0.75, 0.006), V(0.006, 0.92, 0)];
  branch(g, trunk, 0.016, 0.012, mat.oliveBark);
  // 樹冠：橢球（中心 1.28 m、半徑 0.38 × 0.32）。主枝從幹頂往冠層散開，細枝伸到橢球殼上、中段再分一小枝；
  // 葉對生且十字交互（每節轉 90°），往枝端斜 35° 伸出，看起來才是一團毛茸茸的圓頭而不是羽狀葉
  const top = trunk[trunk.length - 1], list: THREE.Matrix4[] = [];
  const C = V(0, 1.28, 0), RX = 0.38, RY = 0.32, nb = 8, UP = V(0, 1, 0);
  const shell = (az: number, el: number, f: number) => C.clone().add(V(RX * Math.cos(el) * Math.cos(az) * f, RY * Math.sin(el) * f, RX * Math.cos(el) * Math.sin(az) * f));
  const twig = (b0: THREE.Vector3, tip: THREE.Vector3, r0: number) => {
    const mid = b0.clone().lerp(tip, 0.5).add(V((r() - 0.5) * 0.04, 0.03, (r() - 0.5) * 0.04));
    const cv = new THREE.CatmullRomCurve3([b0, mid, tip]);
    branch(g, cv.points, r0, 0.0012, mat.oliveBark);
    const L = cv.getLength(), q = new THREE.Quaternion(), m = new THREE.Matrix4();
    let phase = r() * Math.PI;
    for (let d = 0.3 * L; d < L; d += 0.014) {
      const t = d / L, p = cv.getPointAt(t), dir = cv.getTangentAt(t);
      const p1 = new THREE.Vector3().crossVectors(dir, UP).normalize(), p2 = new THREE.Vector3().crossVectors(dir, p1);
      phase += Math.PI / 2 + (r() - 0.5) * 0.3;
      for (const side of [0, Math.PI]) {
        const out = p1.clone().multiplyScalar(Math.cos(phase + side)).addScaledVector(p2, Math.sin(phase + side));
        const z = dir.clone().multiplyScalar(Math.cos(0.6)).addScaledVector(out, Math.sin(0.6)).normalize();
        const y = UP.clone().addScaledVector(z, -UP.dot(z)).normalize(), x = new THREE.Vector3().crossVectors(y, z);
        q.setFromRotationMatrix(m.makeBasis(x, y, z));
        const sc = 0.75 + r() * 0.5;
        list.push(new THREE.Matrix4().compose(p, q, V(0.014 * sc, 0.014 * sc, 0.06 * sc)));
      }
    }
    return cv;
  };
  for (let k = 0; k < nb; k++) {
    const a = (k / nb) * Math.PI * 2 + r() * 0.5;
    const end = top.clone().add(V(Math.cos(a) * (0.14 + r() * 0.08), 0.2 + r() * 0.15, Math.sin(a) * (0.14 + r() * 0.08)));
    const main = new THREE.CatmullRomCurve3([top.clone(), top.clone().lerp(end, 0.5).add(V(0, 0.02, 0)), end]);
    branch(g, main.points, 0.009, 0.005, mat.oliveBark);
    for (let j = 0; j < 9; j++) {
      const az = a + (r() - 0.5) * 1.8, el = Math.asin(-0.85 + 1.8 * r());
      const cv = twig(main.getPointAt(0.3 + 0.7 * r()), shell(az, el, 0.85 + 0.15 * r()), 0.0035);
      // 中段分一小枝，伸到旁邊的殼上
      if (r() < 0.7) twig(cv.getPointAt(0.5), shell(az + (r() - 0.5) * 0.7, el + (r() - 0.5) * 0.5, 0.9 + 0.1 * r()), 0.002);
    }
  }
  leaves(g, leafGeo(oliveW, 0.08, 0.002, 6, 2), [mat.oliveLeaf, mat.oliveUnder], list);
}

/* ---------- 花瓶 ---------- */

/** Kähler Hammershøi 外形（cm）：[半徑, 高]；中段 40 道直向凹槽，頸部 1 cm 素面 */
const HAMMERSHOI: [number, number][] = [[5.75, 0], [5.7, 1.3], [6.8, 3.4], [7.6, 6], [8.1, 9], [8.25, 11.7], [8.0, 15], [7.5, 17.3], [6.0, 19.0], [5.65, 19.4], [5.65, 20]];

export function vase(b: Build, it: ItemOf<'vase'>): void {
  const { mat } = b;
  const g = new THREE.Group();
  g.position.set(X(it.at[0]), it.h, Z(it.at[1]));
  b.root.add(g);
  // 外壁：沿高度一圈圈，凹槽深 2.5 mm（從腳上 1.5 cm 到頸下）
  const N = 160, prof: [number, number][] = [];
  for (let i = 0; i < HAMMERSHOI.length - 1; i++) {
    const [r0, h0] = HAMMERSHOI[i], [r1, h1] = HAMMERSHOI[i + 1], steps = Math.max(1, Math.round((h1 - h0) / 0.6));
    for (let k = 0; k < steps; k++) prof.push([r0 + ((r1 - r0) * k) / steps, h0 + ((h1 - h0) * k) / steps]);
  }
  prof.push(HAMMERSHOI[HAMMERSHOI.length - 1]);
  const rings = prof.map(([rr, hh]) => {
    const fl = THREE.MathUtils.smoothstep(hh, 1.2, 2.2) * (1 - THREE.MathUtils.smoothstep(hh, 18.2, 19.0));
    return Array.from({ length: N }, (_, j) => {
      const a = (j / N) * Math.PI * 2, f = 0.25 * fl * (0.5 + 0.5 * Math.cos(a * 40));
      return V(((rr - f) / 100) * Math.cos(a), hh / 100, ((rr - f) / 100) * Math.sin(a));
    });
  });
  // 內壁（厚 4 mm）往下走回去、底部封口
  const inner = [...prof].reverse().slice(0, -1).map(([rr, hh]) => Array.from({ length: N }, (_, j) => {
    const a = (j / N) * Math.PI * 2, ri = Math.max(0.5, rr - 0.4) / 100;
    return V(ri * Math.cos(a), Math.max(0.6, hh) / 100, ri * Math.sin(a));
  }));
  // 圈的方向：x→z 逆時針；外壁往上（法線朝外）接內壁往下（法線朝內）
  add(g, skin([...rings, ...inner], { capStart: true, capEnd: true }), mat.glaze);
  // 乾燥枝：5 支細枝往外散開，上段掛小果穗
  const r = rng(it.seed), seeds: THREE.Matrix4[] = [];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + r() * 0.8, lean = 0.06 + r() * 0.1, hgt = 0.38 + r() * 0.14;
    const pts = [V(0, 0.04, 0), V(Math.cos(a) * 0.015, 0.2, Math.sin(a) * 0.015), V(Math.cos(a) * lean * 0.6, hgt * 0.75, Math.sin(a) * lean * 0.6), V(Math.cos(a) * lean, hgt, Math.sin(a) * lean)];
    branch(g, pts, 0.0022, 0.0012, mat.dried);
    const c = new THREE.CatmullRomCurve3(pts);
    for (let i = 0; i < 14; i++) {
      const p = c.getPointAt(0.6 + 0.4 * (i / 13)).add(V((r() - 0.5) * 0.025, (r() - 0.5) * 0.01, (r() - 0.5) * 0.025));
      seeds.push(new THREE.Matrix4().compose(p, new THREE.Quaternion(), V(1, 1, 1).multiplyScalar(0.7 + r() * 0.6)));
    }
  }
  const sm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0032, 8, 6), mat.dried, seeds.length);
  seeds.forEach((m, i) => sm.setMatrixAt(i, m));
  sm.castShadow = true;
  g.add(sm);
}

/* ---------- 收納箱 ---------- */

/** IKEA TJENA 附蓋收納箱：rect 為箱身（長邊沿 rect 較長的一邊），h0 為放置高度 */
export function storageBox(b: Build, it: ItemOf<'storageBox'>): void {
  const { mat } = b;
  const [x1, y1, x2, y2] = it.rect, H = 0.3, LID = 0.03;
  const alongX = x2 - x1 >= y2 - y1;
  const L = (alongX ? x2 - x1 : y2 - y1) / 100, D = (alongX ? y2 - y1 : x2 - x1) / 100;
  const g = new THREE.Group();
  g.position.set(X((x1 + x2) / 2), it.h0, Z((y1 + y2) / 2));
  g.rotation.y = alongX ? 0 : Math.PI / 2;
  b.root.add(g);
  gbox(g, L, H - LID + 0.002, D, 0, (H - LID) / 2, 0, mat.tjena, 0.002);
  gbox(g, L + 0.006, LID, D + 0.006, 0, H - LID / 2, 0, mat.tjena, 0.002);
  // 短邊把手孔（離蓋緣 0.5 cm）
  for (const s of [-1, 1]) gbox(g, 0.004, 0.0275, 0.085, s * (L / 2 - 0.0015), H - LID - 0.005 - 0.0275 / 2, 0, mat.gap, 0.006);
  for (const m of g.children) worldUV((m as THREE.Mesh).geometry, m.position);
  if (it.h0 === 0) b.solid(it.rect);
}

/* ---------- 掛畫 ---------- */

/** 程式畫的版畫（400 × 500 px，對應 40 × 50 cm） */
function printTexture(kind: ItemOf<'art'>['print']): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 400;
  c.height = 500;
  const x = c.getContext('2d')!;
  const paper = '#ece5d8', ink = '#3a3631';
  x.fillStyle = paper;
  x.fillRect(0, 0, 400, 500);
  if (kind === 'arches') {
    // 兩個疊在一起的拱形（陶土、沙色）＋細線
    x.fillStyle = '#d9b98f';
    x.beginPath(); x.moveTo(70, 420); x.lineTo(70, 230); x.arc(170, 230, 100, Math.PI, 0); x.lineTo(270, 420); x.fill();
    x.fillStyle = '#b8673f';
    x.beginPath(); x.moveTo(170, 420); x.lineTo(170, 290); x.arc(240, 290, 70, Math.PI, 0); x.lineTo(310, 420); x.fill();
    x.strokeStyle = ink; x.lineWidth = 3;
    x.beginPath(); x.moveTo(50, 420); x.lineTo(350, 420); x.stroke();
  } else if (kind === 'sun') {
    // 赭黃圓、深色地平面、一條細線
    x.fillStyle = '#c48a3a';
    x.beginPath(); x.arc(200, 250, 105, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#3d3a36';
    x.fillRect(40, 300, 320, 140);
    x.strokeStyle = '#c48a3a'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(40, 330); x.lineTo(360, 330); x.stroke();
  } else {
    // 等高線
    x.strokeStyle = ink; x.lineWidth = 1.6;
    for (let k = 0; k < 14; k++) {
      x.beginPath();
      for (let a = 0; a <= 64; a++) {
        const t = (a / 64) * Math.PI * 2, rr = 18 + k * 13 + 8 * Math.sin(t * 3 + k * 0.4) + 5 * Math.cos(t * 5 - k * 0.3);
        const px = 200 + rr * Math.cos(t) * 1.05, py = 230 + rr * Math.sin(t) * 1.25;
        if (a === 0) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** 掛畫（IKEA RÖDALM 50 × 70，黑框＋白卡紙＋聚苯乙烯面板）：at 為牆面上的畫中心、h 為中心高、facing 為朝向 */
export function art(b: Build, it: ItemOf<'art'>): void {
  const { mat } = b;
  const g = new THREE.Group();
  g.position.set(X(it.at[0]), it.h, Z(it.at[1]));
  g.rotation.y = FACING_YAW[it.facing];
  b.root.add(g);
  const W = 0.52, H = 0.72, D = 0.03, F = 0.02;
  // 外框四邊、背板
  gbox(g, W, F, D, 0, H / 2 - F / 2, D / 2, mat.black, 0.002);
  gbox(g, W, F, D, 0, -H / 2 + F / 2, D / 2, mat.black, 0.002);
  for (const s of [-1, 1]) gbox(g, F, H - 2 * F, D, s * (W / 2 - F / 2), 0, D / 2, mat.black, 0.002);
  gbox(g, W - 2 * F, H - 2 * F, 0.004, 0, 0, 0.002, mat.black, 0);
  // 卡紙（開口 39 × 49）與版畫
  const mw = W - 2 * F, mh = H - 2 * F, ow = 0.39, oh = 0.49, z = D - 0.008;
  const matShape = new THREE.Shape([V(-mw / 2, -mh / 2, 0), V(mw / 2, -mh / 2, 0), V(mw / 2, mh / 2, 0), V(-mw / 2, mh / 2, 0)].map((p) => new THREE.Vector2(p.x, p.y)));
  matShape.holes.push(new THREE.Path([new THREE.Vector2(-ow / 2, -oh / 2), new THREE.Vector2(ow / 2, -oh / 2), new THREE.Vector2(ow / 2, oh / 2), new THREE.Vector2(-ow / 2, oh / 2)]));
  add(g, new THREE.ShapeGeometry(matShape), mat.paper, 0, 0, z, false);
  const printMat = new THREE.MeshStandardMaterial({ map: printTexture(it.print), roughness: 0.9 });
  printMat.name = `print-${it.print}`;
  add(g, new THREE.PlaneGeometry(0.4, 0.5), printMat, 0, 0, z - 0.002, false);
  // 面板：只畫反射（同清玻璃）
  add(g, new THREE.PlaneGeometry(mw, mh), mat.glass, 0, 0, D - 0.003, false);
}
