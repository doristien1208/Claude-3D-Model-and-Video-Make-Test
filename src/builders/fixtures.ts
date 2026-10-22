import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { X, Z } from '../core/units';
import { CEILING_H as H, type Pt } from '../data/layout';
import type { ItemOf } from '../data/query';
import type { Build } from './prims';

/* ---------- 衛浴設備 ---------- */

/** 浴缸：石材底座（外擴 2 px）、白色缸體、水面（內縮 8 px） */
export function bathtub(b: Build, it: ItemOf<'bathtub'>): void {
  const { mat } = b;
  const [x1, y1, x2, y2] = it.rect;
  b.bx(x1 - 2, y1 - 2, x2 + 2, y2 + 2, 0, 0.08, mat.stone);
  b.box(it.rect, 0, 0.56, mat.acrylic, { solid: true });
  b.bx(x1 + 8, y1 + 8, x2 - 8, y2 - 8, 0.5, 0.565, mat.water, { cast: false });
}

/** 壁掛淋浴龍頭（裝在西牆面，朝東）：控制面板＋立管 */
export function showerValve(b: Build, it: ItemOf<'showerValve'>): void {
  const { mat } = b;
  const [x, y] = it.at;
  b.bx(x, y - 16, x + 3, y + 16, 1.0, 1.18, mat.blackSatin);
  b.bx(x, y - 2, x + 4, y + 2, 1.18, 2.0, mat.blackSatin);
}

/** 頂噴花灑：從 from（牆面）伸出橫桿到 head */
export function showerHead(b: Build, it: ItemOf<'showerHead'>): void {
  const { mat } = b;
  const [hx, hy] = it.head, [fx, fy] = it.from;
  b.cyl(hx, hy, it.r, 2.3, 2.32, mat.blackSatin);
  if (fy === hy) b.bx(Math.min(fx, hx), hy - 2, Math.max(fx, hx), hy + 2, 2.3, 2.32, mat.blackSatin);
  else b.bx(hx - 2, Math.min(fy, hy), hx + 2, Math.max(fy, hy), 2.3, 2.32, mat.blackSatin);
}

/**
 * 固定玻璃隔屏；自由端在 rect 的較大座標端。
 * full：上框＋下框＋自由端立框；top：只有上框（多伸出 1 px）。
 */
export function glassScreen(b: Build, it: ItemOf<'glassScreen'>): void {
  const { mat } = b;
  const [x1, y1, x2, y2] = it.rect, h = it.h;
  b.box(it.rect, 0, h, mat.glass, { cast: false, solid: true });
  const thinX = x2 - x1 < y2 - y1;
  // 沿長邊 s–e、厚度方向外擴 0.5 px 的框
  const frame = (s: number, e: number, h0: number, h1: number) =>
    thinX ? b.bx(x1 - 0.5, s, x2 + 0.5, e, h0, h1, mat.black) : b.bx(s, y1 - 0.5, e, y2 + 0.5, h0, h1, mat.black);
  const s = thinX ? y1 : x1, e = thinX ? y2 : x2;
  if (it.frame === 'full') {
    frame(s, e, h - 0.02, h);
    frame(e - 2, e + 1, 0, h);
    frame(s, e, 0, 0.02);
  } else {
    frame(s, e + 1, h - 0.02, h);
  }
}

/** 壁掛馬桶＋隱藏水箱 */
export function toilet(b: Build, it: ItemOf<'toilet'>): void {
  const { mat } = b;
  b.box(it.tank, it.tankH[0], it.tankH[1], mat.walnut);
  b.box(it.bowl, 0.22, 0.42, mat.white, { solid: true });
}

/** 懸浮洗手台＋鏡子＋鏡上燈條（鏡子貼北牆，燈條在鏡面前 2 px） */
export function vanity(b: Build, it: ItemOf<'vanity'>): void {
  const { mat } = b;
  b.box(it.rect, 0.5, 0.85, mat.walnut, { solid: true });
  b.box(it.basin, 0.85, 0.95, mat.white);
  b.box(it.faucet, 0.95, it.faucetTop, mat.blackSatin);
  const [mx1, , mx2, my2] = it.mirror, [m0, m1] = it.mirrorH;
  b.box(it.mirror, m0, m1, mat.mirror, { cast: false });
  b.glowBox(mx1, my2, mx2, my2 + 2, m1, m1 + 0.02);
  // 鏡面即時平面反射（Reflector）：鏡子貼北牆、朝南；顏色 0.5 線性為原樣反射，略低一點並帶極淡綠＝銀鏡約 86% 反射率
  const w = (mx2 - mx1) / 100, h = m1 - m0;
  const mirror = new Reflector(new THREE.PlaneGeometry(w, h), {
    clipBias: 0.003, color: 0xb0b4b1, textureWidth: Math.round(1400 * w), textureHeight: Math.round(1400 * h),
  });
  mirror.position.set(X((mx1 + mx2) / 2), (m0 + m1) / 2, Z(my2) + 0.0005);
  b.root.add(mirror);
  b.reflectors.push(mirror);
}

export function towelBar(b: Build, it: ItemOf<'towelBar'>): void {
  b.box(it.rect, it.h[0], it.h[1], b.mat.blackSatin);
}

/* ---------- 燈具 ---------- */

/** 床頭壁燈（發光面板） */
export function wallLamp(b: Build, it: ItemOf<'wallLamp'>): void {
  b.glowBox(it.rect[0], it.rect[1], it.rect[2], it.rect[3], it.h[0], it.h[1], b.mat.glowSoft);
}

export function deskLamp(b: Build, it: ItemOf<'deskLamp'>): void {
  const { mat } = b;
  const [x, y] = it.at;
  b.cyl(x, y, 0.07, 0.76, 0.78, mat.black);
  b.cyl(x, y, 0.008, 0.78, 1.15, mat.black);
  b.glowBox(x - 12, y + 5, x + 12, y + 17, 1.14, 1.17, mat.glowSoft);
}

export function floorLamp(b: Build, it: ItemOf<'floorLamp'>): void {
  const { mat } = b;
  const [x, y] = it.at;
  b.cyl(x, y, 0.14, 0, 0.03, mat.black);
  b.cyl(x, y, 0.012, 0.03, 1.45, mat.black);
  b.glow.push(b.cyl(x, y, 0.2, 1.4, 1.68, mat.glowSoft, { rTop: 0.17, cast: false }));
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

/** 天花板崁燈：發光圓面＋黑色外環 */
export function downlights(b: Build, pts: readonly Pt[]): void {
  const { mat } = b;
  for (const [px, py] of pts) {
    b.disc(px, py, H - 0.002, 0.045, 20, mat.glow);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.045, 0.06, 24), mat.black);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(X(px), H - 0.003, Z(py));
    b.root.add(ring);
  }
}

/* ---------- 影音 ---------- */

export function tv(b: Build, it: ItemOf<'tv'>): void {
  b.box(it.rect, it.h[0], it.h[1], b.mat.tv);
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
