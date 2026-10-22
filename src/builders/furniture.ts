import * as THREE from 'three';
import { X, Z } from '../core/units';
import type { ItemOf } from '../data/query';
import { rectAlong, type Build } from './prims';
import { windowSpec, winFrame } from './windows';

/** 雙人床，床頭在北側 (y1) */
export function bed(b: Build, it: ItemOf<'bed'>): void {
  const { mat } = b;
  const [x1, y1, x2, y2] = it.rect;
  b.bx(x1 - 8, y1, x2 + 8, y1 + 8, 0, 1.1, mat.headboard);
  b.bx(x1 + 12, y1 + 20, x2 - 12, y2 - 12, 0, 0.1, mat.black, { cast: false });
  b.bx(x1, y1 + 8, x2, y2, 0.1, 0.3, mat.walnut, { solid: true });
  b.bx(x1 + 3, y1 + 10, x2 - 3, y2 - 3, 0.3, 0.5, mat.linen);
  b.bx(x1 - 1, y1 + 60, x2 + 1, y2 + 1, 0.36, 0.56, mat.duvet);
  b.bx(x1 - 1.5, y2 - 48, x2 + 1.5, y2 + 1.5, 0.4, 0.575, mat.throw);
  const w = (x2 - x1 - 24) / 2;
  b.bx(x1 + 8, y1 + 14, x1 + 8 + w, y1 + 46, 0.5, 0.64, mat.linen);
  b.bx(x2 - 8 - w, y1 + 14, x2 - 8, y1 + 46, 0.5, 0.64, mat.linen);
}

/** 懸浮床頭櫃 */
export function nightstand(b: Build, it: ItemOf<'nightstand'>): void {
  b.box(it.rect, 0.12, 0.5, b.mat.walnut, { solid: true });
}

export function rug(b: Build, it: ItemOf<'rug'>): void {
  b.box(it.rect, 0, 0.012, b.mat[it.material], { cast: false });
  // 客廳地毯的內層（淺色）
  if (it.inner) b.box(it.inner, 0.012, 0.014, b.mat.rug2, { cast: false });
}

/** 窗簾（收起狀態）：掛在窗簾盒內的軌道上，收在窗框外側，不遮窗 */
export function curtains(b: Build, it: ItemOf<'curtains'>): void {
  const f = winFrame(it.window);
  if (!windowSpec(it.window)?.curtainBox) throw new Error(`curtains：${it.window} 沒有窗簾盒`);
  const k0 = f.ci + f.σ * 6, k1 = f.ci + f.σ * 11, W = it.stackW;
  const panel = (a0: number, a1: number) => b.box(rectAlong(f.hor, a0, a1, k0, k1), 0.02, 2.75, b.mat.linen);
  if (it.sides !== 'end') panel(f.s - W, f.s);
  if (it.sides !== 'start') panel(f.e, f.e + W);
}

/** 書桌：桌板＋四支桌腳（內縮 4 px） */
export function desk(b: Build, it: ItemOf<'desk'>): void {
  const { mat } = b;
  const [x1, y1, x2, y2] = it.rect;
  b.box(it.rect, 0.72, 0.76, mat.walnut, { solid: true });
  for (const [x, y] of [[x1 + 4, y1 + 4], [x2 - 8, y1 + 4], [x1 + 4, y2 - 8], [x2 - 8, y2 - 8]]) b.bx(x, y, x + 4, y + 4, 0, 0.72, mat.black);
}

/** 書房椅：坐北朝南 */
export function officeChair(b: Build, it: ItemOf<'officeChair'>): void {
  const { mat } = b;
  const [x, y] = it.at;
  b.cyl(x, y, 0.24, 0.03, 0.06, mat.black);
  b.cyl(x, y, 0.025, 0.06, 0.45, mat.black);
  b.bx(x - 24, y - 22, x + 24, y + 22, 0.45, 0.52, mat.chair);
  b.bx(x - 24, y - 26, x + 24, y - 18, 0.52, 1.02, mat.chair);
}

/** L 型沙發；模型以外框西北角為原點（px），長邊椅背朝西、短邊椅背朝南 */
export function sofaL(b: Build, it: ItemOf<'sofaL'>): void {
  const { mat } = b;
  const [ox, oy] = it.rect;
  const p = (r: readonly number[], h0: number, h1: number, m: THREE.Material, solid?: boolean) =>
    b.bx(ox + r[0], oy + r[1], ox + r[2], oy + r[3], h0, h1, m, { solid });
  p([0, 0, 94, 233], 0.08, 0.42, mat.fabric, true);       // 長邊座框
  p([94, 164, 207, 233], 0.08, 0.42, mat.fabric, true);   // 短邊座框
  p([0, 0, 22, 233], 0.42, 0.82, mat.fabric);             // 長邊椅背
  p([22, 211, 207, 233], 0.42, 0.82, mat.fabric);         // 短邊椅背
  p([0, 0, 94, 19], 0.42, 0.62, mat.fabric);              // 北側扶手
  p([187, 164, 207, 211], 0.42, 0.62, mat.fabric);        // 東側扶手
  for (const [a, c, d, e] of [[22, 19, 94, 82], [22, 83, 94, 146], [22, 147, 94, 211], [95, 164, 141, 211], [142, 164, 187, 211]])
    p([a + 0.5, c + 0.5, d - 0.5, e - 0.5], 0.42, 0.5, mat.fabricL);
  p([24, 25, 40, 67], 0.5, 0.78, mat.ochre);
  p([24, 157, 40, 199], 0.5, 0.76, mat.throw);
  p([148, 193, 190, 209], 0.5, 0.75, mat.ochre);
}

export function coffeeTable(b: Build, it: ItemOf<'coffeeTable'>): void {
  const { mat } = b;
  const [x, y] = it.at;
  b.cyl(x, y, it.r, 0.34, 0.38, mat.walnut, { solid: true });
  b.cyl(x, y, 0.3, 0, 0.34, mat.black);
}

/** 皮革單椅，正面朝向 faceTo；零件以公尺、椅子本地座標表示（椅背在 +z） */
export function armchair(b: Build, it: ItemOf<'armchair'>): void {
  const { mat } = b;
  const [x, y] = it.at, [fx, fy] = it.faceTo;
  const ch = new THREE.Group();
  ch.position.set(X(x), 0, Z(y));
  ch.rotation.y = Math.atan2(-(fx - x), -(fy - y));
  b.root.add(ch);
  const parts: [number, number, number, number, number, number, THREE.Material][] = [
    [0.7, 0.32, 0.62, 0, 0.24, 0, mat.leather],
    [0.7, 0.42, 0.12, 0, 0.6, 0.27, mat.leather],
    [0.1, 0.2, 0.62, -0.32, 0.5, 0, mat.leather],
    [0.1, 0.2, 0.62, 0.32, 0.5, 0, mat.leather],
    [0.6, 0.08, 0.5, 0, 0.04, 0, mat.black],
  ];
  for (const [w, h, d, px, py, pz, m] of parts) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    e.position.set(px, py, pz);
    e.castShadow = e.receiveShadow = true;
    ch.add(e);
  }
  b.solids.push([X(x) - 0.35, Z(y) - 0.35, X(x) + 0.35, Z(y) + 0.35]);
}

/** 吧台椅 */
export function barStool(b: Build, it: ItemOf<'barStool'>): void {
  const { mat } = b;
  const [x, y] = it.at;
  b.cyl(x, y, 0.2, 0.64, 0.7, mat.leather);
  b.cyl(x, y, 0.025, 0, 0.64, mat.black);
  b.cyl(x, y, 0.17, 0, 0.02, mat.black);
}
