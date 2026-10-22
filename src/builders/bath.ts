import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { X, Z } from '../core/units';
import { lighting, type Pt, type Rect, type Side, type TowelColor, type TowelHang, type TowelKind } from '../data/layout';
import type { ItemOf } from '../data/query';
import { BOARD, R, buildFronts, frameOf } from './millwork';
import { FACING_YAW, gbox, worldUV, type Build } from './prims';
import { eggRing, loft, roundRect, shapeOf, slab, smooth, type Section } from './shapes';

/*
 * 衛浴設備（2026-10 依調查重做；以下尺寸單位為公尺，平面座標為 px）：
 *  浴缸   Duravit Starck 嵌入式 1700 × 750：缸緣厚 35、內上口 1570 × 590、內底約 1110 × 390、內深 460，單側斜靠背，排水在腳端 260
 *  馬桶   TOTO CW822REATW 壁掛 380 × 540 × 335，座圈上緣 400（Geberit），薄型座蓋 41；沖水板 Geberit Sigma20 246 × 164 × 12，中心 1.0 m
 *  面盆   桌上型 550 × 380 × 100、壁厚約 7 mm（TOTO LW1735、凱撒 LF5342、Duravit Luv）；下嵌盆 460 × 390（凱撒 L5115）
 *  龍頭   hansgrohe Talis E 240（出水距 183）、Talis E 壁式（面板 168 × 68、出水 225）、Tecturis E 浴缸出水口（210）
 *  淋浴   ShowerSelect Comfort E 面板 155 × 155；Pulsify E 260 方型頂噴；手持花灑 Ø105；Geberit CleanLine20 排水溝寬 43
 *  隔屏   10 mm 超白玻璃、牆側 U 槽 15 × 15、上框與外側立框 20 × 20
 *  配件   毛巾桿支座離牆 65 mm、衛生紙架 0.66 m；琥珀玻璃瓶 Ø75 × 168＋壓頭、漱口杯 Ø85 × 107、蠟燭 Ø77 × 90
 */

/** 加一個 mesh（本地座標，公尺） */
function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, cast = true): THREE.Mesh {
  const me = new THREE.Mesh(geo, m);
  me.position.set(x, y, z);
  me.castShadow = cast;
  me.receiveShadow = true;
  parent.add(me);
  return me;
}

/** 牆面設備的本地座標：x 沿牆、y 向上（原點在 h）、z 離牆 */
function wallGroup(b: Build, at: Pt, facing: Side, h: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(X(at[0]), h, Z(at[1]));
  g.rotation.y = FACING_YAW[facing];
  b.root.add(g);
  return g;
}

/** 世界座標的平面位移 → 牆面本地 x（沿牆） */
const alongWall = (facing: Side, from: Pt, to: Pt) => {
  const yaw = FACING_YAW[facing];
  return (X(to[0]) - X(from[0])) * Math.cos(yaw) - (Z(to[1]) - Z(from[1])) * Math.sin(yaw);
};

/** 沿 z 軸（離牆方向）的圓柱 */
const zcyl = (r: number, len: number, seg = 24, open = false) => new THREE.CylinderGeometry(r, r, len, seg, 1, open).rotateX(Math.PI / 2);
/** 沿 x 軸的圓柱 */
const xcyl = (r: number, len: number, seg = 24) => new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2);
/** 旋轉體：profile 為 [半徑, 高] */
const lathe = (profile: readonly [number, number][], seg = 32) =>
  new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);

/* ---------- 浴缸 ---------- */

/** 嵌入式壓克力浴缸：缸緣放在石材包覆上，內膽一路放樣到平底；靠背在腳端的另一頭 */
export function bathtub(b: Build, it: ItemOf<'bathtub'>): void {
  const { mat } = b;
  const [x1, y1, x2, y2] = it.rect, [s1, t1, s2, t2] = it.surround, top = it.h, RIM = 0.035;
  // 石材包覆：缸緣外圍補到牆面，頂面在缸緣下方
  for (const r of [[s1, t1, s2, y1], [s1, y2, s2, t2], [s1, y1, x1, y2], [x2, y1, s2, y2]] as Rect[]) {
    if (r[2] - r[0] > 0.01 && r[3] - r[1] > 0.01) b.box(r, 0, top - RIM, mat.stone);
  }
  b.solid(it.surround);

  // 本地座標：u 沿長軸、朝腳端為正；v 沿短軸
  const alongX = x2 - x1 >= y2 - y1;
  const A = (alongX ? x2 - x1 : y2 - y1) / 200, B = (alongX ? y2 - y1 : x2 - x1) / 200;
  const Ai = A - 0.065, Bi = B - 0.08;
  const secs: Section[] = [];
  const S = (y: number, a: number, bb: number, r: number, c = 0) => secs.push({ ring: roundRect(a, bb, r, c, 0, 8, 6), y });
  // 缸緣：外側立面 35 mm、頂面倒圓，往內接內膽上口
  S(top - RIM, A, B, 0.04);
  S(top - 0.008, A, B, 0.04);
  S(top - 0.002, A - 0.003, B - 0.003, 0.037);
  S(top, A - 0.008, B - 0.008, 0.032);
  S(top, Ai + 0.006, Bi + 0.006, 0.11);
  S(top - 0.004, Ai, Bi, 0.105);
  // 內膽：靠背斜躺、側壁與腳端接近垂直
  const WALL = 0.4, n = 8;
  const edge = (t: number) => ({ back: -Ai + 0.37 * t ** 1.15, foot: Ai - 0.03 * t ** 2, half: Bi - 0.07 * t ** 2.2, r: 0.105 + 0.05 * t });
  for (let i = 1; i <= n; i++) {
    const t = i / n, e = edge(t);
    S(top - 0.004 - WALL * t, (e.foot - e.back) / 2, e.half, e.r, (e.foot + e.back) / 2);
  }
  // 底部倒圓 → 平底（內深 460）
  const e1 = edge(1), floor = top - 0.46;
  for (const [k, dy] of [[0.018, 0.026], [0.04, 0.044], [0.065, 0.056]] as const) {
    S(top - 0.004 - WALL - dy, (e1.foot - e1.back) / 2 - k, e1.half - k, Math.max(0.03, e1.r - k), (e1.foot + e1.back) / 2);
  }
  const geo = loft(secs, false, true);
  // 長軸轉到腳端方向
  const footYaw: Record<Side, number> = { E: 0, W: Math.PI, S: -Math.PI / 2, N: Math.PI / 2 };
  geo.rotateY(footYaw[it.foot]);
  const cx = X((x1 + x2) / 2), cz = Z((y1 + y2) / 2);
  add(b.root, geo, mat.acrylic, cx, 0, cz);

  // 排水孔（腳端 260 mm）與溢水孔（腳端壁、缸緣下 11 cm），霧黑蓋
  const g = new THREE.Group();
  g.position.set(cx, 0, cz);
  g.rotation.y = footYaw[it.foot];
  b.root.add(g);
  add(g, new THREE.CylinderGeometry(0.036, 0.036, 0.004, 32), mat.blackSatin, A - 0.26, floor + 0.002, 0, false);
  add(g, xcyl(0.035, 0.008, 32), mat.blackSatin, Ai - 0.006, top - 0.11, 0, false);
}

/** 浴缸入牆出水口：扁平方管 */
export function bathSpout(b: Build, it: ItemOf<'bathSpout'>): void {
  const { mat } = b;
  const g = wallGroup(b, it.at, it.facing, it.h);
  gbox(g, 0.06, 0.06, 0.008, 0, 0, 0.004, mat.blackSatin, 0.003);
  gbox(g, 0.045, 0.028, 0.21, 0, 0, 0.105, mat.blackSatin, 0.006);
  gbox(g, 0.03, 0.002, 0.014, 0, -0.0141, 0.19, mat.gap, 0, false);
}

/* ---------- 淋浴 ---------- */

/** 恆溫面板（右恆溫旋鈕、左兩個出水切換鍵）＋手持花灑掛座、出水座與軟管 */
export function showerValve(b: Build, it: ItemOf<'showerValve'>): void {
  const { mat } = b;
  const g = wallGroup(b, it.at, it.facing, it.h);
  gbox(g, 0.155, 0.155, 0.01, 0, 0, 0.005, mat.blackSatin, 0.003);
  add(g, zcyl(0.026, 0.034, 32), mat.blackSatin, 0.035, 0, 0.027);
  for (const dy of [0.03, -0.03]) {
    gbox(g, 0.046, 0.046, 0.001, -0.04, dy, 0.0105, mat.gap, 0, false);
    gbox(g, 0.042, 0.042, 0.006, -0.04, dy, 0.013, mat.blackSatin, 0.004);
  }

  const du = alongWall(it.facing, it.at, it.hand.at), dh = it.hand.h - it.h;
  // 掛座
  gbox(g, 0.03, 0.05, 0.012, du, dh, 0.006, mat.blackSatin, 0.004);
  gbox(g, 0.024, 0.016, 0.04, du, dh - 0.01, 0.03, mat.blackSatin, 0.004);
  // 手持花灑：握把朝下、出水面朝外、上端微微外傾
  const tilt = 0.18, hs = new THREE.Group();
  hs.position.set(du, dh, 0.05);
  hs.rotation.x = tilt;
  g.add(hs);
  add(hs, new THREE.CylinderGeometry(0.0115, 0.0135, 0.15, 20), mat.blackSatin, 0, -0.04, 0);
  add(hs, zcyl(0.0525, 0.022, 40), mat.blackSatin, 0, 0.085, 0);
  add(hs, zcyl(0.043, 0.002, 40), mat.gap, 0, 0.085, 0.0115, false);
  // 出水座與軟管（從握把底部垂下再接回出水座）
  const outlet = new THREE.Vector3(du, dh - 0.24, 0);
  add(g, zcyl(0.022, 0.01, 24), mat.blackSatin, outlet.x, outlet.y, 0.005);
  add(g, zcyl(0.009, 0.03, 16), mat.blackSatin, outlet.x, outlet.y, 0.02);
  const bot = new THREE.Vector3(du, dh - 0.115 * Math.cos(tilt), 0.05 - 0.115 * Math.sin(tilt));
  const pts = [
    bot, new THREE.Vector3(du + 0.025, dh - 0.33, 0.045), new THREE.Vector3(du + 0.05, dh - 0.56, 0.05), new THREE.Vector3(du + 0.03, dh - 0.64, 0.045),
    new THREE.Vector3(du - 0.005, dh - 0.56, 0.035), new THREE.Vector3(du - 0.01, dh - 0.4, 0.03), new THREE.Vector3(du, dh - 0.27, 0.03),
    new THREE.Vector3(outlet.x, outlet.y, 0.035),
  ];
  add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.0055, 8), mat.blackSatin);
}

/** 方形頂噴：牆面圓蓋＋水平橫臂＋接頭＋薄型噴頭（出水面為矽膠噴嘴格點） */
export function showerHead(b: Build, it: ItemOf<'showerHead'>): void {
  const { mat } = b;
  const [hx, hy] = it.head, [fx, fy] = it.from, s = it.size;
  const dx = X(hx) - X(fx), dz = Z(hy) - Z(fy), len = Math.hypot(dx, dz);
  const g = new THREE.Group();
  g.position.set(X(fx), it.h, Z(fy));
  g.rotation.y = Math.atan2(dx, dz);
  b.root.add(g);
  const armY = 0.052;
  add(g, zcyl(0.03, 0.012), mat.blackSatin, 0, armY, 0.006);
  add(g, zcyl(0.011, len), mat.blackSatin, 0, armY, len / 2);
  add(g, new THREE.SphereGeometry(0.0125, 16, 12), mat.blackSatin, 0, armY, len);
  add(g, new THREE.CylinderGeometry(0.016, 0.02, armY - 0.012, 20), mat.blackSatin, 0, 0.012 + (armY - 0.012) / 2, len);
  gbox(g, s, 0.012, s, 0, 0.006, len, mat.blackSatin, 0.0055);
  const N = 13, step = (s - 0.06) / (N - 1);
  const dots = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.0015, 6), mat.gap, N * N);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    dots.setMatrixAt(i * N + j, m4.makeTranslation(-(s - 0.06) / 2 + i * step, -0.0004, len - (s - 0.06) / 2 + j * step));
  }
  g.add(dots);
}

/** 線型排水溝：霧黑蓋板＋中央排水縫 */
export function linearDrain(b: Build, it: ItemOf<'linearDrain'>): void {
  const [x1, y1, x2, y2] = it.rect, h = it.h, cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
  b.box(it.rect, h - 0.004, h + 0.0008, b.mat.blackSatin, { cast: false });
  if (x2 - x1 > y2 - y1) b.bx(x1 + 1, cy - 0.3, x2 - 1, cy + 0.3, h + 0.0008, h + 0.001, b.mat.gap, { cast: false });
  else b.bx(cx - 0.3, y1 + 1, cx + 0.3, y2 - 1, h + 0.0008, h + 0.001, b.mat.gap, { cast: false });
}

/** 固定玻璃隔屏：10 mm 玻璃、牆側 U 槽、上框＋外側立框（不做下框） */
export function glassScreen(b: Build, it: ItemOf<'glassScreen'>): void {
  const { mat } = b;
  const [x1, y1, x2, y2] = it.rect, h = it.h, h0 = it.base;
  const alongY = x2 - x1 < y2 - y1;
  const c = alongY ? (x1 + x2) / 2 : (y1 + y2) / 2, s = alongY ? y1 : x1, e = alongY ? y2 : x2;
  // 沿玻璃 a0–a1、厚度方向離中心線 k0–k1（px）
  const P = (a0: number, a1: number, k0: number, k1: number, hh0: number, hh1: number, m: THREE.Material, solid = false) =>
    alongY ? b.bx(c + k0, a0, c + k1, a1, hh0, hh1, m, { cast: m !== mat.glass, solid })
      : b.bx(a0, c + k0, a1, c + k1, hh0, hh1, m, { cast: m !== mat.glass, solid });
  P(s + 1.5, e - 2, -0.5, 0.5, h0, h - 0.02, mat.glass, true);
  P(s, s + 1.5, -0.75, 0.75, h0, h, mat.black);
  P(s + 1.5, e, -1, 1, h - 0.02, h, mat.black);
  P(e - 2, e, -1, 1, h0, h - 0.02, mat.black);
}

/* ---------- 馬桶 ---------- */

/** 壁掛馬桶：蛋形本體（底部往牆收）、薄型座圈＋蓋（闔上）；水箱半牆正面裝沖水板 */
export function toilet(b: Build, it: ItemOf<'toilet'>): void {
  const { mat } = b;
  b.box(it.tank, it.tankH[0], it.tankH[1], it.tankMaterial === 'walnut' ? mat.walnut : mat.tileLight, { solid: true });
  const [x1, y1, x2, y2] = it.bowl, ns = it.facing === 'N' || it.facing === 'S';
  const backs: Record<Side, Pt> = { S: [(x1 + x2) / 2, y1], N: [(x1 + x2) / 2, y2], E: [x1, (y1 + y2) / 2], W: [x2, (y1 + y2) / 2] };
  const back = backs[it.facing];
  const W = (ns ? x2 - x1 : y2 - y1) / 200, L = (ns ? y2 - y1 : x2 - x1) / 100;
  const g = wallGroup(b, back, it.facing, 0);

  // 沖水板與兩個按鍵
  gbox(g, 0.246, 0.164, 0.012, 0, 1.0, 0.006, mat.blackSatin, 0.003);
  gbox(g, 0.142, 0.086, 0.001, 0, 1.0, 0.0125, mat.gap, 0, false);
  gbox(g, 0.056, 0.08, 0.004, -0.037, 1.0, 0.014, mat.blackSatin, 0.0015);
  gbox(g, 0.08, 0.08, 0.004, 0.031, 1.0, 0.014, mat.blackSatin, 0.0015);

  // 本體：[高度, 前伸比例, 半寬比例]，底部離地約 7 cm、往前逐漸抬高
  const prof: [number, number, number][] = [
    [0.068, 0.19, 0.58], [0.08, 0.32, 0.68], [0.105, 0.46, 0.76], [0.15, 0.63, 0.83], [0.2, 0.78, 0.89], [0.25, 0.89, 0.945],
    [0.3, 0.963, 0.984], [0.35, 0.996, 1], [0.385, 1, 1], [0.396, 0.99, 0.982], [0.4, 0.975, 0.955],
  ];
  add(g, loft(prof.map(([y, l, w]) => ({ ring: eggRing(W * w, L * l), y })), true, true), mat.white);
  // 座圈 14 mm＋蓋 26 mm，中間 1 mm 縫；後方留鉸鏈位置
  const lid = (w: number, y: number, t: number) => {
    const geo = slab(shapeOf(eggRing(w, L * 0.905).map((p) => new THREE.Vector2(p.x, p.y + 0.035))), t, 0.005);
    add(g, geo, mat.seat, 0, y, 0);
  };
  lid(W * 0.93, 0.4005, 0.014);
  lid(W * 0.94, 0.4155, 0.026);
  for (const sx of [-1, 1]) gbox(g, 0.024, 0.026, 0.03, sx * 0.08, 0.413, 0.022, mat.seat, 0.006);
  b.solid(it.bowl);
}

/* ---------- 洗手台 ---------- */

/** 懸浮洗手台：系統櫃門片＋2 cm 石材檯面（下嵌盆挖孔）＋面盆＋龍頭＋鏡子與燈條 */
export function vanity(b: Build, it: ItemOf<'vanity'>): void {
  const { mat } = b;
  const [x1, y1, x2, y2] = it.rect;
  const under = it.basinType === 'undermount', TOP = 0.83, CARCASS = 0.66;
  const f = frameOf(it.rect, it.front);
  buildFronts(b, f, it.fronts, under ? { carcassTop: CARCASS } : {});
  if (under) {
    // 下嵌盆在櫃內：櫃體頂降低，兩側與背板補到檯面下
    const along = f.hor ? [x1, x2] : [y1, y2], depth = Math.abs(f.back - f.face);
    b.box(R(f, along[0], along[0] + BOARD, 2, depth), CARCASS, TOP, mat.walnut);
    b.box(R(f, along[1] - BOARD, along[1], 2, depth), CARCASS, TOP, mat.walnut);
    b.box(R(f, along[0], along[1], depth - BOARD, depth), CARCASS, TOP, mat.walnut);
  }
  b.solid(it.rect);

  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
  const [b1, c1, b2, c2] = it.basin, bcx = X((b1 + b2) / 2), bcz = Z((c1 + c2) / 2);
  const A = (b2 - b1) / 200, Bb = (c2 - c1) / 200;
  // 檯面（下嵌盆開孔 = 面盆內口，比外框各小 3 cm）
  const hw = (x2 - x1) / 200, hd = (y2 - y1) / 200;
  const top = new THREE.Shape([new THREE.Vector2(-hw, -hd), new THREE.Vector2(hw, -hd), new THREE.Vector2(hw, hd), new THREE.Vector2(-hw, hd)]);
  const ha = A - 0.03, hb = Bb - 0.03;
  if (under) top.holes.push(shapeOf(roundRect(ha, hb, 0.05, bcx - X(cx), bcz - Z(cy), 8, 4)));
  const topGeo = slab(top, 0.02);
  const topMesh = add(b.root, topGeo, mat.stone, X(cx), TOP, Z(cy));
  worldUV(topGeo, topMesh.position);

  if (under) {
    // 下嵌盆內膽：從檯面下緣往下放樣到盆底（內深約 15 cm）
    const S = (y: number, da: number, db: number, r: number): Section => ({ ring: roundRect(ha - da, hb - db, r, 0, 0, 8, 4), y });
    const secs = [S(TOP, 0, 0, 0.05), S(0.8, 0.002, 0.002, 0.055), S(0.76, 0.01, 0.01, 0.065), S(0.72, 0.035, 0.035, 0.08),
      S(0.7, 0.07, 0.065, 0.08), S(0.69, 0.11, 0.095, 0.06)];
    add(b.root, loft(secs, false, true), mat.white, bcx, 0, bcz);
    add(b.root, new THREE.CylinderGeometry(0.031, 0.031, 0.003, 32), mat.blackSatin, bcx, 0.6915, bcz, false);
  } else {
    // 桌上型薄邊方盆：外壁往上、7 mm 盆緣、內壁往下到盆底
    const S = (y: number, da: number, db: number, r: number): Section => ({ ring: roundRect(A - da, Bb - db, r, 0, 0, 8, 4), y });
    const secs = [
      S(0, 0.025, 0.025, 0.05), S(0.004, 0.017, 0.018, 0.055), S(0.015, 0.008, 0.008, 0.06), S(0.04, 0.003, 0.003, 0.062),
      S(0.07, 0.001, 0.001, 0.063), S(0.097, 0, 0, 0.063), S(0.1, 0.0015, 0.0015, 0.0615),
      S(0.1, 0.007, 0.007, 0.057), S(0.097, 0.0085, 0.0085, 0.0555),
      S(0.085, 0.01, 0.01, 0.055), S(0.06, 0.017, 0.017, 0.06), S(0.035, 0.035, 0.035, 0.07),
      S(0.022, 0.065, 0.06, 0.08), S(0.016, 0.105, 0.09, 0.08), S(0.014, 0.155, 0.12, 0.06),
    ];
    add(b.root, loft(secs, true, true), mat.white, bcx, TOP + 0.02, bcz);
    add(b.root, new THREE.CylinderGeometry(0.031, 0.031, 0.004, 32), mat.blackSatin, bcx, TOP + 0.02 + 0.016, bcz, false);
  }

  // 龍頭
  const fa = it.faucet;
  if (fa.mount === 'deck') {
    // 高腳龍頭：細方柱＋水平扁出水管（出水距 183）＋側邊把手；出水管朝向面盆
    const g = new THREE.Group();
    g.position.set(X(fa.at[0]), TOP + 0.02, Z(fa.at[1]));
    g.rotation.y = Math.atan2(bcx - X(fa.at[0]), bcz - Z(fa.at[1]));
    b.root.add(g);
    gbox(g, 0.045, 0.006, 0.058, 0, 0.003, 0, mat.blackSatin, 0.0025);
    gbox(g, 0.04, 0.29, 0.05, 0, 0.145, 0, mat.blackSatin, 0.008);
    gbox(g, 0.038, 0.02, 0.205, 0, 0.27, 0.0925, mat.blackSatin, 0.006);
    gbox(g, 0.022, 0.002, 0.022, 0, 0.2595, 0.183, mat.gap, 0.0008, false);
    gbox(g, 0.06, 0.012, 0.014, 0.045, 0.25, 0, mat.blackSatin, 0.005);
  } else {
    // 入牆龍頭：橫式面板，左側出水管、右側把手
    const g = wallGroup(b, fa.at, it.front, fa.h);
    gbox(g, 0.168, 0.068, 0.01, 0.04, 0, 0.005, mat.blackSatin, 0.004);
    gbox(g, 0.04, 0.02, 0.225, 0, 0, 0.1225, mat.blackSatin, 0.006);
    gbox(g, 0.022, 0.002, 0.022, 0, -0.0105, 0.215, mat.gap, 0.0008, false);
    add(g, zcyl(0.009, 0.03, 16), mat.blackSatin, 0.095, 0, 0.025);
    gbox(g, 0.012, 0.045, 0.01, 0.095, 0.014, 0.04, mat.blackSatin, 0.004);
  }

  // 鏡子＋鏡上燈條（鏡子貼牆，燈條在鏡面前 2 px）
  const [mx1, , mx2, my2] = it.mirror, [m0, m1] = it.mirrorH;
  b.box(it.mirror, m0, m1, mat.mirror, { cast: false });
  b.glowBox(mx1, my2, mx2, my2 + 2, m1, m1 + 0.02);
  b.stripLight((mx1 + mx2) / 2, my2 + 1, m1 - 0.001, (mx2 - mx1) / 100, 0.02, true, 'down', lighting.strips.mirror);
  // 鏡面即時平面反射（Reflector）：顏色 0.5 線性為原樣反射，略低一點並帶極淡綠＝銀鏡約 86% 反射率
  const w = (mx2 - mx1) / 100, h = m1 - m0;
  const mirror = new Reflector(new THREE.PlaneGeometry(w, h), {
    clipBias: 0.003, color: 0xb0b4b1, textureWidth: Math.round(1400 * w), textureHeight: Math.round(1400 * h),
  });
  mirror.position.set(X((mx1 + mx2) / 2), (m0 + m1) / 2, Z(my2) + 0.0005);
  b.root.add(mirror);
  b.reflectors.push(mirror);
}

/* ---------- 毛巾與配件 ---------- */

const TOWEL: Record<TowelKind, { w: number; drop: number; t: number; rollLen: number; rollR: number }> = {
  // 浴巾 700 × 1400 縱向三折（3 層）；毛巾 340 × 800 縱向對折（2 層）；毛圈布每層約 4–5 mm
  bath: { w: 0.233, drop: 0.7, t: 0.013, rollLen: 0.233, rollR: 0.055 },
  hand: { w: 0.17, drop: 0.4, t: 0.009, rollLen: 0.17, rollR: 0.033 },
};
const towelMat = (b: Build, c: TowelColor, end = false) =>
  c === 'white' ? (end ? b.mat.towelWhiteEnd : b.mat.towelWhite) : (end ? b.mat.towelOatEnd : b.mat.towelOat);

/** 對折掛在桿上的毛巾：倒 U 形斷面沿桿子擠出，兩側摺邊倒圓；垂下的部分加一點縱向起伏 */
function drapedTowel(parent: THREE.Object3D, m: THREE.Material, x: number, zc: number, ri: number, kind: TowelKind): number {
  const { w, drop, t } = TOWEL[kind], ro = ri + t, bev = Math.min(0.003, t / 3);
  const sh = new THREE.Shape();
  sh.moveTo(ro, -drop);
  sh.lineTo(ro, 0);
  sh.absarc(0, 0, ro, 0, Math.PI, false);
  sh.lineTo(-ro, -drop);
  sh.lineTo(-ri, -drop);
  sh.lineTo(-ri, 0);
  sh.absarc(0, 0, ri, Math.PI, 0, true);
  sh.lineTo(ri, -drop);
  const depth = w - 2 * bev;
  const g = new THREE.ExtrudeGeometry(sh, {
    depth, curveSegments: 12, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 2,
  });
  // 形狀 (u 離牆, v 向上) → 本地 (z, y)；擠出方向 → 沿桿 x
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), k = Math.min(1, Math.max(0, (-y - 0.03) / 0.3));
    p.setZ(i, p.getZ(i) + k * (0.0025 * Math.sin(p.getX(i) * 38 + 1.3) + 0.0012 * Math.sin(p.getX(i) * 91 + y * 7)));
  }
  const sm = smooth(g);
  worldUV(sm, new THREE.Vector3());
  add(parent, sm, m, x, 0, zc);
  return ro;
}

/** 毛巾桿（兩端圓座＋支柱＋圓桿，桿中心離牆 57 mm）與掛在上面的毛巾 */
export function towelBar(b: Build, it: ItemOf<'towelBar'>): void {
  const { mat } = b;
  const g = wallGroup(b, it.at, it.facing, it.h);
  const L = it.len / 100, BAR = 0.008, zc = 0.065 - BAR;
  for (const sx of [-1, 1]) {
    add(g, zcyl(0.022, 0.006), mat.blackSatin, sx * (L / 2 - 0.02), 0, 0.003);
    add(g, zcyl(0.008, zc), mat.blackSatin, sx * (L / 2 - 0.02), 0, zc / 2);
  }
  add(g, xcyl(BAR, L - 0.02, 20), mat.blackSatin, 0, 0, zc);
  // 同一位置的毛巾由內往外疊
  const outer = new Map<number, number>();
  for (const t of it.towels ?? ([] as TowelHang[])) {
    const ri = (outer.get(t.at) ?? BAR) + 0.0005;
    outer.set(t.at, drapedTowel(g, towelMat(b, t.color), t.at / 100, zc, ri, t.kind));
  }
}

/** 捲起的毛巾，三捲疊成金字塔；端面有螺旋層線 */
export function towelRolls(b: Build, it: ItemOf<'towelRolls'>): void {
  const { rollLen: len, rollR: r } = TOWEL[it.kind];
  const side = towelMat(b, it.color), end = towelMat(b, it.color, true);
  const g = new THREE.Group();
  g.position.set(X(it.at[0]), it.h, Z(it.at[1]));
  if (it.axis === 'x') g.rotation.y = Math.PI / 2;
  b.root.add(g);
  for (const [ox, oy] of [[-r, r], [r, r], [0, r * (1 + Math.sqrt(3))]]) {
    const body = new THREE.CylinderGeometry(r, r, len, 32, 1, true);
    worldUV(body, new THREE.Vector3(), r);
    body.rotateX(Math.PI / 2);
    add(g, body, side, ox * 1.01, oy, 0);
    for (const sz of [-1, 1]) {
      const cap = new THREE.CircleGeometry(r * 0.995, 32);
      if (sz < 0) cap.rotateY(Math.PI);
      add(g, cap, end, ox * 1.01, oy, (sz * len) / 2, false);
    }
  }
}

/** 衛生紙架：方形底座＋L 形臂，掛一捲衛生紙（Ø110 × 100） */
export function paperHolder(b: Build, it: ItemOf<'paperHolder'>): void {
  const { mat } = b;
  const g = wallGroup(b, it.at, it.facing, it.h);
  gbox(g, 0.05, 0.05, 0.008, 0, 0, 0.004, mat.blackSatin, 0.003);
  add(g, zcyl(0.005, 0.06), mat.blackSatin, 0, 0, 0.035);
  add(g, xcyl(0.005, 0.13), mat.blackSatin, 0.065, 0, 0.065);
  add(g, new THREE.SphereGeometry(0.006, 12, 8), mat.blackSatin, 0.13, 0, 0.065);
  add(g, xcyl(0.055, 0.1, 40), mat.paper, 0.068, 0, 0.065);
  // 紙捲芯（兩端看到的深色圓孔）
  add(g, xcyl(0.02, 0.1005, 24), mat.gap, 0.068, 0, 0.065, false);
}

/** 托盤（胡桃木） */
export function tray(b: Build, it: ItemOf<'tray'>): void {
  const [x1, y1, x2, y2] = it.rect;
  const geo = new RoundedBoxGeometry((x2 - x1) / 100, 0.015, (y2 - y1) / 100, 2, 0.004);
  const me = add(b.root, geo, b.mat.walnutDark, X((x1 + x2) / 2), it.h + 0.0075, Z((y1 + y2) / 2));
  worldUV(geo, me.position);
}

/** 衛浴小物：按壓瓶、漱口杯、多肉盆栽、蠟燭 */
export function bathAccessory(b: Build, it: ItemOf<'bathAccessory'>): void {
  const { mat } = b;
  const g = new THREE.Group();
  g.position.set(X(it.at[0]), it.h, Z(it.at[1]));
  b.root.add(g);
  switch (it.kind) {
    case 'pumpBottle': {
      // 500 ml 波士頓圓瓶（Ø75 × 168）＋黑色壓頭
      add(g, lathe([[0, 0], [0.034, 0], [0.0375, 0.004], [0.0375, 0.118], [0.035, 0.132], [0.026, 0.146], [0.016, 0.152], [0.0145, 0.156], [0.0145, 0.168], [0, 0.168]]), mat.amber);
      add(g, new THREE.CylinderGeometry(0.016, 0.016, 0.012, 24), mat.black, 0, 0.172);
      add(g, new THREE.CylinderGeometry(0.004, 0.004, 0.014, 12), mat.black, 0, 0.185);
      gbox(g, 0.022, 0.016, 0.022, 0, 0.198, 0, mat.black, 0.004);
      add(g, zcyl(0.0035, 0.03, 12), mat.black, 0, 0.2, 0.024);
      break;
    }
    case 'tumbler':
      add(g, lathe([[0, 0], [0.04, 0], [0.0425, 0.004], [0.0425, 0.107], [0.0395, 0.107], [0.0395, 0.008], [0, 0.008]]), mat.black);
      break;
    case 'succulent': {
      // 霧白陶盆＋十二卷（Haworthia）葉叢：黃金角排列、外圈較平
      add(g, lathe([[0, 0], [0.034, 0], [0.04, 0.006], [0.04, 0.07], [0.036, 0.07], [0.036, 0.062], [0, 0.062]]), mat.potWhite);
      const leaf = new THREE.ConeGeometry(0.006, 1, 6).translate(0, 0.5, 0);
      for (let i = 0; i < 20; i++) {
        const ring = i < 6 ? 0 : i < 13 ? 1 : 2;
        const me = add(g, leaf, mat.plant, 0, 0.062, 0);
        me.scale.set(1, [0.04, 0.05, 0.055][ring], 1);
        me.rotation.set([0.25, 0.65, 1.0][ring], i * 2.39996, 0, 'YXZ');
      }
      break;
    }
    case 'candle':
      // 深色玻璃杯（Ø77 × 90）＋蠟面＋燭芯
      add(g, lathe([[0, 0], [0.0365, 0], [0.0385, 0.003], [0.0385, 0.09], [0.0355, 0.09], [0.0355, 0.072], [0, 0.072]]), mat.darkGlass);
      add(g, new THREE.CylinderGeometry(0.0354, 0.0354, 0.002, 32), mat.wax, 0, 0.072);
      add(g, new THREE.CylinderGeometry(0.0008, 0.0008, 0.01, 6), mat.black, 0, 0.078);
      break;
  }
}
