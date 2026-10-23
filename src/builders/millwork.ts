import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { X, Z } from '../core/units';
import { CEILING_H as H, lighting, type Front, type Rect, type Side } from '../data/layout';
import type { ItemOf } from '../data/query';
import { rectAlong, rng, worldUV, type Build } from './prims';

/*
 * 系統櫃與木作。尺寸依調查（pro360 系統櫃尺寸、100室內設計、IKEA PAX／METOD、Blum）：
 *  櫃體板 18 mm、門片 18 mm、門縫 3 mm、封邊同色；放書層板 25 mm、每格跨距 ≤ 80 cm；
 *  踢腳內縮；取手：按壓、開啟邊 45° 斜切、上緣鋁擠取手溝（gola）、從開放格伸手（grip）。
 */
const DOOR = 1.8;       // 門片厚（px）
const GAP = 0.3;        // 門縫（px）＝ 0.003 m
export const BOARD = 1.8;      // 櫃體板厚（px）
const GOLA = 0.035;     // 取手溝高（m）
const PLINTH_SET = 5;   // 踢腳內縮（px）
const BAY_MAX = 80;     // 書櫃每格最大跨距（px）
const SHELF_T = 0.025;  // 放書層板厚（m）

export function slatWall(b: Build, it: ItemOf<'slatWall'>): void {
  b.box(it.rect, 0, H, b.mat.slat);
  if (it.led) b.glowBox(it.led.rect[0], it.led.rect[1], it.led.rect[2], it.led.rect[3], it.led.h[0], it.led.h[1]);
}

/* ---------- 櫃體正面 ---------- */

/** 櫃體正面的局部座標：along 沿正面，depth 由正面往內（0 = 門片外表面） */
export interface FrontFrame {
  hor: boolean;
  face: number;   // 正面（門片外表面）的 across 座標
  back: number;   // 背面的 across 座標
  σ: 1 | -1;      // 正面朝外的方向
}

export function frameOf(rect: Rect, front: Side): FrontFrame {
  const [x1, y1, x2, y2] = rect;
  switch (front) {
    case 'N': return { hor: true, face: y1, back: y2, σ: -1 };
    case 'S': return { hor: true, face: y2, back: y1, σ: 1 };
    case 'W': return { hor: false, face: x1, back: x2, σ: -1 };
    case 'E': return { hor: false, face: x2, back: x1, σ: 1 };
  }
}

/** 正面座標 → 平面外框：沿正面 a0–a1、由正面往內 d0–d1 */
export const R = (f: FrontFrame, a0: number, a1: number, d0: number, d1: number): Rect =>
  rectAlong(f.hor, a0, a1, f.face - f.σ * d0, f.face - f.σ * d1);

/** 一片門／抽屜：圓角 1.5 mm 的木板（世界座標 UV，木紋跨門連續） */
function panel(b: Build, f: FrontFrame, a0: number, a1: number, h0: number, h1: number, d0: number, d1: number, m: THREE.Material): void {
  const [x1, y1, x2, y2] = R(f, a0, a1, d0, d1);
  const geo = new RoundedBoxGeometry((x2 - x1) / 100, h1 - h0, (y2 - y1) / 100, 2, 0.0015);
  const me = new THREE.Mesh(geo, m);
  me.position.set(X((x1 + x2) / 2), (h0 + h1) / 2, Z((y1 + y2) / 2));
  worldUV(geo, me.position);
  me.castShadow = me.receiveShadow = true;
  b.root.add(me);
}

/**
 * 依 fronts 建櫃體：每個分區後面一塊櫃體（開放格則是挖空的格子），前面是門片；門縫露出深色底，
 * 讓分割線讀得出來。depth 為櫃體總深（px），carcassTop 可降低櫃體頂（例如水槽下方）。
 */
export function buildFronts(b: Build, f: FrontFrame, fronts: readonly Front[], opt: { carcassTop?: number } = {}): void {
  const { mat } = b;
  const depth = Math.abs(f.back - f.face);
  const g = GAP / 2, gm = 0.0015;
  for (const fr of fronts) {
    const [h0, h1] = fr.h;
    const rows = fr.rows ?? 1;
    if (fr.kind === 'open') {
      // 開放格：背板（深胡桃）＋上下左右板＋層板；頂部燈條
      b.box(R(f, fr.from, fr.to, depth - BOARD, depth), h0, h1, mat.walnutDark);
      b.box(R(f, fr.from, fr.to, 0, depth - BOARD), h0, h0 + BOARD / 100, mat.walnut);
      b.box(R(f, fr.from, fr.to, 0, depth - BOARD), h1 - BOARD / 100, h1, mat.walnut);
      b.box(R(f, fr.from, fr.from + BOARD, 0, depth - BOARD), h0, h1, mat.walnut);
      b.box(R(f, fr.to - BOARD, fr.to, 0, depth - BOARD), h0, h1, mat.walnut);
      const n = fr.shelves ?? 0;
      for (let i = 1; i <= n; i++) {
        const y = h0 + ((h1 - h0) * i) / (n + 1);
        b.box(R(f, fr.from + BOARD, fr.to - BOARD, 1, depth - BOARD), y - SHELF_T / 2, y + SHELF_T / 2, mat.walnut);
      }
      if (fr.led) b.glowBox(...R(f, fr.from + BOARD + 1, fr.to - BOARD - 1, 2, 3.5), h1 - BOARD / 100 - 0.008, h1 - BOARD / 100, mat.glowSoft);
      continue;
    }
    // 櫃體（門片後方）與門縫裡的深色底
    const top = opt.carcassTop !== undefined ? Math.min(h1, opt.carcassTop) : h1;
    if (top > h0) b.box(R(f, fr.from, fr.to, DOOR + 0.3, depth), h0, top, mat.walnut);
    b.box(R(f, fr.from, fr.to, DOOR, DOOR + 0.3), h0, h1, mat.gap, { cast: false });
    const w = (fr.to - fr.from) / fr.n, hh = (h1 - h0) / rows;
    // 取手往開放格伸 2 cm（grip）
    const nearOpen = (h: number) => fronts.some((o) => o.kind === 'open' && (Math.abs(o.h[0] - h) < 1e-6 || Math.abs(o.h[1] - h) < 1e-6) && o.from < fr.to && o.to > fr.from);
    for (let c = 0; c < fr.n; c++) for (let r = 0; r < rows; r++) {
      const a0 = fr.from + c * w + g, a1 = fr.from + (c + 1) * w - g;
      let p0 = h0 + r * hh + gm, p1 = h0 + (r + 1) * hh - gm;
      if (fr.handle === 'grip') {
        if (r === rows - 1 && nearOpen(h1)) p1 += 0.02;
        if (r === 0 && nearOpen(h0)) p0 -= 0.02;
      }
      if (fr.handle === 'gola') {
        // 上緣鋁擠取手溝：門片頂降低，溝內是深色鋁料，內凹 1.2 cm
        p1 -= GOLA;
        b.box(R(f, a0 - g, a1 + g, 1.2, DOOR + 0.3), p1 + gm, p1 + GOLA + gm, mat.black, { cast: false });
      }
      panel(b, f, a0, a1, p0, p1, 0, DOOR, mat.walnut);
      if (fr.handle === 'chamfer') {
        // 開啟邊 45° 斜切：成對的門由中間開，單扇由右邊開；以 1.2 cm 寬的深色內凹邊表現
        const opensAtEnd = fr.n % 2 === 1 && c === fr.n - 1 ? true : c % 2 === 0;
        const e0 = opensAtEnd ? a1 - 1.2 : a0, e1 = opensAtEnd ? a1 : a0 + 1.2;
        b.box(R(f, e0, e1, -0.05, 0.6), p0 + 0.002, p1 - 0.002, mat.gap, { cast: false });
      }
    }
  }
}

/** 系統櫃（衣櫃、高櫃、電視櫃、展示櫃、鞋櫃） */
export function cabinet(b: Build, it: ItemOf<'cabinet'>): void {
  const { mat } = b;
  const f = frameOf(it.rect, it.front);
  const along = f.hor ? [it.rect[0], it.rect[2]] : [it.rect[1], it.rect[3]];
  const depth = Math.abs(f.back - f.face);
  if (it.plinth) {
    // 內縮踢腳
    b.box(R(f, along[0] + 0.5, along[1] - 0.5, PLINTH_SET, depth), it.h[0], it.h[0] + it.plinth, mat.gap, { cast: false });
  }
  buildFronts(b, f, it.fronts);
  if (it.underGlow) {
    // 懸空櫃底部的間接光（燈條內縮），往下照地面
    const g = R(f, along[0] + 2, along[1] - 2, 2, depth - 2);
    b.glowBox(...g, it.h[0] - 0.005, it.h[0], mat.glowSoft);
    b.stripLight((g[0] + g[2]) / 2, (g[1] + g[3]) / 2, it.h[0] - 0.006, (along[1] - along[0] - 4) / 100, (depth - 4) / 100, f.hor, 'down', lighting.strips.under);
  }
  b.solid(it.rect);
}

/* ---------- 書櫃 ---------- */

/** 開放書櫃：背板、側板、立板（每格 ≤ 80 cm）、25 mm 層板，各格隨機排書 */
export function shelf(b: Build, it: ItemOf<'shelf'>): void {
  const { mat, books } = b;
  const [x1, y1, x2, y2] = it.rect, h = it.h, n = it.shelves, back = it.back;
  const r = rng(it.seed || 11), along = back === 'E' || back === 'W', T = BOARD;
  const L0 = along ? y1 : x1, L1 = along ? y2 : x2, D0 = along ? x1 : y1, D1 = along ? x2 : y2;
  const P = (l0: number, l1: number, d0: number, d1: number, h0: number, h1: number, m: THREE.Material) =>
    along ? b.bx(d0, l0, d1, l1, h0, h1, m) : b.bx(l0, d0, l1, d1, h0, h1, m);
  const backAtMin = back === 'W' || back === 'N';
  P(L0, L1, backAtMin ? D0 : D1 - T, backAtMin ? D0 + T : D1, 0, h, mat.walnutDark);
  // 側板與立板
  const inner = L1 - L0 - 2 * T, bays = Math.max(1, Math.ceil(inner / BAY_MAX)), bw = (inner - (bays - 1) * T) / bays;
  const edges: [number, number][] = [];
  for (let i = 0; i < bays; i++) edges.push([L0 + T + i * (bw + T), L0 + T + i * (bw + T) + bw]);
  P(L0, L0 + T, D0, D1, 0, h, mat.walnut);
  P(L1 - T, L1, D0, D1, 0, h, mat.walnut);
  for (let i = 1; i < bays; i++) P(edges[i][0] - T, edges[i][0], D0, D1, 0, h, mat.walnut);
  // 層板（底板到頂板）與書
  const t = SHELF_T;
  for (let i = 0; i <= n; i++) {
    const y = (i * (h - t)) / n;
    for (const [e0, e1] of edges) P(e0, e1, D0, D1, y, y + t, mat.walnut);
    if (i === n) continue;
    const top = ((i + 1) * (h - t)) / n;
    for (const [e0, e1] of edges) {
      let l = e0 + 1;
      while (l < e1 - 6) {
        const w = 1.6 + r() * 3.2, hh = Math.min(0.18 + r() * 0.14, top - y - t - 0.03);
        if (r() < 0.18) { l += 6 + r() * 10; continue; }
        P(l, Math.min(l + w, e1 - 1), D0 + 3, D1 - 3, y + t, y + t + hh, books[(r() * books.length) | 0]);
        l += w + 0.2;
      }
    }
  }
  b.solid(it.rect);
}

/* ---------- 廚房 ---------- */

/** 一字型廚具（靠北牆、櫃門朝南）：下櫃＋取手溝、挖水槽孔的石材檯面、不鏽鋼下嵌水槽、鵝頸龍頭、雙口爐、煙機櫃、擋水石材 */
export function kitchenRun(b: Build, it: ItemOf<'kitchenRun'>): void {
  const { mat } = b;
  const [x1, y1, x2, y2] = it.rect;
  const f = frameOf(it.rect, 'S');
  // 內縮踢腳＋下櫃（水槽下方的櫃體頂降到 0.72 m，讓水槽有深度）
  b.box(R(f, x1 + 0.5, x2 - 0.5, PLINTH_SET, y2 - y1), 0, 0.1, mat.gap, { cast: false });
  buildFronts(b, f, it.fronts, { carcassTop: 0.72 });
  b.solid(it.rect);

  // 檯面：在水槽處開孔
  const [s0, sy0, s1, sy1] = it.sink, tx0 = x1 - 3, tx1 = x2 + 3, ty1 = y2 + 2;
  for (const r of [[tx0, y1, s0, ty1], [s1, y1, tx1, ty1], [s0, y1, s1, sy0], [s0, sy1, s1, ty1]] as Rect[]) b.box(r, 0.86, 0.9, mat.stone);
  // 不鏽鋼下嵌水槽：深 18 cm
  const wall = 0.2;
  b.box(it.sink, 0.715, 0.72, mat.steel, { cast: false });
  for (const r of [[s0, sy0, s1, sy0 + wall], [s0, sy1 - wall, s1, sy1], [s0, sy0, s0 + wall, sy1], [s1 - wall, sy0, s1, sy1]] as Rect[]) b.box(r, 0.72, 0.9, mat.steel, { cast: false });
  b.disc((s0 + s1) / 2, (sy0 + sy1) / 2, 0.7205, 0.03, 20, mat.gap);
  // 鵝頸龍頭（參考 GROHE Minta：高約 378 mm、出水距約 220 mm）
  const fx = (s0 + s1) / 2, fy = y1 + 5;
  const pts = [[fy, 0.9], [fy, 1.18], [fy + 2, 1.27], [fy + 12, 1.285], [sy0 + 16, 1.22], [sy0 + 18, 1.09]].map(([y, h]) => new THREE.Vector3(X(fx), h, Z(y)));
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.014, 12), mat.blackSatin);
  tube.castShadow = true;
  b.root.add(tube);
  b.cyl(fx, fy, 0.026, 0.9, 0.93, mat.blackSatin);
  b.bx(fx + 2.6, fy - 0.6, fx + 7, fy + 0.6, 1.0, 1.015, mat.blackSatin); // 側邊把手

  // 雙口爐：黑玻璃面板＋爐架＋旋鈕
  const [hb0, hy0, hb1, hy1] = it.hob;
  b.box(it.hob, 0.9, 0.906, mat.tv, { cast: false });
  const by = (hy0 + hy1) / 2 - 2;
  for (const bx of [hb0 + (hb1 - hb0) * 0.25, hb0 + (hb1 - hb0) * 0.75]) {
    b.cyl(bx, by, 0.045, 0.906, 0.912, mat.black, { seg: 32 });
    b.cyl(bx, by, 0.028, 0.912, 0.925, mat.black);
    b.cyl(bx, hy1 - 3, 0.012, 0.906, 0.926, mat.blackSatin);
  }

  // 煙機櫃：包住抽油煙機、做到天花，按壓門；底部是抽油煙機吸氣面板與照明
  const hb = frameOf(it.hoodBox, 'S');
  buildFronts(b, hb, [{ from: it.hoodBox[0], to: it.hoodBox[2], h: [it.hoodH0, H], n: 2, kind: 'door', handle: 'push' }]);
  const [hx1, hyy1, hx2, hy2] = it.hood;
  b.box([hx1, hyy1 + 2, hx2, hy2 - 2], it.hoodH0 - 0.006, it.hoodH0, mat.black);
  b.glowBox(hx1 + 2, hy2 - 15, hx2 - 2, hy2 - 3, it.hoodH0 - 0.008, it.hoodH0 - 0.006, mat.glowSoft);

  // 擋水牆石材
  for (const s of it.backsplash) b.box(s.rect, s.h[0], s.h[1], mat.stone, { cast: false });
}

/** 中島：rect 為檯面外框；走道側（北面）做門片＋取手溝 */
export function island(b: Build, it: ItemOf<'island'>): void {
  const { mat } = b;
  const [x1, y1, x2, y2] = it.rect;
  const body: Rect = [x1 + 7, y1 + 7, x2 - 7, y2 - 7];
  const f = frameOf(body, 'N');
  b.box(R(f, body[0] + 0.5, body[2] - 0.5, PLINTH_SET, body[3] - body[1]), 0, 0.1, mat.gap, { cast: false });
  buildFronts(b, f, it.fronts);
  b.box(it.rect, 0.86, 0.92, mat.stoneWarm);
  b.solid(body);
}

export function wallShelf(b: Build, it: ItemOf<'wallShelf'>): void {
  for (const lv of it.levels) b.box(it.rect, lv, lv + 0.02, b.mat.walnutDark);
}

