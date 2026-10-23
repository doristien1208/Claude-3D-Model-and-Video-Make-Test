import * as THREE from 'three';
import { lathe } from './prims';
import type { Build } from './prims';

/*
 * 書櫃陳列（樣品屋陳列師的做法）：每一格直立 5–9 本一組、高度漸變，或 3–5 本橫放一疊（上面放小物），
 * 再配陶瓷小物（整座約 5–7 件）；直立約 7 成、橫疊約 3 成，奇數層先放橫疊（之字形）；每格留約 1/3 空著。書：一般 15 × 21、17 × 24、大開本 21 × 28、25 × 25、28 × 28，厚 1.5–4.5 cm。
 * 每本書由兩片封面板、書背與內頁（米白、比封面縮 3 mm）組成；同一座書櫃的封面、內頁各用一個 InstancedMesh（封面以實例顏色上色）。
 */

/** 書背顏色（陳列師常用：象牙、沙色、燕麥、灰褐、炭灰，加一兩本鏽紅、灰綠；同一組取相近的 2–3 色） */
const SPINES = [0xede7da, 0xcdbfa8, 0xbfb2a0, 0x8e8070, 0x3a3a38, 0x9a5a3c, 0x8f9a80];
const GROUPS = [[0, 1, 2], [2, 3, 4], [0, 2, 6], [1, 3, 5], [0, 4], [1, 2, 3]];
/** 書的尺寸（寬 = 書深方向、高） */
const SIZES: [number, number][] = [[0.15, 0.21], [0.17, 0.24], [0.21, 0.28], [0.25, 0.25], [0.28, 0.28], [0.19, 0.26]];

export interface Bay {
  /** 本地 x 範圍（公尺） */
  x0: number;
  x1: number;
}

interface Book { m: THREE.Matrix4; t: number; h: number; d: number; color: number }

/**
 * 在一座書櫃的群組裡擺書：bays 為各格的本地 x 範圍，levels 為每層 [放置面高, 上方淨高]，
 * depth 為層板深（本地 z 從背板 0 到前緣 depth）。
 */
export function fillShelf(b: Build, g: THREE.Object3D, bays: readonly Bay[], levels: readonly [number, number][], depth: number, r: () => number): void {
  const list: Book[] = [];
  const front = depth - 0.025;
  const pick = <T,>(a: readonly T[]) => a[(r() * a.length) | 0];
  const upright = (x: number, y: number, clear: number, n: number, palette: number[], desc: boolean): number => {
    const fit = SIZES.filter(([, h]) => h < clear - 0.03);
    if (!fit.length) return x;
    let [w, h] = pick(fit);
    for (let i = 0; i < n; i++) {
      const t = 0.015 + r() * 0.03, d = Math.min(w, depth - 0.04);
      const m = new THREE.Matrix4().makeTranslation(x + t / 2, y, front - d / 2);
      list.push({ m, t, h, d, color: SPINES[pick(palette)] });
      x += t + 0.001;
      // 高度漸變：每本差 0–1.5 cm
      h = THREE.MathUtils.clamp(h + (desc ? -1 : 1) * r() * 0.015, 0.18, clear - 0.03);
      w = THREE.MathUtils.clamp(w + (r() - 0.5) * 0.01, 0.14, 0.3);
    }
    return x;
  };
  const stack = (x: number, y: number, n: number, palette: number[]): [number, number, number] => {
    const [w0, h0] = pick(SIZES.filter(([w]) => w < depth - 0.03));
    let top = y;
    for (let i = 0; i < n; i++) {
      const t = 0.02 + r() * 0.02, w = Math.min(w0 + (r() - 0.6) * 0.02, depth - 0.03), h = h0 + (r() - 0.6) * 0.02;
      // 平放：書高沿 x、厚度朝上，書背仍朝前；每本微微錯開、轉一點
      const m = new THREE.Matrix4().makeTranslation(x + h0 / 2 + (r() - 0.5) * 0.01, top + t / 2, front - w / 2 + (r() - 0.5) * 0.01)
        .multiply(new THREE.Matrix4().makeRotationY((r() - 0.5) * 0.08))
        .multiply(new THREE.Matrix4().makeRotationZ(-Math.PI / 2))
        .multiply(new THREE.Matrix4().makeTranslation(0, -h / 2, 0));
      list.push({ m, t, h, d: w, color: SPINES[pick(palette)] });
      top += t;
    }
    return [x + h0, top, w0];
  };

  levels.forEach(([y, clear], li) => {
    for (const bay of bays) {
      const W = bay.x1 - bay.x0, limit = bay.x0 + W * (0.62 + r() * 0.08);
      let x = bay.x0 + 0.01;
      let usedStack = false, usedObj = false, first = true;
      while (x < limit) {
        // 層與層交錯：奇數層先放橫疊（之字形）
        const k = first && li % 2 ? 0.7 : r(), palette = pick(GROUPS);
        first = false;
        if (k < 0.7 || (usedStack && usedObj)) {
          x = upright(x, y, clear, 5 + ((r() * 5) | 0), palette, r() < 0.5) + 0.04 + r() * 0.05;
        } else if (!usedStack && clear > 0.16) {
          usedStack = true;
          const [nx, top, w] = stack(x, y, 3 + ((r() * 3) | 0), palette);
          if (r() < 0.45 && clear - (top - y) > 0.1) ornament(b, g, x + (nx - x) / 2, top, front - w / 2, Math.min(0.12, clear - (top - y) - 0.03), r);
          x = nx + 0.05 + r() * 0.04;
        } else if (!usedObj) {
          // 小物不要每格都有（整座書櫃約 5–7 件）
          usedObj = true;
          if (r() < 0.4) {
            ornament(b, g, x + 0.06, y, front - 0.1, Math.min(0.22, clear - 0.04), r);
            x += 0.16 + r() * 0.06;
          }
        }
      }
    }
  });

  // 封面板 ×2、書背、內頁
  const box = new THREE.BoxGeometry(1, 1, 1);
  const covers = new THREE.InstancedMesh(box, b.mat.bookCover, list.length * 3), pages = new THREE.InstancedMesh(box, b.mat.paper, list.length);
  const part = (bk: Book, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number) =>
    bk.m.clone().multiply(new THREE.Matrix4().makeTranslation(cx, cy, cz)).multiply(new THREE.Matrix4().makeScale(sx, sy, sz));
  const col = new THREE.Color();
  list.forEach((bk, i) => {
    const { t, h, d } = bk, B = 0.002;
    col.setHex(bk.color);
    covers.setMatrixAt(3 * i, part(bk, -t / 2 + B / 2, h / 2, 0, B, h, d));
    covers.setMatrixAt(3 * i + 1, part(bk, t / 2 - B / 2, h / 2, 0, B, h, d));
    covers.setMatrixAt(3 * i + 2, part(bk, 0, h / 2, d / 2 - 0.0015, t, h, 0.003));
    for (let k = 0; k < 3; k++) covers.setColorAt(3 * i + k, col);
    pages.setMatrixAt(i, part(bk, 0, h / 2, -0.0015, t - 2 * B, h - 0.006, d - 0.006));
  });
  for (const m of [covers, pages]) {
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
}

/** 陶瓷小物：小花瓶、矮碗或圓球（底部中心 (x, y, z)，最高 maxH） */
function ornament(b: Build, g: THREE.Object3D, x: number, y: number, z: number, maxH: number, r: () => number): void {
  if (maxH < 0.05) return;
  const { mat } = b, k = r(), m = [mat.potWhite, mat.ceramicBeige, mat.pot][(r() * 3) | 0];
  let geo: THREE.BufferGeometry;
  if (k < 0.45) {
    const h = Math.min(maxH, 0.12 + r() * 0.08), w = 0.04 + r() * 0.025;
    geo = lathe([[0.001, 0], [w * 0.8, 0], [w, h * 0.35], [w * 0.85, h * 0.7], [w * 0.45, h * 0.9], [w * 0.5, h], [w * 0.42, h], [w * 0.38, h * 0.92]], 32);
  } else if (k < 0.8) {
    const w = 0.06 + r() * 0.03, h = Math.min(maxH, 0.05);
    geo = lathe([[0.001, 0], [w * 0.55, 0], [w, h], [w - 0.004, h], [w * 0.5, 0.006], [0.001, 0.006]], 32);
  } else {
    const rr = Math.min(maxH / 2, 0.04 + r() * 0.02);
    geo = new THREE.SphereGeometry(rr, 24, 16).translate(0, rr, 0);
  }
  const me = new THREE.Mesh(geo, m);
  me.position.set(x, y, z);
  me.castShadow = me.receiveShadow = true;
  g.add(me);
}
