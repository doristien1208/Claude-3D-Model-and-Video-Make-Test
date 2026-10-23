import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { X, Z } from '../core/units';
import { CEILING_H as H, DOWNLIGHT, DOWNLIGHT_RECESS, type Downlight } from '../data/layout';
import type { ItemOf } from '../data/query';
import { FACING_YAW, add, gbox, lathe, worldUV, type Build } from './prims';

/* ---------- 燈具 ---------- */

export function deskLamp(b: Build, it: ItemOf<'deskLamp'>): void {
  const { mat } = b;
  const [x, y] = it.at;
  b.cyl(x, y, 0.07, 0.76, 0.78, mat.black);
  b.cyl(x, y, 0.008, 0.78, 1.15, mat.black);
  b.glowBox(x - 12, y + 5, x + 12, y + 17, 1.14, 1.17, mat.glowSoft);
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

/** 中島吊燈：吊線、燈罩、朝下發光面 */
export function pendant(b: Build, it: ItemOf<'pendant'>): void {
  const { mat } = b;
  const [x, y] = it.at;
  b.cyl(x, y, 0.006, 1.92, H, mat.black, { cast: false });
  b.cyl(x, y, 0.13, 1.82, 1.98, mat.black, { rTop: 0.06 });
  b.disc(x, y, 1.815, 0.12, 24, mat.glow);
}

/** 走廊壁燈（裝在西側牆面，朝東）：燈座、正面發光、上下洗牆 */
export function sconce(b: Build, it: ItemOf<'sconce'>): void {
  const { mat } = b;
  const [x, y] = it.at, [h0, h1] = it.h;
  b.bx(x, y - 5, x + 1.5, y + 5, h0, h1, mat.black);
  b.glowBox(x + 1.5, y - 3, x + 5.5, y + 3, h0 + 0.03, h1 - 0.03, mat.glowSoft);
  b.glowBox(x, y - 2, x + 1.5, y + 2, h1, h1 + 0.02);
  b.glowBox(x, y - 2, x + 1.5, y + 2, h0 - 0.02, h0);
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

/** 桌上螢幕：rect 為螢幕本體，支架在螢幕後方（+y），底座在桌面 */
export function monitor(b: Build, it: ItemOf<'monitor'>): void {
  const { mat } = b;
  const [x1, y1, x2, y2] = it.rect, cx = (x1 + x2) / 2;
  b.box(it.rect, 0.92, 1.28, mat.tv);
  b.bx(cx - 3, y2, cx + 3, y2 + 6, 0.76, 0.95, mat.black);
  b.bx(cx - 12, y1 - 8, cx + 12, y1 + 12, 0.76, 0.77, mat.black);
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
