import { doors, finishes, items, site, solidBlocks, spaces, walls, type Item, type Rect } from '../data/layout';
import { findOpening, isHorizontal } from '../data/query';
import type { Build } from './prims';

/** 貼牆落地、背後不做踢腳板的物件 */
const WALL_HUGGING = new Set<Item['type']>(['cabinet', 'kitchenRun', 'shelf', 'shoeCabinet', 'slatWall', 'headboardPanel']);
/** 物件離牆面在這個距離內，就視為貼牆（px） */
const HUG_TOL = 5;

/** 室內牆面上的一段：hor 為沿 x 方向；c 為牆面座標；n 為室內在哪一側（±1） */
interface Run { hor: boolean; c: number; a: number; b: number; n: 1 | -1 }
/** 扣除後的一段，記錄兩端是自然端點（轉角、牆端）還是被扣掉的切斷點 */
interface Piece { a: number; b: number; cutA: boolean; cutB: boolean }

const inside = (r: Rect, x: number, y: number) => x > r[0] && x < r[2] && y > r[1] && y < r[3];

/**
 * 門洞：exact 為牆厚範圍；wide 兩側各往室內多 1 px，扣同方向牆面時用，讓門洞邊的牆面也被扣到，
 * 踢腳板收在門洞邊而不是延伸進陰影縫。
 */
interface Hole { hor: boolean; exact: Rect; wide: Rect }

/** 地坪高度的牆體（門洞挖空）與門洞 */
function floorPlan(): { pieces: Rect[]; holes: Hole[] } {
  const pieces: Rect[] = [...solidBlocks], holes: Hole[] = [];
  for (const w of walls) {
    const hor = isHorizontal(w), c = hor ? w.a[1] : w.a[0], t = w.t;
    const lo = Math.min(hor ? w.a[0] : w.a[1], hor ? w.b[0] : w.b[1]) - t / 2;
    const hi = Math.max(hor ? w.a[0] : w.a[1], hor ? w.b[0] : w.b[1]) + t / 2;
    const r = (a: number, b: number, k = t / 2): Rect => (hor ? [a, c - k, b, c + k] : [c - k, a, c + k, b]);
    let cur = lo;
    for (const o of [...(w.openings ?? [])].filter((o) => o.kind === 'door').sort((p, q) => p.s - q.s)) {
      if (o.s > cur) pieces.push(r(cur, o.s));
      holes.push({ hor, exact: r(o.s, o.e), wide: r(o.s, o.e, t / 2 + 1) });
      cur = o.e;
    }
    if (hi > cur) pieces.push(r(cur, hi));
  }
  return { pieces, holes };
}

/** 以牆體座標切成不等距格子，從客廳往外填滿室內，取出室內格與牆格之間的邊 */
function interiorRuns(pieces: Rect[]): Run[] {
  const [fx1, fy1, fx2, fy2] = site.floor;
  const uniq = (v: number[]) => [...new Set(v)].sort((p, q) => p - q);
  const xs = uniq([fx1, fx2, ...pieces.flatMap((r) => [r[0], r[2]])].filter((v) => v >= fx1 && v <= fx2));
  const ys = uniq([fy1, fy2, ...pieces.flatMap((r) => [r[1], r[3]])].filter((v) => v >= fy1 && v <= fy2));
  const nx = xs.length - 1, ny = ys.length - 1, idx = (i: number, j: number) => j * nx + i;
  const wall = new Uint8Array(nx * ny), room = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
    wall[idx(i, j)] = pieces.some((r) => inside(r, cx, cy)) ? 1 : 0;
  }
  // 從客廳中央開始填
  const si = xs.findIndex((x, i) => x <= 700 && xs[i + 1] > 700), sj = ys.findIndex((y, j) => y <= 600 && ys[j + 1] > 600);
  const stack = [[si, sj]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    if (i < 0 || j < 0 || i >= nx || j >= ny || room[idx(i, j)] || wall[idx(i, j)]) continue;
    room[idx(i, j)] = 1;
    stack.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]);
  }
  const isWall = (i: number, j: number) => i >= 0 && j >= 0 && i < nx && j < ny && wall[idx(i, j)] === 1;
  const edges: Run[] = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (!room[idx(i, j)]) continue;
    if (isWall(i - 1, j)) edges.push({ hor: false, c: xs[i], a: ys[j], b: ys[j + 1], n: 1 });
    if (isWall(i + 1, j)) edges.push({ hor: false, c: xs[i + 1], a: ys[j], b: ys[j + 1], n: -1 });
    if (isWall(i, j - 1)) edges.push({ hor: true, c: ys[j], a: xs[i], b: xs[i + 1], n: 1 });
    if (isWall(i, j + 1)) edges.push({ hor: true, c: ys[j + 1], a: xs[i], b: xs[i + 1], n: -1 });
  }
  // 同一條線、同一側、首尾相接的邊合併成一段
  edges.sort((p, q) => Number(p.hor) - Number(q.hor) || p.c - q.c || p.n - q.n || p.a - q.a);
  const runs: Run[] = [];
  for (const e of edges) {
    const last = runs[runs.length - 1];
    if (last && last.hor === e.hor && last.c === e.c && last.n === e.n && last.b === e.a) last.b = e.b;
    else runs.push({ ...e });
  }
  return runs;
}

/** 從 [a, b] 扣掉一組區間，回傳剩下的段落與端點性質 */
function subtract(a: number, b: number, cuts: [number, number][]): Piece[] {
  let out: Piece[] = [{ a, b, cutA: false, cutB: false }];
  for (const [c0, c1] of cuts) {
    const next: Piece[] = [];
    for (const p of out) {
      // 剛好碰到端點：段落不變，但那一端算是被切斷（不延伸）
      if (Math.abs(c0 - p.b) < 1e-6) { next.push({ ...p, cutB: true }); continue; }
      if (Math.abs(c1 - p.a) < 1e-6) { next.push({ ...p, cutA: true }); continue; }
      if (c1 <= p.a || c0 >= p.b) { next.push(p); continue; }
      if (c0 > p.a) next.push({ a: p.a, b: c0, cutA: p.cutA, cutB: true });
      if (c1 < p.b) next.push({ a: c1, b: p.b, cutA: true, cutB: p.cutB });
    }
    out = next;
  }
  return out;
}

/** 踢腳板：沿所有室內牆面，扣掉門洞、貼牆的系統櫃、外掛拉門軌道範圍與不做的空間 */
export function buildBaseboards(b: Build): void {
  const { h, t: T, excludeSpaces } = finishes.baseboard;
  const { pieces, holes } = floorPlan();
  const excluded = spaces.filter((s) => excludeSpaces.includes(s.id)).map((s) => s.rect);
  const hugging = items.filter((it) => WALL_HUGGING.has(it.type)).map((it) => (it as { rect: Rect }).rect);

  // 外掛拉門：門片在牆面前滑動，滑動範圍（門片到牆面之間）不做踢腳板
  const tracks: Rect[] = [];
  for (const d of doors) {
    if (d.kind !== 'slide') continue;
    const { wall, opening } = findOpening(d.opening);
    const hor = isHorizontal(wall), σ = d.side === 'S' || d.side === 'E' ? 1 : -1;
    const face = (hor ? wall.a[1] : wall.a[0]) + σ * (wall.t / 2), outer = face + σ * (d.gap + d.leafT);
    const L0 = opening.s - d.overlap, L1 = opening.e + d.overlap, dir = d.slideTo === 'start' ? -1 : 1;
    const a = Math.min(L0, L0 + dir * d.travel), e = Math.max(L1, L1 + dir * d.travel);
    const k0 = Math.min(face, outer), k1 = Math.max(face, outer);
    tracks.push(hor ? [a, k0, e, k1] : [k0, a, k1, e]);
  }
  // 不做踢腳板的區域：衛浴與陽台、門洞（含門樘側面）、拉門滑動範圍
  const fixedZones = [...excluded, ...tracks];

  for (const r of interiorRuns(pieces)) {
    const probe = r.c + r.n * 0.5; // 往室內偏 0.5 px，判斷牆面落在哪個區域
    const cuts: [number, number][] = [];
    for (const z of [...fixedZones, ...holes.map((h) => (h.hor === r.hor ? h.wide : h.exact))]) {
      const [k0, k1, a0, a1] = r.hor ? [z[1], z[3], z[0], z[2]] : [z[0], z[2], z[1], z[3]];
      if (probe > k0 && probe < k1) cuts.push([a0, a1]);
    }
    for (const it of hugging) {
      const near = r.hor ? (r.n > 0 ? it[1] - r.c : r.c - it[3]) : (r.n > 0 ? it[0] - r.c : r.c - it[2]);
      if (near >= -1 && near <= HUG_TOL) cuts.push(r.hor ? [it[0], it[2]] : [it[1], it[3]]);
    }

    for (const p of subtract(r.a, r.b, cuts)) {
      if (p.b - p.a < 0.3 || (p.cutA && p.cutB && p.b - p.a < 4)) continue;
      // 轉角與牆端各多延伸一個板厚，讓陽角補滿；被扣掉的那一端（門洞、櫃體）不延伸
      const a = p.cutA ? p.a : p.a - T;
      const e = p.cutB ? p.b : p.b + T;
      const k0 = r.c, k1 = r.c + r.n * T;
      if (r.hor) b.bx(a, k0, e, k1, 0, h, b.mat.walnutDark, { cast: false });
      else b.bx(k0, a, k1, e, 0, h, b.mat.walnutDark, { cast: false });
    }
  }
}
