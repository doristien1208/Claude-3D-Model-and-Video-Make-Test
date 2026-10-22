import { CEILING_H as H } from '../data/layout';
import type { ItemOf } from '../data/query';
import { rng, type Build } from './prims';

/** 門片分割線位置（沿長邊等分，取整到 px） */
function seamsAt(s: number, e: number, n: number): number[] {
  const out: number[] = [];
  for (let k = 1; k < n; k++) out.push(Math.floor(s + (k * (e - s)) / n));
  return out;
}

export function slatWall(b: Build, it: ItemOf<'slatWall'>): void {
  b.box(it.rect, 0, H, b.mat.slat);
  if (it.led) b.glowBox(it.led.rect[0], it.led.rect[1], it.led.rect[2], it.led.rect[3], it.led.h[0], it.led.h[1]);
}

export function headboardPanel(b: Build, it: ItemOf<'headboardPanel'>): void {
  b.box(it.rect, it.h[0], it.h[1], b.mat.headboard);
}

/** 開放書櫃：背板、側板、層板，層板間隨機排書 */
export function shelf(b: Build, it: ItemOf<'shelf'>): void {
  const { mat, books } = b;
  const [x1, y1, x2, y2] = it.rect, h = it.h, n = it.shelves, back = it.back;
  const r = rng(it.seed || 11), along = back === 'E' || back === 'W', T = 2;
  const L0 = along ? y1 : x1, L1 = along ? y2 : x2, D0 = along ? x1 : y1, D1 = along ? x2 : y2;
  const P = (l0: number, l1: number, d0: number, d1: number, h0: number, h1: number, m: typeof mat.walnut) =>
    along ? b.bx(d0, l0, d1, l1, h0, h1, m) : b.bx(l0, d0, l1, d1, h0, h1, m);
  const backAtMin = back === 'W' || back === 'N';
  P(L0, L1, backAtMin ? D0 : D1 - T, backAtMin ? D0 + T : D1, 0, h, mat.walnutDark);
  P(L0, L0 + T, D0, D1, 0, h, mat.walnut);
  P(L1 - T, L1, D0, D1, 0, h, mat.walnut);
  for (let i = 0; i <= n; i++) {
    const y = (i * (h - 0.03)) / n;
    P(L0, L1, D0, D1, y, y + 0.03, mat.walnut);
    if (i < n) {
      let l = L0 + T + 1;
      const top = ((i + 1) * (h - 0.03)) / n;
      while (l < L1 - T - 6) {
        const w = 1.6 + r() * 3.2, hh = Math.min(0.18 + r() * 0.14, top - y - 0.06);
        if (r() < 0.18) { l += 6 + r() * 10; continue; }
        P(l, Math.min(l + w, L1 - T - 1), D0 + 3, D1 - 3, y + 0.03, y + 0.03 + hh, books[(r() * books.length) | 0]);
        l += w + 0.2;
      }
    }
  }
  b.solid(it.rect);
}

/** 一般櫃體；有 doors 時在 front 面畫門片分割線（外凸 1 px） */
export function cabinet(b: Build, it: ItemOf<'cabinet'>): void {
  const { mat } = b;
  const [x1, y1, x2, y2] = it.rect;
  b.box(it.rect, it.h[0], it.h[1], mat.walnut, { solid: true });
  if (!it.doors || !it.front || !it.seamH) return;
  const [s0, s1] = it.seamH, inn = it.seamIn ?? 0, o = { cast: false };
  switch (it.front) {
    case 'W': for (const p of seamsAt(y1, y2, it.doors)) b.bx(x1 - 1, p - 0.4, x1 + inn, p + 0.4, s0, s1, mat.black, o); break;
    case 'E': for (const p of seamsAt(y1, y2, it.doors)) b.bx(x2 - inn, p - 0.4, x2 + 1, p + 0.4, s0, s1, mat.black, o); break;
    case 'N': for (const p of seamsAt(x1, x2, it.doors)) b.bx(p - 0.4, y1 - 1, p + 0.4, y1 + inn, s0, s1, mat.black, o); break;
    case 'S': for (const p of seamsAt(x1, x2, it.doors)) b.bx(p - 0.4, y2 - inn, p + 0.4, y2 + 1, s0, s1, mat.black, o); break;
  }
}

/** 一字型廚房檯面（靠北牆、櫃門朝南）：踢腳、下櫃、檯面、水槽、龍頭、爐台、抽油煙機 */
export function kitchenRun(b: Build, it: ItemOf<'kitchenRun'>): void {
  const { mat } = b;
  const [x1, y1, x2, y2] = it.rect;
  b.bx(x1 + 2, y1, x2 - 2, y2 - 6, 0, 0.1, mat.black, { cast: false });
  b.box(it.rect, 0.1, 0.86, mat.walnut, { solid: true });
  for (const p of seamsAt(x1, x2, it.doors)) b.bx(p - 0.4, y2 - 1, p + 0.4, y2 + 0.5, 0.12, 0.84, mat.black, { cast: false });
  b.bx(x1 - 3, y1, x2 + 3, y2 + 2, 0.86, 0.9, mat.stone);
  // 水槽與龍頭
  b.box(it.sink, 0.895, 0.905, mat.sinkMetal, { cast: false });
  const fx = (it.sink[0] + it.sink[2]) / 2;
  b.bx(fx - 3, y1 + 1, fx + 3, it.sink[1], 0.9, 1.18, mat.blackSatin);
  b.bx(fx - 3, y1 + 1, fx + 3, y1 + 21, 1.15, 1.18, mat.blackSatin);
  // 爐台與抽油煙機
  b.box(it.hob, 0.9, 0.906, mat.tv, { cast: false });
  const [hx1, , hx2, hy2] = it.hood;
  b.box(it.hood, it.hoodH0, H, mat.black);
  b.glowBox(hx1 + 2, hy2 - 15, hx2 - 2, hy2 - 1, it.hoodH0 - 0.01, it.hoodH0, mat.glowSoft);
}

/** 中島：rect 為檯面外框 */
export function island(b: Build, it: ItemOf<'island'>): void {
  const { mat } = b;
  const [x1, y1, x2, y2] = it.rect;
  b.bx(x1 + 7, y1 + 7, x2 - 7, y2 - 7, 0.1, 0.86, mat.walnut, { solid: true });
  b.bx(x1 + 11, y1 + 11, x2 - 11, y2 - 11, 0, 0.1, mat.black, { cast: false });
  b.box(it.rect, 0.86, 0.92, mat.stoneWarm);
}

/** 懸浮電視櫃，底部間接光 */
export function tvCabinet(b: Build, it: ItemOf<'tvCabinet'>): void {
  const { mat } = b;
  const [x1, y1, x2, y2] = it.rect, [h0, h1] = it.h;
  b.box(it.rect, h0, h1, mat.walnutDark, { solid: true });
  b.glowBox(x1 + 4, y1 + 2, x2 - 2, y2 - 2, h0 - 0.005, h0, mat.glowSoft);
}

/** 玄關系統鞋櫃（背靠北側）：下櫃、中段開放層格＋燈條、上櫃 */
export function shoeCabinet(b: Build, it: ItemOf<'shoeCabinet'>): void {
  const { mat } = b;
  const [x1, y1, x2, y2] = it.rect, [n0, n1] = it.niche;
  b.box(it.rect, 0.1, n0, mat.walnut, { solid: true });
  b.box(it.rect, n1, it.top, mat.walnut);
  b.bx(x1, y1, x2, y1 + 3.5, n0, n1, mat.walnutDark);
  b.glowBox(x1 + 2, y1 + 3.5, x2 - 2, y1 + 7.5, n1 - 0.02, n1);
  b.bx(x1 + 2, y1 + 3.5, x2 - 2, y2, 0, 0.1, mat.black, { cast: false });
}

export function wallShelf(b: Build, it: ItemOf<'wallShelf'>): void {
  for (const lv of it.levels) b.box(it.rect, lv, lv + 0.02, b.mat.walnutDark);
}
