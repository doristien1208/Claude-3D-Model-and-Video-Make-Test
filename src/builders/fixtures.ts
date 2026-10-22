import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { X, Z } from '../core/units';
import { CEILING_H as H, DOWNLIGHT, DOWNLIGHT_RECESS, type Downlight } from '../data/layout';
import type { ItemOf } from '../data/query';
import type { Build } from './prims';

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
