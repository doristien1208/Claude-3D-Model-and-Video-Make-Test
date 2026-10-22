import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { X, Z, toPxX, toPxY } from '../core/units';
import { doors as doorData, type Door, type Rect, type Side } from '../data/layout';
import { findOpening, isHorizontal } from '../data/query';
import { rectAlong, worldUV, type Build, type Solid } from './prims';

/* ---------- 尺寸（px = cm，高度為 m） ---------- */
const J = 2;            // 門樘厚
const GW = 0.5;         // 門樘與牆面之間的陰影縫寬
const GD = 1;           // 陰影縫深
const G = 0.3;          // 門片四周門縫
const UNDERCUT = 0.008; // 門片底部離地（有門檻石時再加門檻高）
const THRESHOLD_H = 0.006;
const STOP_W = 1.2, STOP_D = 1; // 門擋條：凸出門樘 1.2 cm、厚 1 cm
const HANDLE_H = 0.9, BACKSET = 6.5; // 門把中心高（一般 0.9–1.05 m，取下緣）、離門片自由端
const CLEAR = 0.3;                   // 碰撞檢查的安全距離（px）：門把停在碰到之前 3 mm
const HINGE_Y = [0.25, 1.05, 1.85];

/** 開口所在牆的局部座標：along 沿牆、across 垂直牆（皆 px） */
interface WallFrame {
  hor: boolean;
  s: number;
  e: number;
  top: number;
  /** 牆兩個面的 across 座標（c0 < c1） */
  c0: number;
  c1: number;
}

function frameOf(openingId: string): WallFrame {
  const { wall, opening } = findOpening(openingId);
  const hor = isHorizontal(wall), c = hor ? wall.a[1] : wall.a[0];
  return { hor, s: opening.s, e: opening.e, top: opening.top, c0: c - wall.t / 2, c1: c + wall.t / 2 };
}

/** across 方向的正負號：N/W 為 −1，S/E 為 +1 */
const sideSign = (s: Side): 1 | -1 => (s === 'S' || s === 'E' ? 1 : -1);

const rectAC = (f: WallFrame, a0: number, a1: number, k0: number, k1: number): Rect => rectAlong(f.hor, a0, a1, k0, k1);
/** (along, across) px → 平面 (x, y) */
const planPt = (f: WallFrame, along: number, across: number): [number, number] => (f.hor ? [along, across] : [across, along]);
/** 平面上 (along, across) 方向向量 → 世界座標 (X, Z) */
const worldVec = (f: WallFrame, along: number, across: number): THREE.Vector3 =>
  f.hor ? new THREE.Vector3(along, 0, across) : new THREE.Vector3(across, 0, along);

/* ---------- 碰撞檢查：門扇開到幾度會碰到東西 ---------- */

/** 障礙物：平面外框（px）＋高度範圍（m）＋來源（layout 物件 id 或建築） */
type Obstacle = [x1: number, y1: number, x2: number, y2: number, h0: number, h1: number, name: string];

/** 取目前場景裡所有 mesh 的外框當障礙物（不含地坪、地毯、天花板上的東西） */
export function collectObstacles(root: THREE.Object3D): Obstacle[] {
  const out: Obstacle[] = [];
  const box = new THREE.Box3();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    box.setFromObject(o);
    if (box.max.y <= 0.035 || box.min.y >= 2.2) return;
    let src: THREE.Object3D | null = o;
    while (src && !src.userData.item) src = src.parent;
    out.push([toPxX(box.min.x), toPxY(box.min.z), toPxX(box.max.x), toPxY(box.max.z), box.min.y, box.max.y, src?.userData.item ?? '?']);
  });
  return out;
}

/** 門把外形的取樣點：[沿門片距鉸鏈, 離門片面, 高度] */
function handleSamples(W: number): [number, number, number][] {
  const ah = W - BACKSET, pts: [number, number, number][] = [];
  for (const k of [0, 0.4, 0.8]) for (let d = 0; d < 360; d += 30)
    for (const h of [HANDLE_H - 0.02, HANDLE_H, HANDLE_H + 0.02]) pts.push([ah + 2.5 * Math.cos((d * Math.PI) / 180), k, h]);
  for (const k of [1.5, 3, 4.7]) pts.push([ah, k, HANDLE_H]);
  // 撥桿直徑 1.6 cm：取中心與上下緣
  for (let a = ah + 0.8; a >= ah - 12; a -= 0.5) for (const k of [4.7, 5.5, 6.3]) for (const dh of [-0.007, 0, 0.007]) pts.push([a, k, HANDLE_H + dh]);
  return pts;
}

/* ---------- 門的控制介面 ---------- */

export interface DoorCtl {
  id: string;
  label: string;
  kind: Door['kind'];
  /** 0 = 關、1 = 全開 */
  open: number;
  /** 平開門的全開角度（度） */
  maxDeg?: number;
  /** 碰撞檢查找到、限制全開角度的東西 */
  limitedBy?: string;
  set(t: number): void;
}

export class Doors {
  readonly list: DoorCtl[] = [];
  /** 門片目前占用的碰撞方塊（世界公尺）；漫遊時與靜態碰撞一起檢查 */
  readonly solids: Solid[] = [];
  private readonly solidOf = new Map<string, () => Solid>();

  get(id: string): DoorCtl | undefined {
    return this.list.find((d) => d.id === id);
  }

  set(id: string, t: number): void {
    this.get(id)?.set(t);
  }

  /** @internal */
  register(ctl: DoorCtl, solid: () => Solid): void {
    this.list.push(ctl);
    this.solidOf.set(ctl.id, solid);
  }

  /** @internal */
  refreshSolids(): void {
    this.solids.length = 0;
    for (const f of this.solidOf.values()) this.solids.push(f());
  }
}

/* ---------- 平開門：隱框門樘＋門片＋門把＋鉸鏈 ---------- */

function swingDoor(b: Build, d: Extract<Door, { kind: 'swing' }>, obstacles: Obstacle[], doors: Doors): void {
  const { mat } = b;
  const f = frameOf(d.opening);
  const { s, e, top, c0, c1 } = f;
  const σ = sideSign(d.swing);
  const fs = σ > 0 ? c1 : c0; // 開門側的牆面
  const LT = d.leafT, W = e - s - 2 * J - 2 * G;
  const δ = d.hinge === 'start' ? 1 : -1;
  const ah = d.hinge === 'start' ? s + J + G : e - J - G;
  const jamb = mat.walnut, Jm = J / 100, GWm = GW / 100;

  // 門檻石（衛浴與大門）
  const thr = d.threshold ? THRESHOLD_H : 0;
  if (d.threshold) b.box(rectAC(f, s, e, c0, c1), 0, THRESHOLD_H, mat.stone, { cast: false });

  // 門樘：兩側＋上方，與牆面齊平
  b.box(rectAC(f, s + GW, s + J, c0, c1), 0, top - GWm, jamb);
  b.box(rectAC(f, e - J, e - GW, c0, c1), 0, top - GWm, jamb);
  b.box(rectAC(f, s + GW, e - GW, c0, c1), top - Jm, top - GWm, jamb);
  // 陰影縫：門樘與牆面之間 5 mm 寬、1 cm 深的凹縫
  b.box(rectAC(f, s, s + GW, c0 + GD, c1 - GD), 0, top, mat.gap, { cast: false });
  b.box(rectAC(f, e - GW, e, c0 + GD, c1 - GD), 0, top, mat.gap, { cast: false });
  b.box(rectAC(f, s, e, c0 + GD, c1 - GD), top - GWm, top, mat.gap, { cast: false });
  // 門擋條：在門片關閉位置的另一側
  const k0 = fs - σ * LT, k1 = fs - σ * (LT + STOP_D);
  b.box(rectAC(f, s + J, s + J + STOP_W, k0, k1), 0, top - Jm, jamb);
  b.box(rectAC(f, e - J - STOP_W, e - J, k0, k1), 0, top - Jm, jamb);
  b.box(rectAC(f, s + J, e - J, k0, k1), top - Jm - STOP_W / 100, top - Jm, jamb);

  // 門片繞鉸鏈軸旋轉；軸在開門側牆面、門片鉸鏈端的角上
  const [hx, hy] = planPt(f, ah, fs);
  const pivot = new THREE.Group();
  pivot.position.set(X(hx), 0, Z(hy));
  b.root.add(pivot);
  const along = worldVec(f, 1, 0), across = worldVec(f, 0, 1);
  const leafBot = UNDERCUT + thr, leafTop = top - Jm - G / 100;
  const sx = (f.hor ? W : LT) / 100, sz = (f.hor ? LT : W) / 100;
  const geo = new RoundedBoxGeometry(sx, leafTop - leafBot, sz, 2, 0.003);
  const local = along.clone().multiplyScalar((δ * W) / 200).add(across.clone().multiplyScalar((-σ * LT) / 200));
  local.y = (leafBot + leafTop) / 2;
  // 以關閉位置計算世界座標 UV，門片轉開後木紋跟著門走
  worldUV(geo, local.clone().add(pivot.position));
  const leaf = new THREE.Mesh(geo, mat[d.material]);
  leaf.position.copy(local);
  leaf.castShadow = leaf.receiveShadow = true;
  pivot.add(leaf);

  // 門把（兩面）：撥桿朝鉸鏈方向
  const toHinge = along.clone().multiplyScalar(-δ);
  for (const [base, out] of [[0, σ], [-σ * LT, -σ]] as const) {
    const anchor = along.clone().multiplyScalar((δ * (W - BACKSET)) / 100).add(across.clone().multiplyScalar(base / 100));
    anchor.y = HANDLE_H;
    pivot.add(lever(mat.blackSatin, anchor, across.clone().multiplyScalar(out), toHinge));
  }

  // 鉸鏈（不隨門片轉動）
  for (const y of HINGE_Y) {
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.1, 12), mat.blackSatin);
    k.position.set(X(hx), y, Z(hy));
    k.castShadow = true;
    b.root.add(k);
  }

  // 門扇的平面位置：鉸鏈 + a·d(θ) + b·t(θ)
  const at = (θ: number, a: number, bb: number): [number, number] => {
    const da = δ * Math.cos(θ), dc = σ * Math.sin(θ), ta = δ * Math.sin(θ), tc = -σ * Math.cos(θ);
    return planPt(f, ah + a * da + bb * ta, fs + a * dc + bb * tc);
  };

  // 全開角度：先每 1° 找到第一次碰撞，再以 0.25° 回頭細找，停在碰到之前的那一格（等同門擋位置）
  const near = obstacles.filter((o) => o[0] < hx + W + 10 && o[2] > hx - W - 10 && o[1] < hy + W + 10 && o[3] > hy - W - 10);
  const hit = (p: [number, number], h: number) =>
    near.find((o) => p[0] > o[0] - CLEAR && p[0] < o[2] + CLEAR && p[1] > o[1] - CLEAR && p[1] < o[3] + CLEAR && h > o[4] && h < o[5])?.[6];
  const hs = handleSamples(W);
  const collides = (deg: number): string | undefined => {
    const θ = (deg * Math.PI) / 180;
    for (let ai = 0; ai <= 40; ai++) for (const bb of [0, LT / 2, LT]) for (const h of [leafBot + 0.01, 0.5, 1.0, 1.5, leafTop - 0.01]) {
      const n = hit(at(θ, (ai * W) / 40, bb), h);
      if (n) return `門片碰到 ${n}`;
    }
    for (const [a, k, h] of hs) {
      const n = hit(at(θ, a, -k), h) ?? hit(at(θ, a, LT + k), h);
      if (n) return `門把碰到 ${n}`;
    }
    return undefined;
  };
  let maxDeg = 90, limitedBy: string | undefined;
  for (let i = 1; i <= 90 && !limitedBy; i++) {
    if (!collides(i)) continue;
    for (let q = i - 0.75; q <= i; q += 0.25) {
      limitedBy = collides(q);
      if (limitedBy) { maxDeg = q - 0.25; break; }
    }
  }

  // 旋轉方向：讓門片在 90° 時指向開門側
  const dirClosed = along.clone().multiplyScalar(δ), normal = across.clone().multiplyScalar(σ);
  const spin = Math.abs(dirClosed.z - normal.x) < 1e-6 && Math.abs(-dirClosed.x - normal.z) < 1e-6 ? 1 : -1;

  let θ = 0;
  const ctl: DoorCtl = {
    id: d.id, label: d.label, kind: 'swing', open: d.open, maxDeg, limitedBy,
    set(t: number) {
      ctl.open = Math.max(0, Math.min(1, t));
      θ = (ctl.open * maxDeg * Math.PI) / 180;
      pivot.rotation.y = spin * θ;
      doors.refreshSolids();
    },
  };
  doors.register(ctl, () => {
    const pts = [at(θ, 0, 0), at(θ, W, 0), at(θ, 0, LT), at(θ, W, LT)];
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return [X(Math.min(...xs)), Z(Math.min(...ys)), X(Math.max(...xs)), Z(Math.max(...ys))];
  });
}

/** 撥桿門把：圓座＋立柱＋撥桿；anchor 在門片表面，out 為離開門片的方向 */
function lever(m: THREE.Material, anchor: THREE.Vector3, out: THREE.Vector3, toHinge: THREE.Vector3): THREE.Group {
  const g = new THREE.Group();
  const axisTo = (mesh: THREE.Mesh, dir: THREE.Vector3) => mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  const part = (geo: THREE.BufferGeometry, dir: THREE.Vector3, pos: THREE.Vector3) => {
    const me = new THREE.Mesh(geo, m);
    axisTo(me, dir);
    me.position.copy(pos);
    me.castShadow = true;
    g.add(me);
  };
  part(new THREE.CylinderGeometry(0.025, 0.025, 0.008, 28), out, anchor.clone().addScaledVector(out, 0.004));
  part(new THREE.CylinderGeometry(0.009, 0.009, 0.047, 16), out, anchor.clone().addScaledVector(out, 0.0315));
  part(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 16), toHinge, anchor.clone().addScaledVector(out, 0.055).addScaledVector(toHinge, 0.051));
  return g;
}

/* ---------- 外掛拉門 ---------- */

function slideDoor(b: Build, d: Extract<Door, { kind: 'slide' }>, doors: Doors): void {
  const { mat } = b;
  const f = frameOf(d.opening);
  const σ = sideSign(d.side);
  const face = σ > 0 ? f.c1 : f.c0;
  const k0 = face + σ * d.gap, k1 = face + σ * (d.gap + d.leafT); // 門片的 across 範圍
  const L0 = f.s - d.overlap, L1 = f.e + d.overlap;                 // 關閉時的 along 範圍
  const dir = d.slideTo === 'start' ? -1 : 1;
  const tr0 = Math.min(L0, L0 + dir * d.travel) - 5, tr1 = Math.max(L1, L1 + dir * d.travel) + 4;

  // 軌道
  b.box(rectAC(f, tr0, tr1, face, k1 + σ), f.top, f.top + 0.04, mat.black);

  // 門片與五金放在一個群組裡，沿牆平移
  const g = new THREE.Group();
  b.root.add(g);
  const add = (r: Rect, h0: number, h1: number, m: THREE.Material, rounded = false) => {
    const [x1, y1, x2, y2] = r;
    const geo = rounded ? new RoundedBoxGeometry((x2 - x1) / 100, h1 - h0, (y2 - y1) / 100, 2, 0.003) : new THREE.BoxGeometry((x2 - x1) / 100, h1 - h0, (y2 - y1) / 100);
    const me = new THREE.Mesh(geo, m);
    me.position.set(X((x1 + x2) / 2), (h0 + h1) / 2, Z((y1 + y2) / 2));
    if ((m as THREE.MeshStandardMaterial).map) worldUV(geo, me.position);
    me.castShadow = me.receiveShadow = true;
    g.add(me);
  };
  add(rectAC(f, L0, L1, k0, k1), 0.01, f.top, mat.walnut, true);
  // 吊片
  for (const a of [L0 + 15, L1 - 15]) add(rectAC(f, a - 1.5, a + 1.5, k1, k1 + σ * 0.5), f.top - 0.12, f.top + 0.03, mat.black);
  // 走廊側直立把手（靠開啟後留在開口邊的那一端），房內側嵌入式取手
  const pa = dir < 0 ? L1 - 8 : L0 + 8;
  add(rectAC(f, pa - 0.8, pa + 0.8, k1 + σ * 3.5, k1 + σ * 5.1), HANDLE_H - 0.175, HANDLE_H + 0.175, mat.blackSatin);
  for (const h of [HANDLE_H - 0.15, HANDLE_H + 0.15]) add(rectAC(f, pa - 0.6, pa + 0.6, k1, k1 + σ * 3.5), h - 0.006, h + 0.006, mat.blackSatin);
  add(rectAC(f, pa - 1, pa + 1, k0 - σ * 0.2, k0 + σ * 0.3), HANDLE_H - 0.06, HANDLE_H + 0.06, mat.gap);

  const ctl: DoorCtl = {
    id: d.id, label: d.label, kind: 'slide', open: d.open,
    set(t: number) {
      ctl.open = Math.max(0, Math.min(1, t));
      const off = (dir * ctl.open * d.travel) / 100;
      g.position.copy(worldVec(f, off, 0));
      doors.refreshSolids();
    },
  };
  doors.register(ctl, () => {
    const off = dir * ctl.open * d.travel;
    const [x1, y1, x2, y2] = rectAC(f, L0 + off, L1 + off, k0, k1);
    return [X(x1), Z(y1), X(x2), Z(y2)];
  });
}

/* ---------- 陽台落地拉門：固定片＋活動片，深色鋁框 ---------- */

function slideGlass(b: Build, d: Extract<Door, { kind: 'slideGlass' }>, doors: Doors): void {
  const { mat } = b;
  const { s } = frameOf(d.opening);
  const c = d.wallY, h = d.h, HEAD = 0.05, TRACK = 0.03;
  // 外框：上框、下軌、起始端立框（另一端直接收進東牆）
  b.bx(s, c - 2, d.trackEnd, c + 7, h - HEAD, h, mat.alu);
  b.bx(s, c - 2, d.trackEnd, c + 7, 0, TRACK, mat.alu);
  b.bx(s, c - 2, d.fixed[0], c + 7, TRACK, h - HEAD, mat.alu);

  // 一片門扇：左右框 4 px、上框 6 cm、下框 8 cm、中間玻璃
  const panel = (a0: number, a1: number, k0: number, k1: number, add: (r: Rect, h0: number, h1: number, m: THREE.Material) => void) => {
    const h0 = TRACK, h1 = h - HEAD, kc = (k0 + k1) / 2;
    add([a0, k0, a0 + 4, k1], h0, h1, mat.alu);
    add([a1 - 4, k0, a1, k1], h0, h1, mat.alu);
    add([a0 + 4, k0, a1 - 4, k1], h0, h0 + 0.08, mat.alu);
    add([a0 + 4, k0, a1 - 4, k1], h1 - 0.06, h1, mat.alu);
    add([a0 + 4, kc - 0.3, a1 - 4, kc + 0.3], h0 + 0.08, h1 - 0.06, mat.glass);
  };
  panel(d.fixed[0], d.fixed[1], c - 2, c + 2, (r, h0, h1, m) => b.box(r, h0, h1, m, { cast: m !== mat.glass }));
  b.solid([d.fixed[0], c - 2, d.fixed[1], c + 2]);

  // 活動片以全開位置建模，關閉時往 trackEnd 平移；室內側直立把手在東側框
  const g = new THREE.Group();
  b.root.add(g);
  const add = (r: Rect, h0: number, h1: number, m: THREE.Material) => {
    const [x1, y1, x2, y2] = r;
    const me = new THREE.Mesh(new THREE.BoxGeometry((x2 - x1) / 100, h1 - h0, (y2 - y1) / 100), m);
    me.position.set(X((x1 + x2) / 2), (h0 + h1) / 2, Z((y1 + y2) / 2));
    me.castShadow = m !== mat.glass;
    me.receiveShadow = true;
    g.add(me);
  };
  panel(d.active[0], d.active[1], c + 3, c + 7, add);
  const pa = d.active[1] - 6;
  add([pa - 0.8, c + 9, pa + 0.8, c + 10.6], 0.85, 1.15, mat.alu);
  for (const hh of [0.88, 1.12]) add([pa - 0.6, c + 7, pa + 0.6, c + 9], hh - 0.006, hh + 0.006, mat.alu);

  const travel = d.trackEnd - d.active[1];
  const ctl: DoorCtl = {
    id: d.id, label: d.label, kind: 'slideGlass', open: d.open,
    set(t: number) {
      ctl.open = Math.max(0, Math.min(1, t));
      g.position.x = ((1 - ctl.open) * travel) / 100;
      doors.refreshSolids();
    },
  };
  doors.register(ctl, () => {
    const off = (1 - ctl.open) * travel;
    return [X(d.active[0] + off), Z(c + 3), X(d.active[1] + off), Z(c + 7)];
  });
}

/** 依 layout 建所有門；obstacles 為建門之前的場景（用來決定平開門的全開角度） */
export function buildDoors(b: Build, obstacles: Obstacle[]): Doors {
  const doors = new Doors();
  for (const d of doorData) {
    if (d.kind === 'swing') swingDoor(b, d, obstacles, doors);
    else if (d.kind === 'slide') slideDoor(b, d, doors);
    else slideGlass(b, d, doors);
  }
  for (const [i, d] of doorData.entries()) doors.list[i].set(d.open);
  return doors;
}
