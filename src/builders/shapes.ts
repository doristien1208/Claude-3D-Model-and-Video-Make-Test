import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

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
  return skin(sections.map((s) => s.ring.map((p) => new THREE.Vector3(p.x, s.y, p.y))), { capStart, capEnd });
}

export interface SkinOpt {
  /** 每圈頭尾相接（預設 true）；false 時最後一點要自己重複第一點（uv 接縫用） */
  closed?: boolean;
  capStart?: boolean;
  capEnd?: boolean;
  /** 每個點的 uv（公尺）；封口中心點取該圈平均 */
  uvs?: readonly (readonly THREE.Vector2[])[];
}

/**
 * loft 的一般化：各圈是任意位置的 3D 點（點數相同、方向一致）。
 * 法線方向 = 前進方向 × 圈的走向（loft 的水平圈逆時針往上走時朝外）。
 */
export function skin(rings: readonly (readonly THREE.Vector3[])[], o: SkinOpt = {}): THREE.BufferGeometry {
  const N = rings[0].length, closed = o.closed ?? true, pos: number[] = [], uv: number[] = [], idx: number[] = [];
  rings.forEach((r, i) => r.forEach((p, j) => {
    pos.push(p.x, p.y, p.z);
    if (o.uvs) uv.push(o.uvs[i][j].x, o.uvs[i][j].y);
  }));
  const J = closed ? N : N - 1;
  for (let i = 0; i + 1 < rings.length; i++) {
    const a = i * N, c = (i + 1) * N;
    for (let j = 0; j < J; j++) {
      const j1 = (j + 1) % N;
      idx.push(a + j, c + j1, a + j1, a + j, c + j, c + j1);
    }
  }
  const fan = (s: number, end: boolean) => {
    const ring = rings[s], ci = pos.length / 3, o2 = s * N, n = closed ? N : N - 1;
    const cen = ring.slice(0, n).reduce((m, p) => m.add(p), new THREE.Vector3()).divideScalar(n);
    pos.push(cen.x, cen.y, cen.z);
    if (o.uvs) {
      const cu = o.uvs[s].slice(0, n).reduce((m, p) => m.add(p), new THREE.Vector2()).divideScalar(n);
      uv.push(cu.x, cu.y);
    }
    for (let j = 0; j < J; j++) {
      const j1 = (j + 1) % N;
      if (end) idx.push(ci, o2 + j1, o2 + j);
      else idx.push(ci, o2 + j, o2 + j1);
    }
  };
  if (o.capStart) fan(0, false);
  if (o.capEnd) fan(rings.length - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (o.uvs) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 把同一位置、分屬兩邊的頂點（uv 接縫）法線取平均，讓接縫處光影連續 */
function weldNormals(g: THREE.BufferGeometry, pairs: readonly [number, number][]): void {
  const n = g.attributes.normal as THREE.BufferAttribute, a = new THREE.Vector3(), c = new THREE.Vector3();
  for (const [i, j] of pairs) {
    a.fromBufferAttribute(n, i).add(c.fromBufferAttribute(n, j)).normalize();
    n.setXYZ(i, a.x, a.y, a.z);
    n.setXYZ(j, a.x, a.y, a.z);
  }
  n.needsUpdate = true;
}

/**
 * 軟墊（沙發坐墊、椅背墊）：平面為圓角矩形（寬 w 沿 x、深 d 沿 z、平面圓角 r），
 * 四周斷面是半徑 e 的圓弧，頂面中間鼓起 crown、底面鼓 crownBottom；邊緣下緣 y = 0、上緣 y = t。
 * 由底面中心一圈圈往外、沿圓弧往上、再往頂面中心收。uv 以公尺計：頂底面 (x, z)，側面（周長, 斷面弧長），兩者在縫邊分開。
 */
export function cushion(w: number, d: number, t: number, o: { r?: number; e?: number; crown?: number; crownBottom?: number } = {}): THREE.BufferGeometry {
  const e = Math.min(o.e ?? 0.04, t / 2), r = o.r ?? 0.03, crown = o.crown ?? 0, cb = o.crownBottom ?? 0;
  const a = w / 2, b = d / 2, m = Math.min(a, b) - 0.003, F = 6, E = 6;
  const dome = (s: number) => 1 - (1 - s) ** 2;
  // [內縮量, 高, 是否側面]
  const prof: [number, number, boolean][] = [];
  for (let i = F; i >= 0; i--) prof.push([e + ((m - e) * i) / F, -cb * dome(i / F), false]);
  for (let i = 0; i <= E; i++) {
    const th = (i / E - 1) * (Math.PI / 2);
    prof.push([e * (1 - Math.cos(th)), e + e * Math.sin(th), true]);
  }
  for (let i = t - 2 * e > 1e-4 ? 0 : 1; i <= E; i++) {
    const th = (i / E) * (Math.PI / 2);
    prof.push([e * (1 - Math.cos(th)), t - e + e * Math.sin(th), true]);
  }
  for (let i = 0; i <= F; i++) prof.push([e + ((m - e) * i) / F, t + crown * dome(i / F), false]);

  // 內縮後的圓角：外圈沿用 r，往內逐漸變圓，頂面等高線不會在對角線上折出稜線
  const ringAt = (k: number) => {
    const ring = roundRect(a - k, b - k, Math.max(r - k, 0.5 * (k - e), 0.002), 0, 0, 6, 4);
    ring.push(ring[0].clone());
    return ring;
  };
  const outer = ringAt(0), per = [0];
  for (let j = 1; j < outer.length; j++) per.push(per[j - 1] + outer[j].distanceTo(outer[j - 1]));
  // 側面的 v 取斷面弧長（不是高度），圓弧轉到水平時貼圖才不會被拉長成一絲一絲
  const rings: THREE.Vector3[][] = [], uvs: THREE.Vector2[][] = [];
  let arc = 0;
  prof.forEach(([k, y, side], i) => {
    if (i > 0 && side && prof[i - 1][2]) arc += Math.hypot(k - prof[i - 1][0], y - prof[i - 1][1]);
    const ring = ringAt(k);
    rings.push(ring.map((p) => new THREE.Vector3(p.x, y, p.y)));
    uvs.push(ring.map((p, j) => (side ? new THREE.Vector2(per[j], arc) : new THREE.Vector2(p.x, -p.y))));
  });
  const g = skin(rings, { closed: false, capStart: true, capEnd: true, uvs });
  // 接縫：每圈頭尾重複點、底面／側面與側面／頂面交界的重複圈
  const N = outer.length, pairs: [number, number][] = [];
  for (let i = 0; i < prof.length; i++) pairs.push([i * N, i * N + N - 1]);
  for (let i = 0; i + 1 < prof.length; i++) {
    if (prof[i][2] !== prof[i + 1][2]) for (let j = 0; j < N; j++) pairs.push([i * N + j, (i + 1) * N + j]);
  }
  weldNormals(g, pairs);
  return g;
}

/** 0–1 的偽亂數（同一個 seed 每次結果相同） */
function rand(seed: number): () => number {
  let s = (Math.floor(seed * 9973) % 2147483646) + 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export interface PillowOpt {
  /** 四邊中段被填充往內拉的比例（半寬的倍數；角落不動） */
  pinch?: number;
  /** 厚度輪廓 (1 − |s|^ex)^m：中間平、往縫邊變陡；exZ 為短邊方向（z）的指數，預設同 ex（睡枕橫切面是透鏡形，用較小的值） */
  ex?: number;
  exZ?: number;
  m?: number;
  /** 縫份形成的薄唇寬（m） */
  lip?: number;
  /** 歐式方枕套的平邊寬（m） */
  flange?: number;
  /** 信封式枕套在 +x 端超出枕芯的空布長（m）：塌平、往下貼，布緣略為起伏 */
  envelope?: number;
  /** 皺褶振幅（m）：邊緣中段的縮縫、角落往中心的斜向拉紋；麻布明顯、bouclé 很淡 */
  crease?: number;
  /** 上緣（+z）中間手刀凹陷的深度（m），柔和的 V */
  chop?: number;
  /** 靠著時填充往下沉：下緣 1 + settle 倍厚、上緣 1 − settle 倍 */
  settle?: number;
  /** 上緣往前（+y）翻的距離（m） */
  roll?: number;
  /** 背面（−y，靠著椅背或床頭的那面）被壓扁的倍率，正面相應鼓一點 */
  back?: number;
  seed?: number;
  n?: number;
}

/**
 * 抱枕：w × h 的方形布套塞飽後的形狀，平放在 xz 平面、縫邊大致在 y = 0，兩面各鼓起約 t/2。
 * 依實物（充氣方形膜、羽絨抱枕型錄厚度）：中央平、往縫邊變陡，縫邊外留約 5 mm 的薄唇；
 * 四邊中段被填充往內拉（角落不動），所以四角薄成「狗耳朵」；邊緣中段布被擠出橫越縫線的縮褶，
 * 角落有往中心的斜向拉紋，整個枕頭的縫線也不在同一平面上。uv 為 (x, z) 公尺。
 * flange > 0 時沿縫邊加一圈平邊（厚 4 mm），外緣也被拉進一半，平邊略為起伏；envelope > 0 時 +x 端加信封式枕套的空布。
 */
export function pillow(w: number, h: number, t: number, o: PillowOpt = {}): THREE.BufferGeometry {
  const { pinch = 0.07, ex = 2.8, exZ = ex, m = 0.6, lip = 0.005, flange = 0, envelope = 0, crease = 0.002, chop = 0, settle = 0, roll = 0, back = 1, seed = 1, n = 64 } = o;
  const a = w / 2, b = h / 2, pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const r = rand(seed);
  // 格點：線性與 sin 各半，縫邊附近較密、中間也夠密（縮褶波長 5 cm 要有 4–5 點）
  const s = (i: number) => { const q = (2 * i) / n - 1; return 0.5 * q + 0.5 * Math.sin((q * Math.PI) / 2); };
  const lu = 1 + lip / a, lv = 1 + lip / b, LIP = 0.0015;
  const prof = (q: number, e = ex) => (1 - Math.min(1, Math.abs(q)) ** e) ** m;
  // 薄唇：縫線（|s| = 1/l）以內為 1，到最外緣收成 0
  const lipProf = (q: number, l: number) => Math.min(1, (1 - Math.abs(q)) / ((1 - 1 / l) * 0.6));
  const ph = Array.from({ length: 8 }, () => r() * Math.PI * 2);
  /** 到四邊的距離（m）、沿最近那條邊的座標與該邊長的一半 */
  const edgeOf = (u: number, v: number) => {
    const eu = a * (1 - Math.abs(u)), ev = b * (1 - Math.abs(v));
    return eu < ev ? { e: eu, along: v * b, half: b, k: u > 0 ? 0 : 1 } : { e: ev, along: u * a, half: a, k: v > 0 ? 2 : 3 };
  };
  // 邊緣中段的縮褶：橫越縫線的皺褶，兩面同相位（看起來是一道布繞過縫線），邊的中段最明顯
  const pucker = (u: number, v: number) => {
    const { along, half, k } = edgeOf(u, v), mid = Math.cos((Math.PI / 2) * Math.min(1, Math.abs(along) / half)) ** 2;
    // 波長約 4–6 cm、不完全等距
    return mid * Math.sin((along * Math.PI * 2) / (0.05 + 0.01 * Math.sin(ph[k])) + 1.2 * Math.sin(along * 23 + ph[k]) + ph[k + 4]);
  };
  // 兩面共用的位移：縫線本身的起伏與上緣往前翻，兩面相同，縫邊才不會裂開
  const common = (u: number, v: number) => {
    const { e } = edgeOf(u, v);
    return 0.003 * Math.sin(2.6 * u + ph[0]) * Math.cos(2.2 * v + ph[1]) + crease * 0.6 * pucker(u, v) * Math.exp(-e / 0.01) + roll * Math.max(0, v) ** 2;
  };
  const plan = (u: number, v: number, k: number) => [a * u * (1 - k * (1 - v * v)), b * v * (1 - k * (1 - u * u))];
  for (const side of [1, -1]) {
    const o = pos.length / 3;
    const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([cu, cv]) => ({ cu, cv, ph: r() * Math.PI * 2, amp: 0.5 + r() }));
    const fp = [r() * Math.PI * 2, r() * Math.PI * 2], half = (t / 2) * (side > 0 ? 1 + (1 - back) * 0.5 : back);
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
      const u = s(i), v = s(j);
      let [x, z] = plan(u, v, pinch);
      const flat = prof(u * lu) * prof(v * lv, exZ);
      let hy = half * flat * (1 - settle * v) + LIP * lipProf(u, lu) * lipProf(v, lv);
      // 手刀（柔和的 V）：上緣中間下降、壓痕往下約 1/3，兩個上角略翹
      if (chop > 0) {
        const kv = Math.max(0, (v - 1 / 3) / (2 / 3)) ** 2, k = Math.exp(-(((u * a) / 0.11) ** 2)) * kv;
        z += chop * (0.15 * Math.abs(u) ** 4 * kv - k);
        hy *= 1 - 0.5 * k;
      }
      const { e } = edgeOf(u, v), off = 1 - Math.exp(-e / 0.008);
      // 縮褶在面上的部分：離縫線約 1.5 cm 最明顯，6–7 cm 內消失
      let wr = 1.4 * pucker(u, v) * (e / 0.015) * Math.exp(1 - e / 0.015);
      // 角落往中心的斜向拉紋：沿對角線，離角約 7 cm 最明顯，橫越對角線起伏一兩道
      for (const c of corners) {
        const du = Math.abs(c.cu - u) * a, dv = Math.abs(c.cv - v) * b;
        const dPar = (du + dv) / Math.SQRT2, dPerp = (du - dv) / Math.SQRT2;
        wr += c.amp * (dPar / 0.07) * Math.exp(1 - dPar / 0.07) * Math.cos((dPerp * Math.PI * 2) / 0.05 + c.ph) * Math.exp(-((dPerp / 0.06) ** 2));
      }
      hy += crease * wr * off;
      // 面上的低頻起伏（填充不均）
      hy += 0.002 * flat * Math.sin(u * 2.3 + fp[0]) * Math.sin(v * 1.9 + fp[1]);
      pos.push(x, side * hy + common(u, v), z);
      uv.push(x, -z);
    }
    const V = (i: number, j: number) => o + i * (n + 1) + j;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (side > 0) idx.push(V(i, j), V(i, j + 1), V(i + 1, j), V(i + 1, j), V(i, j + 1), V(i + 1, j + 1));
      else idx.push(V(i, j), V(i + 1, j), V(i, j + 1), V(i + 1, j), V(i + 1, j + 1), V(i, j + 1));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const extra: THREE.BufferGeometry[] = [];
  if (envelope > 0) {
    // 枕套開口端：枕芯以外的空布（兩層、約 3 mm）從縫邊伸出，寬度從被拉進的縫線放回整片布寬，
    // 比枕身扁、略往下塌（反摺的內片撐著，不會整片垂下），布緣有幾道鬆鬆的波浪
    const drop = (t / 2) * back * 0.35, env = rand(seed * 7 + 3), ph1 = env() * Math.PI * 2, ph2 = env() * Math.PI * 2;
    const us = Array.from({ length: 9 }, (_, i) => (envelope * i) / 8), vs = Array.from({ length: 33 }, (_, i) => -b + (2 * b * i) / 32);
    const flap = (u: number, v: number) => {
      const k = u / envelope, vv = v / b, x0 = a * (1 - pinch * (1 - vv * vv)) - 0.003;
      const y = common(1, vv) - drop * (1 - (1 - k) ** 2) + 0.003 * k * Math.sin((v * Math.PI * 2) / 0.09 + ph1) + 0.0015 * Math.sin(v * 31 + ph2) * k;
      return new THREE.Vector3(x0 + (a + envelope - x0) * k, y, v * (1 - 0.04 * k * k));
    };
    extra.push(thickGrid(us, vs, flap, () => 0.003));
  }
  if (flange <= 0) return extra.length ? mergeGeometries([g, ...extra].map((x) => x.toNonIndexed()))! : g;
  // 平邊：外框（半個 pinch）挖掉縫線輪廓（內縮 4 mm 與枕身重疊）
  const ring = (ha: number, hb: number, k: number) => {
    const pts: THREE.Vector2[] = [], m = 24;
    const at = (u: number, v: number) => new THREE.Vector2(ha * u * (1 - k * (1 - v * v)), hb * v * (1 - k * (1 - u * u)));
    for (let i = 0; i < m; i++) pts.push(at(-1 + (2 * i) / m, -1));
    for (let i = 0; i < m; i++) pts.push(at(1, -1 + (2 * i) / m));
    for (let i = 0; i < m; i++) pts.push(at(1 - (2 * i) / m, 1));
    for (let i = 0; i < m; i++) pts.push(at(-1, 1 - (2 * i) / m));
    return pts;
  };
  const shape = new THREE.Shape(ring(a + flange, b + flange, pinch / 2));
  shape.holes.push(new THREE.Path(ring(a - 0.004, b - 0.004, pinch)));
  const frame = slab(shape, 0.004).translate(0, -0.002, 0);
  frame.deleteAttribute('uv');
  frame.deleteAttribute('normal');
  // 平邊跟著縫線起伏，外緣再自己略為翻翹
  const fp = frame.attributes.position, fuv: number[] = [], fl = ph[3];
  for (let i = 0; i < fp.count; i++) {
    const x = fp.getX(i), z = fp.getZ(i), out = Math.max(0, Math.max(Math.abs(x) - a, Math.abs(z) - b)) / flange;
    fp.setY(i, fp.getY(i) + common(x / a, z / b) + 0.005 * out * Math.sin(Math.atan2(z, x) * 3 + fl));
    fuv.push(x, -z);
  }
  frame.setAttribute('uv', new THREE.Float32BufferAttribute(fuv, 2));
  const f2 = mergeVertices(frame, 1e-5);
  f2.computeVertexNormals();
  return mergeGeometries([g, f2, ...extra].map((x) => x.toNonIndexed()))!;
}

/**
 * 披掛的布（摺好的毯子、床尾巾）：沿垂直面上的路徑 path（[水平, 高]，公尺）掃出寬 w（沿 z）、厚 th 的布條，
 * 兩側長邊是摺線（半圓）。ripple(s, z) 為沿法線的起伏（s 為路徑長度），做下垂處的波浪摺。uv 為（路徑長, z）公尺。
 */
export function drape(path: readonly [number, number][], w: number, th: number, ripple: (s: number, z: number) => number = () => 0, nz = 24): THREE.BufferGeometry {
  const r = th / 2, e = w / 2 - r, K = 4;
  // 斷面一圈：[z, 沿法線的位移]；上面從 +z 走到 −z、繞過 −z 摺線、下面走回來、繞過 +z 摺線（法線朝外）
  const sec: [number, number][] = [];
  for (let k = 0; k <= nz; k++) sec.push([e - (2 * e * k) / nz, r]);
  for (let k = 1; k < K; k++) { const a = Math.PI / 2 + (k / K) * Math.PI; sec.push([-e + r * Math.cos(a), r * Math.sin(a)]); }
  for (let k = 0; k <= nz; k++) sec.push([-e + (2 * e * k) / nz, -r]);
  for (let k = 1; k < K; k++) { const a = -Math.PI / 2 + (k / K) * Math.PI; sec.push([e + r * Math.cos(a), r * Math.sin(a)]); }
  const rings: THREE.Vector3[][] = [], uvs: THREE.Vector2[][] = [];
  let s = 0;
  path.forEach(([x, y], i) => {
    if (i > 0) s += Math.hypot(x - path[i - 1][0], y - path[i - 1][1]);
    const [x0, y0] = path[Math.max(0, i - 1)], [x1, y1] = path[Math.min(path.length - 1, i + 1)];
    const l = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / l, ny = (x1 - x0) / l;
    rings.push(sec.map(([z, o]) => {
      const off = ripple(s, z) + o;
      return new THREE.Vector3(x + nx * off, y + ny * off, z);
    }));
    uvs.push(sec.map(([z]) => new THREE.Vector2(s, z)));
  });
  return skin(rings, { capStart: true, capEnd: true, uvs });
}

/**
 * 有厚度的布面（被子、床罩）：us × vs 的格點（公尺，也當 uv），f(u, v) 給外表面的點，t(u, v) 為厚度。
 * 內表面 = 外表面 − 法線 × t，四周補一圈布邊。f 要讓 u 往 +x、v 往 +z 時外表面朝上（法線 = ∂v × ∂u）。
 */
export function thickGrid(us: readonly number[], vs: readonly number[], f: (u: number, v: number) => THREE.Vector3,
  t: (u: number, v: number) => number): THREE.BufferGeometry {
  const nu = us.length, nv = vs.length, I = (i: number, j: number) => i * nv + j;
  const P = us.flatMap((u) => vs.map((v) => f(u, v)));
  // 外表面法線：先用暫時的格網算
  const tri: number[] = [];
  for (let i = 0; i + 1 < nu; i++) for (let j = 0; j + 1 < nv; j++)
    tri.push(I(i, j), I(i, j + 1), I(i + 1, j), I(i + 1, j), I(i, j + 1), I(i + 1, j + 1));
  const tmp = new THREE.BufferGeometry().setFromPoints(P);
  tmp.setIndex(tri);
  tmp.computeVertexNormals();
  const N = tmp.attributes.normal as THREE.BufferAttribute, n = new THREE.Vector3();
  const Q = P.map((p, k) => p.clone().addScaledVector(n.fromBufferAttribute(N, k), -t(us[Math.floor(k / nv)], vs[k % nv])));

  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const put = (p: THREE.Vector3, u: number, v: number) => { pos.push(p.x, p.y, p.z); uv.push(u, v); return pos.length / 3 - 1; };
  const outer = P.map((p, k) => put(p, us[Math.floor(k / nv)], vs[k % nv]));
  const inner = Q.map((p, k) => put(p, us[Math.floor(k / nv)], vs[k % nv]));
  for (let i = 0; i + 1 < nu; i++) for (let j = 0; j + 1 < nv; j++) {
    const a = I(i, j), b = I(i, j + 1), c = I(i + 1, j), d = I(i + 1, j + 1);
    idx.push(outer[a], outer[b], outer[c], outer[c], outer[b], outer[d]);
    idx.push(inner[a], inner[c], inner[b], inner[c], inner[d], inner[b]);
  }
  // 布邊：沿外框一圈（j = 0 列 → i = 末行 → j = 末列 → i = 0 行）
  // 每段記下朝外的 uv 方向：布邊內側的 uv 往外移一個厚度，貼圖才不會被拉成條紋
  const loop: number[] = [], side: [number, number][] = [];
  for (let i = 0; i < nu - 1; i++) { loop.push(I(i, 0)); side.push([0, -1]); }
  for (let j = 0; j < nv - 1; j++) { loop.push(I(nu - 1, j)); side.push([1, 0]); }
  for (let i = nu - 1; i > 0; i--) { loop.push(I(i, nv - 1)); side.push([0, 1]); }
  for (let j = nv - 1; j > 0; j--) { loop.push(I(0, j)); side.push([-1, 0]); }
  // 第一段的朝外方向是 −v，用它決定布邊的繞向
  const out0 = P[I(0, 0)].clone().sub(P[I(0, 1)]);
  const e0 = P[loop[1]].clone().sub(P[loop[0]]), e1 = Q[loop[0]].clone().sub(P[loop[0]]);
  const flip = e0.cross(e1).dot(out0) < 0;
  for (let k = 0; k < loop.length; k++) {
    const a = loop[k], b = loop[(k + 1) % loop.length];
    const ua = us[Math.floor(a / nv)], va = vs[a % nv], ub = us[Math.floor(b / nv)], vb = vs[b % nv];
    const [sx, sy] = side[k], ta = Q[a].distanceTo(P[a]), tb = Q[b].distanceTo(P[b]);
    const pa = put(P[a], ua, va), pb = put(P[b], ub, vb), qa = put(Q[a], ua + sx * ta, va + sy * ta), qb = put(Q[b], ub + sx * tb, vb + sy * tb);
    if (flip) idx.push(pa, qa, pb, pb, qa, qb);
    else idx.push(pa, pb, qa, pb, qb, qa);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 由 a 到 b 的取樣點，兩端（或指定的位置）加密：基本間距 step，在 dense 附近 ±w 範圍內改用 fine */
export function samples(a: number, b: number, step: number, dense: readonly number[] = [], w = 0.12, fine = 0.015): number[] {
  const out = [a];
  let x = a;
  while (x < b - 1e-6) {
    const near = dense.some((d) => Math.abs(x - d) < w);
    x = Math.min(b, x + (near ? fine : step));
    out.push(x);
  }
  return out;
}

/** 多邊形每個角倒圓（半徑 r，凹角也可），回傳 Shape；點為 (x, z) */
export function roundedPolygon(pts: readonly [number, number][], r: number, seg = 6): THREE.Shape {
  const out: THREE.Vector2[] = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = new THREE.Vector2(...pts[i]), a = new THREE.Vector2(...pts[(i + n - 1) % n]).sub(p).normalize(),
      c = new THREE.Vector2(...pts[(i + 1) % n]).sub(p).normalize();
    const half = Math.acos(THREE.MathUtils.clamp(a.dot(c), -1, 1)) / 2, dist = r / Math.tan(half);
    const p0 = p.clone().addScaledVector(a, dist), p1 = p.clone().addScaledVector(c, dist);
    const bis = a.clone().add(c).normalize(), cen = p.clone().addScaledVector(bis, r / Math.sin(half));
    const t0 = Math.atan2(p0.y - cen.y, p0.x - cen.x);
    let t1 = Math.atan2(p1.y - cen.y, p1.x - cen.x), dt = t1 - t0;
    if (dt > Math.PI) dt -= 2 * Math.PI;
    if (dt < -Math.PI) dt += 2 * Math.PI;
    t1 = t0 + dt;
    for (let k = 0; k <= seg; k++) {
      const t = t0 + ((t1 - t0) * k) / seg;
      out.push(new THREE.Vector2(cen.x + r * Math.cos(t), cen.y + r * Math.sin(t)));
    }
  }
  return new THREE.Shape(out);
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
