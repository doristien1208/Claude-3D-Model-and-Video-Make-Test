import * as THREE from 'three';
import { CEILING_H as H, floorZones, site, solidBlocks, wallTiles, walls, type Wall } from '../data/layout';
import { isHorizontal } from '../data/query';
import type { Build } from './prims';

/* ---------- 牆體（依 SVG 牆線，門窗為開口） ---------- */
function buildWall(b: Build, w: Wall): void {
  const { mat } = b;
  const hor = isHorizontal(w), t = w.t;
  const [x1, y1] = w.a, [x2, y2] = w.b;
  const s0 = Math.min(hor ? x1 : y1, hor ? x2 : y2) - t / 2, e0 = Math.max(hor ? x1 : y1, hor ? x2 : y2) + t / 2;
  const c = hor ? y1 : x1;
  // 沿牆方向的一段實牆；兩端各多 0.6 px，避免接縫漏光。門洞邊不外伸，讓門樘旁的陰影縫露出來
  const seg = (a: number, e: number, h0: number, h1: number, padA = 0.6, padE = 0.6) => {
    if (e - a < 0.5) return;
    a -= padA; e += padE;
    const solid = h0 < 0.3;
    if (hor) b.bx(a, c - t / 2, e, c + t / 2, h0, h1, mat.wall, { solid });
    else b.bx(c - t / 2, a, c + t / 2, e, h0, h1, mat.wall, { solid });
    if (solid) b.planSegs.push({ hor, c, a, b: e, t, kind: 'wall' });
  };
  // 沿牆方向 s–e、厚度方向以牆中心 ±d/2 的方塊
  const along = (s: number, e: number, d: number, h0: number, h1: number, m: THREE.Material) =>
    hor ? b.bx(s, c - d / 2, e, c + d / 2, h0, h1, m) : b.bx(c - d / 2, s, c + d / 2, e, h0, h1, m);

  let cur = s0, curPad = 0.6;
  for (const o of [...(w.openings ?? [])].sort((p, q) => p.s - q.s)) {
    const pad = o.kind === 'door' ? 0 : 0.6;
    seg(cur, o.s, 0, H, curPad, pad);
    curPad = pad;
    if (o.bot > 0) seg(o.s, o.e, 0, o.bot);
    if (o.top < H) seg(o.s, o.e, o.top, H);
    // 窗框、窗扇、窗台在 windows.ts
    if (o.kind === 'window') b.planSegs.push({ hor, c, a: o.s, b: o.e, t: 3, kind: 'win' });
    if (o.kind === 'rail') {
      along(o.s, o.e, 6, o.bot, o.bot + 0.04, mat.black);
      b.planSegs.push({ hor, c, a: o.s, b: o.e, t: 3, kind: 'win' });
    }
    cur = o.e;
  }
  seg(cur, e0, 0, H, curPad, 0.6);
}

export interface Architecture {
  /** 天花板與掛在天花板下的東西（窗簾盒等）；俯瞰時整組隱藏 */
  ceiling: THREE.Group;
  ground: THREE.Mesh;
}

export function buildArchitecture(b: Build): Architecture {
  const { mat } = b;
  for (const w of walls) buildWall(b, w);
  for (const r of solidBlocks) {
    b.box(r, 0, H, mat.wall, { solid: true });
    b.planSegs.push({ block: r });
  }

  /* 地坪與天花 */
  const [fx1, fy1, fx2, fy2] = site.floor;
  b.bx(fx1, fy1, fx2, fy2, -0.02, 0, mat.floor, { cast: false });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), mat.outside);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(4.75, -0.03, 5.8);
  ground.receiveShadow = true;
  for (const z of floorZones) b.box(z.rect, 0, z.h, mat[z.material], { cast: false });
  const k = site.extWallT / 2;
  const ceiling = new THREE.Group();
  ceiling.name = 'ceiling';
  b.root.add(ceiling);
  ceiling.add(b.bx(fx1 - k, fy1 - k, fx2 + k, fy2 + k, H, H + 0.06, mat.ceil));

  /* 衛浴牆面石材 */
  for (const s of wallTiles) b.box(s.rect, s.h[0], s.h[1], mat.tileLight, { cast: false });

  return { ceiling, ground };
}
