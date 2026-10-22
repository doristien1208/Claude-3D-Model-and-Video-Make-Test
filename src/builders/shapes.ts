import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/*
 * 曲面工具：以一圈圈水平斷面放樣（loft）做出浴缸內膽、面盆、馬桶這類圓角曲面。
 * 斷面在平面上以 (x, z) 表示（Vector2 的 x = 世界 x、y = 世界 z），各圈點數相同、方向一致（x → z 逆時針）。
 */
export type Ring = readonly THREE.Vector2[];
export interface Section {
  ring: Ring;
  y: number;
}

/** 圓角矩形一圈：半寬 a、半深 b、圓角 r，中心 (cx, cz)；每個角 k 段、每邊 m 段，點數固定 4(k + m) */
export function roundRect(a: number, b: number, r: number, cx = 0, cz = 0, k = 6, m = 3): THREE.Vector2[] {
  r = Math.max(1e-4, Math.min(r, a - 1e-4, b - 1e-4));
  const C: [number, number][] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  const corner = (q: number, t: number) =>
    new THREE.Vector2(cx + C[q % 4][0] * (a - r) + r * Math.cos(t), cz + C[q % 4][1] * (b - r) + r * Math.sin(t));
  const pts: THREE.Vector2[] = [];
  for (let q = 0; q < 4; q++) {
    for (let i = 0; i < k; i++) pts.push(corner(q, ((q + i / k) * Math.PI) / 2));
    // 直邊：從這個角的終點到下一個角的起點
    const t = ((q + 1) * Math.PI) / 2, e0 = corner(q, t), e1 = corner(q + 1, t);
    for (let i = 0; i < m; i++) pts.push(e0.clone().lerp(e1, i / m));
  }
  return pts;
}

/**
 * 壁掛馬桶的平面輪廓（蛋形）：背面貼牆（s = 0）、往前到 s = L；半寬 w。
 * 後半用較方的超橢圓（貼牆面平），前半較圓且往前收窄（taper）。回傳 (u, s)，u 為橫向。
 */
export function eggRing(w: number, L: number, n = 48, nBack = 5, nFront = 2.4, taper = 0.12): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [], hl = L / 2;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 2 * Math.PI, c = Math.cos(t), sn = Math.sin(t);
    const e = 2 / (sn > 0 ? nFront : nBack);
    const v = hl * Math.sign(sn) * Math.abs(sn) ** e;
    const u = w * Math.sign(c) * Math.abs(c) ** e * (1 - taper * Math.max(0, v / hl));
    pts.push(new THREE.Vector2(u, hl + v));
  }
  return pts;
}

/**
 * 依序連接各圈。圈往上走時法線朝外、往下走時朝內（所以「外壁往上＋內壁往下」可以一路接成有厚度的盆）。
 * capStart／capEnd 在第一圈／最後一圈加平面封口（第一圈朝下、最後一圈朝上）。
 */
export function loft(sections: readonly Section[], capStart = false, capEnd = false): THREE.BufferGeometry {
  const N = sections[0].ring.length, pos: number[] = [], idx: number[] = [];
  for (const s of sections) for (const p of s.ring) pos.push(p.x, s.y, p.y);
  for (let i = 0; i + 1 < sections.length; i++) {
    const a = i * N, c = (i + 1) * N;
    for (let j = 0; j < N; j++) {
      const j1 = (j + 1) % N;
      idx.push(a + j, c + j1, a + j1, a + j, c + j, c + j1);
    }
  }
  const fan = (s: number, up: boolean) => {
    const ring = sections[s].ring, ci = pos.length / 3, o = s * N;
    const cen = ring.reduce((m, p) => m.add(p), new THREE.Vector2()).divideScalar(N);
    pos.push(cen.x, sections[s].y, cen.y);
    for (let j = 0; j < N; j++) {
      const j1 = (j + 1) % N;
      if (up) idx.push(ci, o + j1, o + j);
      else idx.push(ci, o + j, o + j1);
    }
  };
  if (capStart) fan(0, false);
  if (capEnd) fan(sections.length - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 一圈點 → THREE.Shape（或挖孔用的 Path） */
export function shapeOf(ring: Ring): THREE.Shape {
  return new THREE.Shape(ring.map((p) => p.clone()));
}

/**
 * 水平板：平面形狀（x, z）往上長 t（下緣在 y = 0），邊緣倒圓 bevel。
 * 用來做座蓋、檯面（可挖孔）、托盤。
 */
export function slab(shape: THREE.Shape, t: number, bevel = 0): THREE.BufferGeometry {
  const bt = Math.min(bevel, t / 2 - 1e-4);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: t - 2 * bt, curveSegments: 16,
    bevelEnabled: bt > 0, bevelThickness: bt, bevelSize: bt, bevelOffset: -bt, bevelSegments: 3,
  });
  // 形狀平面 (x, y) → 世界 (x, z)；擠出方向朝下，再整體抬到 0–t
  g.rotateX(Math.PI / 2);
  g.translate(0, t - bt, 0);
  return bt > 0 ? smooth(g) : g;
}

/** 合併重複頂點後重算法線（ExtrudeGeometry 預設每個三角形各自的法線，倒圓邊會一格一格）；保留一組空 uv 給 worldUV 填 */
export function smooth(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  const m = mergeVertices(g, 1e-5);
  m.computeVertexNormals();
  m.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(m.attributes.position.count * 2), 2));
  return m;
}
