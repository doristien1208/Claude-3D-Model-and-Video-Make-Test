import * as THREE from 'three';
import { CEILING_H as H, doors, floorZones, lighting, site, solidBlocks, wallTiles, walls, type Door, type Wall } from '../data/layout';
import { isHorizontal } from '../data/query';
import type { Build } from './prims';

/* ---------- 牆體（依 SVG 牆線，門窗為開口） ---------- */
function buildWall(b: Build, w: Wall): void {
  const { mat } = b;
  const hor = isHorizontal(w), t = w.t;
  const [x1, y1] = w.a, [x2, y2] = w.b;
  const s0 = Math.min(hor ? x1 : y1, hor ? x2 : y2) - t / 2, e0 = Math.max(hor ? x1 : y1, hor ? x2 : y2) + t / 2;
  const c = hor ? y1 : x1;
  // 沿牆方向的一段實牆；兩端各多 0.6 px，避免接縫漏光
  const seg = (a: number, e: number, h0: number, h1: number) => {
    if (e - a < 0.5) return;
    a -= 0.6; e += 0.6;
    const solid = h0 < 0.3;
    if (hor) b.bx(a, c - t / 2, e, c + t / 2, h0, h1, mat.wall, { solid });
    else b.bx(c - t / 2, a, c + t / 2, e, h0, h1, mat.wall, { solid });
    if (solid) b.planSegs.push({ hor, c, a, b: e, t, kind: 'wall' });
  };
  // 沿牆方向 s–e、厚度方向以牆中心 ±d/2 的方塊
  const along = (s: number, e: number, d: number, h0: number, h1: number, m: THREE.Material, cast?: boolean) =>
    hor ? b.bx(s, c - d / 2, e, c + d / 2, h0, h1, m, { cast }) : b.bx(c - d / 2, s, c + d / 2, e, h0, h1, m, { cast });

  let cur = s0;
  for (const o of [...(w.openings ?? [])].sort((p, q) => p.s - q.s)) {
    seg(cur, o.s, 0, H);
    if (o.bot > 0) seg(o.s, o.e, 0, o.bot);
    if (o.top < H) seg(o.s, o.e, o.top, H);
    if (o.kind === 'window') {
      // 玻璃 1.2 px，鋁框 4 px；寬於 1.4 m 加中梃
      const gt = 1.2, f = 4;
      along(o.s, o.e, gt, o.bot, o.top, mat.glass, false);
      along(o.s, o.e, f, o.bot, o.bot + 0.04, mat.black);
      along(o.s, o.e, f, o.top - 0.04, o.top, mat.black);
      along(o.s, o.s + 4, f, o.bot, o.top, mat.black);
      along(o.e - 4, o.e, f, o.bot, o.top, mat.black);
      if (o.e - o.s > 140) along((o.s + o.e) / 2 - 2, (o.s + o.e) / 2 + 2, f, o.bot, o.top, mat.black);
      b.planSegs.push({ hor, c, a: o.s, b: o.e, t: 3, kind: 'win' });
    }
    if (o.kind === 'rail') {
      along(o.s, o.e, 6, o.bot, o.bot + 0.04, mat.black);
      b.planSegs.push({ hor, c, a: o.s, b: o.e, t: 3, kind: 'win' });
    }
    cur = o.e;
  }
  seg(cur, e0, 0, H);
}

/* ---------- 門（參考版的固定開啟狀態） ---------- */
function buildDoor(b: Build, d: Door): void {
  const { mat } = b;
  switch (d.kind) {
    case 'swing':
      b.box(d.leaf, 0, d.leafH, mat[d.material], { solid: d.solid });
      if (d.handle && d.handleH) b.box(d.handle, d.handleH[0], d.handleH[1], mat.black);
      break;
    case 'slide':
      b.box(d.leaf, 0, d.leafH, mat.walnut, { solid: true });
      b.box(d.track, d.trackH[0], d.trackH[1], mat.black);
      b.box(d.handle, d.handleH[0], d.handleH[1], mat.black);
      break;
    case 'slideGlass': {
      // 固定片在牆中心 ±2 px，活動片在室內側 +3–7 px；兩片各有 4 px 邊框
      const c = d.wallY, h = d.h;
      b.bx(d.fixed[0], c - 2, d.fixed[1], c + 2, 0, h, mat.glass, { cast: false, solid: true });
      b.bx(d.active[0], c + 3, d.active[1], c + 7, 0, h, mat.glass, { cast: false });
      for (const [s, e, y0, y1] of [
        [d.fixed[0], d.fixed[0] + 4, c - 2, c + 2], [d.fixed[1] - 4, d.fixed[1], c - 2, c + 2],
        [d.active[0], d.active[0] + 4, c + 3, c + 7], [d.active[1] - 4, d.active[1], c + 3, c + 7],
      ]) b.bx(s, y0, e, y1, 0, h, mat.black);
      b.bx(d.fixed[0], c - 2, d.trackEnd, c + 7, h - 0.03, h, mat.black);
      b.bx(d.fixed[0], c - 2, d.trackEnd, c + 7, 0, 0.03, mat.black);
      break;
    }
  }
}

export interface Architecture {
  ceiling: THREE.Mesh;
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
  const ceiling = b.bx(fx1 - k, fy1 - k, fx2 + k, fy2 + k, H, H + 0.06, mat.ceil);

  /* 衛浴牆面石材 */
  for (const s of wallTiles) b.box(s.rect, s.h[0], s.h[1], mat.tileLight, { cast: false });

  for (const d of doors) buildDoor(b, d);

  /* 天花板間接光 */
  for (const cv of lighting.coves) b.glowBox(cv.rect[0], cv.rect[1], cv.rect[2], cv.rect[3], cv.h[0], cv.h[1]);

  return { ceiling, ground };
}
