import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { X, Z } from '../core/units';
import { CEILING_H as H, DOWNLIGHT, DOWNLIGHT_RECESS, type Downlight } from '../data/layout';
import type { ItemOf } from '../data/query';
import { FACING_YAW, add, gbox, lathe, worldUV, type Build } from './prims';

/* ---------- 燈具 ---------- */

/**
 * 檯燈，參考 Artemide Tolomeo Micro（黑）：圓形鐵底座、短立軸上接兩段臂與燈頭（tolomeoArm）。
 * at 為底座中心，h 為桌面高，head 為燈頭頂端位置（平面）與高度 headH。
 */
export function deskLamp(b: Build, it: ItemOf<'deskLamp'>): void {
  const { mat } = b;
  const x = X(it.at[0]), z = Z(it.at[1]);
  add(b.root, new THREE.CylinderGeometry(LAMP.baseR, LAMP.baseR, LAMP.baseT, 40), mat.black, x, it.h + LAMP.baseT / 2, z);
  add(b.root, new THREE.CylinderGeometry(0.008, 0.008, LAMP.post, 16), mat.steel, x, it.h + LAMP.baseT + LAMP.post / 2, z);
  const pivot = new THREE.Vector3(x, it.h + LAMP.baseT + LAMP.post, z);
  tolomeoArm(b, pivot, new THREE.Vector3(X(it.head[0]), it.headH, Z(it.head[1])), LAMP.a1, LAMP.a2, LAMP.head, LAMP.tail);
}

/** Tolomeo Micro 檯燈尺寸（Artemide 規格表：底座 Ø17、燈罩 Ø11、常用姿勢高 37 伸出 45；臂長由姿勢反推：下臂 30、上臂 31、尾端 8） */
const LAMP = { baseR: 0.085, baseT: 0.015, post: 0.04, a1: 0.3, a2: 0.31, head: 1.02, tail: 0.08 };

/**
 * Artemide Tolomeo 的兩段臂與燈頭（壁燈、檯燈共用）：黑色鋁管 Ø1.1，肘在樞軸與燈頭連線的上方（餘弦定理），
 * 肘後留 4.5 cm 尾端，不鏽鋼拉線在臂上方 1.2 cm；燈頭 Ø10.8 × 11.5 圓錐接在上臂末端，開口朝下微向外，內側發光。
 * pivot、head 為世界座標（公尺），a1、a2 為下臂、上臂長。
 */
export function tolomeoArm(b: Build, pivot: THREE.Vector3, head: THREE.Vector3, a1: number, a2: number, headScale = 1, tailLen = 0.045): void {
  const { mat } = b;
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const toHead = head.clone().sub(pivot), dist = Math.min(toHead.length(), a1 + a2 - 0.01);
  const u = toHead.normalize(), up = V(0, 1, 0), n = up.clone().addScaledVector(u, -up.dot(u)).normalize();
  const ca = (a1 * a1 + dist * dist - a2 * a2) / (2 * a1 * dist), sa = Math.sqrt(Math.max(0, 1 - ca * ca));
  const elbow = pivot.clone().addScaledVector(u, a1 * ca).addScaledVector(n, a1 * sa);
  const tube = (a: THREE.Vector3, c: THREE.Vector3, r: number, m: THREE.Material) => {
    const dir = c.clone().sub(a), me = add(b.root, new THREE.CylinderGeometry(r, r, dir.length(), 12), m);
    me.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
    me.position.copy(a).add(c).multiplyScalar(0.5);
    return me;
  };
  const tail = elbow.clone().addScaledVector(elbow.clone().sub(head).normalize(), tailLen);
  tube(pivot, elbow, 0.0055, mat.black);
  tube(tail, head, 0.0055, mat.black);
  add(b.root, new THREE.SphereGeometry(0.009, 16, 12), mat.steel, elbow.x, elbow.y, elbow.z);
  const off = (p: THREE.Vector3) => p.clone().addScaledVector(n, 0.012);
  tube(off(pivot), off(elbow), 0.0006, mat.steel);
  tube(off(tail), off(head), 0.0006, mat.steel);
  const shade = new THREE.Group();
  shade.position.copy(head);
  shade.scale.setScalar(headScale);
  const flat = head.clone().sub(pivot).setY(0).normalize();
  shade.quaternion.setFromUnitVectors(V(0, -1, 0), V(0, -1, 0).addScaledVector(flat, 0.3).normalize());
  b.root.add(shade);
  add(shade, lathe([[0.012, 0.012], [0.018, 0], [0.054, -0.115], [0.0525, -0.115], [0.0165, -0.002], [0.0105, 0.01]], 40), mat.black);
  b.glow.push(add(shade, new THREE.CircleGeometry(0.03, 24).rotateX(Math.PI / 2), mat.glowSoft, 0, -0.06, 0, false));
}

/**
 * 落地燈，參考 Santa & Cole TMM（Miguel Milá，官方規格表）：總高 166；兩支 50 cm 木條（1.2 寬 × 4.5 高、立放）十字交叉，
 * 端部 0.8 cm 腳墊；木桿 3.2 cm，83 cm 以下是方的、以上是圓的；Ø30 × 20 羊皮紙筒形燈罩掛在燈桿旁
 * （中心離桿 20 cm），上下緣各一支托架、高 124–144，可繞桿轉。
 */
export function floorLamp(b: Build, it: ItemOf<'floorLamp'>): void {
  const { mat } = b;
  const [x, y] = it.at, g = new THREE.Group();
  g.position.set(X(x), 0, Z(y));
  b.root.add(g);
  // 燈罩方向；十字腳轉 45°，不會頂到沙發
  const dx = (it.shade[0] - x) / 100, dz = (it.shade[1] - y) / 100, yaw = Math.atan2(dx, dz);
  const base = new THREE.Group();
  base.rotation.y = yaw + Math.PI / 4;
  g.add(base);
  const PAD = 0.008, BAR = 0.045;
  for (const r of [0, Math.PI / 2]) {
    const bar = gbox(base, 0.5, BAR, 0.012, 0, PAD + BAR / 2, 0, mat.walnut, 0.003);
    bar.rotation.y = r;
    worldUV(bar.geometry, bar.position);
    for (const s of [-1, 1]) {
      const pad = gbox(base, 0.05, PAD, 0.014, 0, PAD / 2, 0, mat.black, 0.002);
      pad.position.set(Math.cos(r) * s * 0.225, PAD / 2, -Math.sin(r) * s * 0.225);
      pad.rotation.y = r;
    }
  }
  const sq = gbox(g, 0.032, 0.83 - PAD - BAR, 0.032, 0, (0.83 + PAD + BAR) / 2, 0, mat.walnut, 0.004);
  sq.rotation.y = yaw;
  worldUV(sq.geometry, sq.position);
  const pole = add(g, new THREE.CylinderGeometry(0.016, 0.016, 1.66 - 0.83, 20), mat.walnut, 0, (1.66 + 0.83) / 2, 0);
  worldUV(pole.geometry, pole.position, 0.016);
  // 燈罩（薄筒，內外都看得到）、上下托架與桿上的夾環、燈泡
  const S0 = 1.24, S1 = 1.44, R = 0.15;
  add(g, lathe([[R - 0.002, 0], [R, 0], [R, S1 - S0], [R - 0.002, S1 - S0], [R - 0.002, 0]], 64), mat.glowSoft, dx, S0, dz);
  const far = new THREE.Vector3(dx, 0, dz).multiplyScalar((Math.hypot(dx, dz) + R) / Math.hypot(dx, dz));
  for (const h of [S0 + 0.004, S1 - 0.004]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, far.length(), 8), mat.black);
    rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), far.clone().normalize());
    rod.position.set(far.x / 2, h, far.z / 2);
    g.add(rod);
    add(g, new THREE.CylinderGeometry(0.021, 0.021, 0.03, 20), mat.black, 0, h, 0);
  }
  b.glow.push(add(g, new THREE.SphereGeometry(0.03, 16, 12), mat.glow, dx, (S0 + S1) / 2 - 0.01, dz, false));
  b.solids.push([X(x) - 0.18, Z(y) - 0.18, X(x) + 0.18, Z(y) + 0.18]);
}

/** Muuto Ambit 25 尺寸（見 pendant）：燈罩外形 [半徑, 離下緣高]，從頂到下緣 */
const AMBIT = {
  bottom: 1.72,
  shade: [[0.018, 0.15], [0.03, 0.149], [0.06, 0.142], [0.088, 0.125], [0.106, 0.098], [0.117, 0.065], [0.123, 0.03], [0.125, 0]] as [number, number][],
  canopyR: 0.045, canopyH: 0.056, bulbY: 0.06,
};

/**
 * 中島吊燈，參考 Muuto Ambit 25：霧黑手工上漆旋壓鋁燈罩 Ø25 × 15（圓肩、往下漸陡到罩口、內側白），Ø4 短頸，黑色橡膠吊線、Ø9 × 5.6 天花座，
 * 下緣 1.72 m（檯面 0.92 上 80 cm），燈泡在罩內（E14 LED）。
 */
export function pendant(b: Build, it: ItemOf<'pendant'>): void {
  const { mat } = b;
  const x = X(it.at[0]), z = Z(it.at[1]), A = AMBIT, top = A.bottom + A.shade[0][1];
  add(b.root, new THREE.CylinderGeometry(A.canopyR, A.canopyR, A.canopyH, 40), mat.black, x, H - A.canopyH / 2, z, false);
  add(b.root, new THREE.CylinderGeometry(0.0025, 0.0025, H - A.canopyH - top - 0.02, 8), mat.black, x, (H - A.canopyH + top + 0.02) / 2, z, false);
  add(b.root, new THREE.CylinderGeometry(0.014, 0.018, 0.02, 24), mat.black, x, top + 0.01, z);
  // 燈罩：外殼黑、內面白（往回走一圈，厚 1.5 mm）
  const outer = A.shade.map(([r, h]) => [r, h] as [number, number]).reverse();
  add(b.root, lathe(outer, 48), mat.black, x, A.bottom, z);
  const inner = A.shade.map(([r, h]) => [Math.max(0.001, r - 0.0015), h - 0.0015] as [number, number]);
  add(b.root, lathe(inner, 48), mat.plateWhite, x, A.bottom, z, false);
  b.glow.push(add(b.root, new THREE.SphereGeometry(0.022, 16, 12), mat.glow, x, A.bottom + A.bulbY, z, false));
}

/**
 * 走廊壁燈，參考 Astro Kinzo 260（黑）：方邊鋁盒 26 高 × 10.5 寬 × 12 出牆，上下開口出光（整合 LED 2700K、449 lm）。
 * at 為牆面上的點、h 為中心高、facing 為出牆方向。
 */
export function sconce(b: Build, it: ItemOf<'sconce'>): void {
  const { mat } = b;
  const g = new THREE.Group();
  g.position.set(X(it.at[0]), it.h, Z(it.at[1]));
  g.rotation.y = FACING_YAW[it.facing];
  b.root.add(g);
  const H2 = 0.13, W = 0.105, D = 0.12, T = 0.003;
  // 四面板（上下開口）
  gbox(g, W, 2 * H2, T, 0, 0, D - T / 2, mat.black, 0.001);
  gbox(g, W, 2 * H2, T, 0, 0, T / 2, mat.black, 0.001);
  for (const s of [-1, 1]) gbox(g, T, 2 * H2, D, s * (W / 2 - T / 2), 0, D / 2, mat.black, 0.001);
  // 盒內上下兩片 LED 發光面（從開口看得到）
  for (const s of [-1, 1]) b.glow.push(add(g, new THREE.PlaneGeometry(W - 2 * T, D - 2 * T).rotateX(s * Math.PI / 2), mat.glowSoft, 0, s * (H2 - 0.03), D / 2, false));
}

/**
 * 天花板崁燈（白色飾圈＋白色深杯）：飾圈寬 8 mm、往上 3.5 cm 的深杯（遮光角約 30°）、杯底發光面；
 * 天花板在 architecture.ts 依開孔挖洞，光源見 lighting.ts
 */
export function downlights(b: Build, list: readonly Downlight[]): void {
  const { mat } = b;
  for (const d of list) {
    const r = DOWNLIGHT[d.kind].cutout / 2, x = X(d.at[0]), z = Z(d.at[1]);
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.002, r + 0.008, 48), mat.plateWhite);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, H - 0.001, z);
    b.root.add(ring);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.002, r - 0.002, DOWNLIGHT_RECESS, 48, 1, true), mat.cup);
    cup.position.set(x, H + DOWNLIGHT_RECESS / 2, z);
    b.root.add(cup);
    // 杯底封板（不然從發光面旁的縫看得到天花板上方）＋發光面
    b.disc(d.at[0], d.at[1], H + DOWNLIGHT_RECESS, r - 0.002, 48, mat.plateWhite);
    b.glow.push(b.disc(d.at[0], d.at[1], H + DOWNLIGHT_RECESS - 0.001, r * 0.55, 32, mat.glow));
  }
}

/* ---------- 影音 ---------- */

/**
 * 壁掛電視，參考 LG OLED65G5（144.1 × 82.6 × 2.43 cm，One Wall Design 貼牆）：整片光面面板，
 * 黑邊左右 6.5 mm、上 7 mm、下 15 mm 由霧黑機身表現。
 */
export function tv(b: Build, it: ItemOf<'tv'>): void {
  const { mat } = b;
  const [x1, y1, x2, y2] = it.rect, [h0, h1] = it.h;
  const alongX = it.facing === 'N' || it.facing === 'S';
  const w = (alongX ? x2 - x1 : y2 - y1) / 100, d = (alongX ? y2 - y1 : x2 - x1) / 100;
  const body = gbox(b.root, (x2 - x1) / 100, h1 - h0, (y2 - y1) / 100, X((x1 + x2) / 2), (h0 + h1) / 2, Z((y1 + y2) / 2), mat.tvBody, 0.003);
  // 螢幕面板：機身正面外 0.5 mm
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.013, h1 - h0 - 0.022), mat.tv);
  scr.rotation.y = FACING_YAW[it.facing];
  const n = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[it.facing];
  scr.position.set(body.position.x + n[0] * (d / 2 + 0.0005), (h0 + h1) / 2 + 0.004, body.position.z + n[1] * (d / 2 + 0.0005));
  b.root.add(scr);
}

/* ---------- 家電 ---------- */

/**
 * 獨立式冰箱，參考 Mitsubishi MR-B46F（455 L、600 × 699 × 1821 mm）：上方法式對開門、中段兩個並排小抽屜、
 * 冷凍抽屜、蔬果抽屜、底部通風格柵；深灰玻璃門板、無外露把手。正面朝南。
 */
export function fridge(b: Build, it: ItemOf<'fridge'>): void {
  const { mat } = b;
  const [x1, y1, x2, y2] = it.rect, top = it.h, D = 2.5, g = 0.2, gm = 0.002;
  b.box([x1, y1, x2, y2 - D], 0.06, top, mat.fridgeGlass, { solid: true });
  b.box([x1 + 1, y1, x2 - 1, y2 - 3], 0, 0.06, mat.gap, { cast: false });
  const xm = (x1 + x2) / 2;
  const fronts: [number, number, number, number][] = [
    [x1, xm, 1.03, top], [xm, x2, 1.03, top],     // 法式對開門
    [x1, xm, 0.83, 1.03], [xm, x2, 0.83, 1.03],   // 並排小抽屜
    [x1, x2, 0.48, 0.83],                         // 冷凍抽屜
    [x1, x2, 0.06, 0.48],                         // 蔬果抽屜
  ];
  for (const [a0, a1, h0, h1] of fronts) {
    const w = (a1 - a0 - 2 * g) / 100, d = D / 100, hh = h1 - h0 - 2 * gm;
    const me = new THREE.Mesh(new RoundedBoxGeometry(w, hh, d, 2, 0.004), mat.fridgeGlass);
    me.position.set(X((a0 + a1) / 2), (h0 + h1) / 2, Z(y2 - D / 2));
    me.castShadow = me.receiveShadow = true;
    b.root.add(me);
  }
}
