import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { X, Z } from '../core/units';
import type { ItemOf } from '../data/query';
import { FACING_YAW, add, gbox, type Build } from './prims';
import { skin } from './shapes';
import { DESK_TOP } from './study';

/*
 * 書桌上的電腦（2026-10 依 Apple 規格頁與官方正投影圖量測重做；公尺）：
 *  Studio Display 27 吋（傾斜支架）：總高 47.85、寬 62.27、深 16.8；本體 36.23 高、1.9 厚（背面與側面全平），
 *    平面圓角 0.5；可視區 59.65 × 33.56，四周黑邊約 1.31–1.33（沒有下巴），玻璃蓋滿正面；鏡頭在上緣下 0.53。
 *    背面：四個直立 USB-C 孔（離下緣 2.74、間距 1.5）、中央圓形電源插頭與黑色編織線。
 *    支架：寬 15.2、7 mm 鋁板；腳長 16.8（玻璃前 5.6、背面後 9.2），手臂後仰約 11–13°，
 *    上端繞過離桌 20.7 的 Ø2.05 鉸鏈管；手臂中段開 4.15 × 6 的走線孔（離桌 10.7–16.7）。0° 時本體下緣離桌 11.62，往後仰 5°。
 *  Magic Keyboard（Touch ID、精簡配列、台灣注音）：27.89 × 11.49，前 0.41 → 後 1.09 的楔形；鍵距 19.0 × 18.5 mm，
 *    鍵帽 16.9 × 16.3（寬 = 18.98u − 2），鋁邊僅 2.7–3.2 mm；功能列全高、esc 1.5u、↑↓ 共用一格，四個角落鍵外角 R6。
 *  Magic Mouse：11.35 × 5.71 × 2.16，兩端對稱，最高點在正中；白色亮面上殼、銀色鋁底座（中間最高 1.29、往兩端收），
 *    底下只有兩條黑色滑軌著地，兩端離桌約 0.3–0.5。
 * 不做品牌標誌。
 */

const DEG = Math.PI / 180;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** 圓角矩形（各角半徑可不同：x0y0、x1y0、x1y1、x0y1），逆時針 */
function rrect(x0: number, y0: number, x1: number, y1: number, r: number | readonly number[], seg = 5): THREE.Shape {
  const [r0, r1, r2, r3] = typeof r === 'number' ? [r, r, r, r] : r;
  const pts: THREE.Vector2[] = [];
  const arc = (cx: number, cy: number, rr: number, a0: number) => {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push(new THREE.Vector2(cx + rr * Math.cos(a), cy + rr * Math.sin(a)));
    }
  };
  arc(x0 + r0, y0 + r0, r0, Math.PI);
  arc(x1 - r1, y0 + r1, r1, 1.5 * Math.PI);
  arc(x1 - r2, y1 - r2, r2, 0);
  arc(x0 + r3, y1 - r3, r3, 0.5 * Math.PI);
  return new THREE.Shape(pts);
}

/** 平面形狀 (x, y) 往 +z 擠出 depth（0 到 depth），邊緣倒圓 bevel；合併頂點讓倒角光影連續 */
function extrude(shape: THREE.Shape, depth: number, bevel = 0, keepUV = false): THREE.BufferGeometry {
  const b = Math.min(bevel, depth / 2 - 1e-5);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * b, curveSegments: 4, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 2,
  });
  g.translate(0, 0, b);
  g.deleteAttribute('normal');
  if (!keepUV) g.deleteAttribute('uv');
  const m = mergeVertices(g, 1e-6);
  m.computeVertexNormals();
  return m;
}

/** 水平板：平面 (x, z) 的形狀往上長 t（y 0 到 t） */
const hplate = (shape: THREE.Shape, t: number, bevel = 0, keepUV = false) =>
  extrude(shape, t, bevel, keepUV).rotateX(Math.PI / 2).translate(0, t, 0);

/* ---------------- Studio Display ---------------- */

const SD = {
  W: 0.6227, H: 0.3623, T: 0.019, R: 0.005, activeW: 0.5965, activeH: 0.3356, bottom: 0.1162, cam: 0.0053,
  standW: 0.152, plate: 0.007, footFront: 0.056, footRear: 0.092, joint: 0.028, hingeY: 0.207, hingeBack: 0.0115, barrelR: 0.01025,
};
const TILT = 5 * DEG;

/**
 * 桌上螢幕＋鍵盤滑鼠：at 為螢幕本體中心（平面），facing 為螢幕朝向（使用者方向）。
 * 本地座標：x 沿螢幕寬（使用者的右手邊為 +x）、z 朝使用者。
 */
export function monitor(b: Build, it: ItemOf<'monitor'>): void {
  const g = new THREE.Group();
  g.position.set(X(it.at[0]), DESK_TOP, Z(it.at[1]));
  g.rotation.y = FACING_YAW[it.facing];
  b.root.add(g);
  display(b, g);
  keyboard(b, g, 0, 0.3);
  mouse(b, g, 0.228, 0.31, -6 * DEG);
}

function display(b: Build, g: THREE.Group): void {
  const { mat } = b;
  const hz = -SD.T / 2 - SD.hingeBack;          // 鉸鏈軸（本地 z）
  // 本體繞鉸鏈軸後仰：鉸鏈群組的原點就是軸心
  const hinge = new THREE.Group();
  hinge.position.set(0, SD.hingeY, hz);
  hinge.rotation.x = -TILT;
  g.add(hinge);
  const yb = SD.bottom - SD.hingeY, yt = yb + SD.H, yc = (yb + yt) / 2, zBack = -hz - SD.T / 2, zFront = -hz + SD.T / 2;
  // 鋁殼（背面與側面全平）＋正面整片玻璃（側面看到 1 mm 黑線）
  const body = rrect(-SD.W / 2, yb, SD.W / 2, yt, SD.R);
  add(hinge, extrude(body, SD.T - 0.001, 0.0008), mat.aluminium, 0, 0, zBack);
  add(hinge, extrude(body, 0.001, 0.0003), mat.tv, 0, 0, zFront - 0.001);
  // 畫面（發光）與上面的玻璃反射層
  const scr = add(hinge, new THREE.PlaneGeometry(SD.activeW, SD.activeH), mat.screen, 0, yc, zFront + 0.0002, false);
  scr.receiveShadow = false;
  add(hinge, new THREE.PlaneGeometry(SD.activeW, SD.activeH), mat.glass, 0, yc, zFront + 0.0004, false);
  // 鏡頭：深灰圈 Ø3.3、鏡片 Ø1.3
  add(hinge, new THREE.CircleGeometry(0.00165, 24), mat.tvBody, 0, yt - SD.cam, zFront + 0.0002, false);
  add(hinge, new THREE.CircleGeometry(0.00065, 16), mat.tv, 0, yt - SD.cam, zFront + 0.0003, false);
  // 背面：四個直立 USB-C 孔（正面看在右下，離右緣 9.4–13.9）、中央電源插頭
  for (const d of [0.094, 0.109, 0.124, 0.139]) gbox(hinge, 0.0026, 0.0084, 0.001, SD.W / 2 - d, yb + 0.0274, zBack - 0.0003, mat.gap, 0, false);
  add(hinge, new THREE.CylinderGeometry(0.015, 0.015, 0.008, 32).rotateX(Math.PI / 2), mat.black, 0, yc, zBack - 0.004);
  hinge.updateMatrix();
  const plug = V(0, yc, zBack - 0.008).applyMatrix4(hinge.matrix);

  /* 支架：腳、手臂（開走線孔）、繞過鉸鏈管的彎頭、鉸鏈管 */
  const hw = SD.standW / 2, footZ0 = -SD.T / 2 - SD.footRear, footZ1 = SD.T / 2 + SD.footFront;
  add(g, hplate(rrect(-hw, footZ0, hw, footZ1, 0.004), 0.006, 0.0008), mat.aluminium, 0, 0.0012, 0);
  for (const s of [-1, 1]) gbox(g, 0.014, 0.0012, footZ1 - footZ0 - 0.004, s * (hw - 0.008), 0.0006, (footZ0 + footZ1) / 2, mat.black, 0, false);
  // 手臂中心線：從腳上（離後端 2.8）往上，與鉸鏈管相切，板的內面貼著管子
  const B = new THREE.Vector2(footZ0 + SD.joint, 0.0072), H = new THREE.Vector2(hz, SD.hingeY), rc = SD.barrelR + SD.plate / 2;
  const BH = H.clone().sub(B), lBH = BH.length();
  const θ = Math.atan2(BH.x, BH.y) - Math.asin(rc / lBH), vEnd = Math.sqrt(lBH * lBH - rc * rc);
  const armShape = rrect(-hw, -0.004, hw, vEnd, 0.001, 2);
  const [s0, s1] = [(0.107 - B.y) / Math.cos(θ), (0.167 - B.y) / Math.cos(θ)];
  armShape.holes.push(new THREE.Path(rrect(-0.02075, s0, 0.02075, s1, 0.018, 6).getPoints()));
  // 板的長邊（形狀的 y）往 +z（螢幕那側）仰 θ，厚度方向朝前
  add(g, extrude(armShape, SD.plate, 0.0008).translate(0, 0, -SD.plate / 2).rotateX(θ), mat.aluminium, 0, B.y, B.x);
  // 彎頭：圓心在鉸鏈軸、內半徑 = 管半徑，從手臂末端繞過頂端到前上方約 70°
  const a0 = Math.PI - θ, a1 = 70 * DEG, ri = SD.barrelR, ro = SD.barrelR + SD.plate, wrap: THREE.Vector2[] = [];
  for (let i = 0; i <= 16; i++) { const a = a0 + ((a1 - a0) * i) / 16; wrap.push(new THREE.Vector2(-ro * Math.cos(a), ro * Math.sin(a))); }
  for (let i = 16; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / 16; wrap.push(new THREE.Vector2(-ri * Math.cos(a), ri * Math.sin(a))); }
  add(g, extrude(new THREE.Shape(wrap), SD.standW, 0.0006).rotateY(Math.PI / 2).translate(-hw, 0, 0), mat.aluminium, 0, H.y, H.x);
  add(g, new THREE.CylinderGeometry(SD.barrelR, SD.barrelR, SD.standW + 0.002, 40).rotateZ(Math.PI / 2), mat.aluminium, 0, H.y, H.x);
  for (const s of [-1, 1]) add(g, new THREE.CylinderGeometry(SD.barrelR * 0.8, SD.barrelR * 0.8, 0.0012, 40).rotateZ(Math.PI / 2), mat.chrome, s * (hw + 0.0016), H.y, H.x);

  // 電源線（黑色編織）：從插頭往後、越過手臂頂端，貼著手臂背面往下落到腳上，再從腳後端落到桌面、往後垂到桌後
  const behind = (y: number) => B.x + (y - B.y) * Math.tan(θ) - SD.plate / 2 / Math.cos(θ) - 0.0045;
  const deskBack = -0.195;
  const cord = new THREE.CatmullRomCurve3([
    plug, plug.clone().add(V(0, -0.004, -0.014)), V(0, 0.262, behind(0.262) - 0.004), V(0, 0.2, behind(0.2)), V(0, 0.12, behind(0.12)),
    V(0.001, 0.05, behind(0.05)), V(0.002, 0.0105, footZ0 + 0.014), V(0.006, 0.008, footZ0 - 0.004), V(0.012, 0.0035, footZ0 - 0.02),
    V(0.022, 0.0035, -0.16), V(0.03, 0.0035, deskBack + 0.006), V(0.034, -0.015, deskBack - 0.004), V(0.036, -0.09, deskBack - 0.006),
  ]);
  add(g, new THREE.TubeGeometry(cord, 96, 0.0028, 8), mat.black);
}

/* ---------------- Magic Keyboard ---------------- */

const KB = { W: 0.2789, D: 0.1149, h0: 0.0041, h1: 0.0109, R: 0.009, pitchX: 0.01898, pitchY: 0.01853, left: 0.0028, back: 0.0032, keyD: 0.0163, gap: 0.002 };

/** 一顆鍵：x、y 為左上角（mm，從鍵盤左緣、後緣量），w、h 為 mm；legend 為字樣 */
interface Key { x: number; y: number; w: number; h: number; k: KeyLegend; corner?: 0 | 1 | 2 | 3 }
type KeyLegend = { t: 'letter'; c: string; z: string } | { t: 'num'; c: string; s: string; z?: string } | { t: 'word'; c: string; at: 'bl' | 'br' | 'c'; top?: string }
  | { t: 'fn'; n: number } | { t: 'icon'; c: 'globe' | 'touch' | 'left' | 'right' | 'up' | 'down' };

const ZHUYIN: Record<string, string> = {
  1: 'ㄅ', Q: 'ㄆ', A: 'ㄇ', Z: 'ㄈ', 2: 'ㄉ', W: 'ㄊ', S: 'ㄋ', X: 'ㄌ', 3: 'ˇ', E: 'ㄍ', D: 'ㄎ', C: 'ㄏ', 4: 'ˋ', R: 'ㄐ', F: 'ㄑ', V: 'ㄒ',
  5: 'ㄓ', T: 'ㄔ', G: 'ㄕ', B: 'ㄖ', 6: 'ˊ', Y: 'ㄗ', H: 'ㄘ', N: 'ㄙ', 7: '˙', U: 'ㄧ', J: 'ㄨ', M: 'ㄩ', 8: 'ㄚ', I: 'ㄛ', K: 'ㄜ', ',': 'ㄝ',
  9: 'ㄞ', O: 'ㄟ', L: 'ㄠ', '.': 'ㄡ', 0: 'ㄢ', P: 'ㄣ', ';': 'ㄤ', '/': 'ㄥ', '-': 'ㄦ',
};

/** Magic Keyboard（Touch ID、精簡配列）每列的鍵：[字樣, 寬（u）]；每列共 14.5u */
function keyLayout(): Key[] {
  const L = (c: string): KeyLegend => ({ t: 'letter', c, z: ZHUYIN[c] ?? '' });
  const N = (c: string, s: string): KeyLegend => ({ t: 'num', c, s, z: ZHUYIN[c] });
  const rows: [KeyLegend, number][][] = [
    [[{ t: 'word', c: 'esc', at: 'bl' }, 1.5], ...Array.from({ length: 12 }, (_, i): [KeyLegend, number] => [{ t: 'fn', n: i + 1 }, 1]), [{ t: 'icon', c: 'touch' }, 1]],
    [[N('`', '~'), 1], [N('1', '!'), 1], [N('2', '@'), 1], [N('3', '#'), 1], [N('4', '$'), 1], [N('5', '%'), 1], [N('6', '^'), 1], [N('7', '&'), 1],
      [N('8', '*'), 1], [N('9', '('), 1], [N('0', ')'), 1], [N('-', '_'), 1], [N('=', '+'), 1], [{ t: 'word', c: '⌫', at: 'br' }, 1.5]],
    [[{ t: 'word', c: '⇥', at: 'bl' }, 1.5], ...'QWERTYUIOP'.split('').map((c): [KeyLegend, number] => [L(c), 1]), [N('[', '{'), 1], [N(']', '}'), 1], [N('\\', '|'), 1]],
    [[{ t: 'word', c: '中/英', at: 'bl' }, 1.75], ...'ASDFGHJKL'.split('').map((c): [KeyLegend, number] => [L(c), 1]), [N(';', ':'), 1], [N("'", '"'), 1],
      [{ t: 'word', c: '↩', at: 'br' }, 1.75]],
    [[{ t: 'word', c: '⇧', at: 'bl' }, 2.25], ...'ZXCVBNM'.split('').map((c): [KeyLegend, number] => [L(c), 1]), [N(',', '<'), 1], [N('.', '>'), 1], [N('/', '?'), 1],
      [{ t: 'word', c: '⇧', at: 'br' }, 2.25]],
    [[{ t: 'icon', c: 'globe' }, 1], [{ t: 'word', c: 'control', at: 'bl', top: '⌃' }, 1], [{ t: 'word', c: 'option', at: 'bl', top: '⌥' }, 1],
      [{ t: 'word', c: 'command', at: 'bl', top: '⌘' }, 1.25], [{ t: 'word', c: '', at: 'c' }, 5], [{ t: 'word', c: 'command', at: 'br', top: '⌘' }, 1.25],
      [{ t: 'word', c: 'option', at: 'br', top: '⌥' }, 1], [{ t: 'icon', c: 'left' }, 1], [{ t: 'icon', c: 'up' }, 1], [{ t: 'icon', c: 'right' }, 1]],
  ];
  const mm = 1000, keys: Key[] = [];
  rows.forEach((row, r) => {
    let u = 0;
    const y = (KB.back + KB.pitchY * r) * mm;
    row.forEach(([k, w], i) => {
      const x = (KB.left + KB.pitchX * u) * mm, kw = (KB.pitchX * w - KB.gap) * mm, kh = KB.keyD * mm;
      const corner = r === 0 && i === 0 ? 0 : r === 0 && i === row.length - 1 ? 1 : r === 5 && i === 0 ? 3 : r === 5 && i === row.length - 1 ? 2 : undefined;
      if (k.t === 'icon' && k.c === 'up') {
        // ↑↓ 共用一格，各約 7.9 高、中間 0.5 縫
        const hh = (kh - 0.5) / 2;
        keys.push({ x, y, w: kw, h: hh, k }, { x, y: y + hh + 0.5, w: kw, h: hh, k: { t: 'icon', c: 'down' } });
      } else keys.push({ x, y, w: kw, h: kh, k, corner });
      u += w;
    });
  });
  return keys;
}

/** 鍵帽字樣貼圖（俯視整片鍵盤，1 px ≈ 0.136 mm）：白底灰字，台灣注音配列 */
function keyboardTexture(keys: readonly Key[]): THREE.Texture {
  const S = 2048 / (KB.W * 1000), c = document.createElement('canvas');
  c.width = 2048;
  c.height = Math.round(KB.D * 1000 * S);
  const g = c.getContext('2d')!;
  g.fillStyle = '#f5f5f3';
  g.fillRect(0, 0, c.width, c.height);
  const ink = '#6f6f6f', FONT = '"SF Pro Text", "Helvetica Neue", "Segoe UI", Arial, sans-serif', TC = '"PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif';
  g.fillStyle = g.strokeStyle = ink;
  g.lineWidth = 0.35 * S;
  const text = (s: string, x: number, y: number, size: number, align: CanvasTextAlign, font = FONT, base: CanvasTextBaseline = 'alphabetic') => {
    g.font = `${size * S}px ${font}`;
    g.textAlign = align;
    g.textBaseline = base;
    g.fillText(s, x * S, y * S);
  };
  const tri = (cx: number, cy: number, dir: number) => {
    g.save();
    g.translate(cx * S, cy * S);
    g.rotate(dir);
    g.beginPath();
    g.moveTo(1.1 * S, 0);
    g.lineTo(-0.7 * S, -1 * S);
    g.lineTo(-0.7 * S, 1 * S);
    g.fill();
    g.restore();
  };
  // 功能鍵圖示（上半中間，約 3.5 mm）
  const fnIcon = (n: number, cx: number, cy: number) => {
    const P = (x: number, y: number) => [(cx + x) * S, (cy + y) * S] as const, circle = (x: number, y: number, r: number, fill = false) => {
      g.beginPath();
      g.arc(...P(x, y), r * S, 0, Math.PI * 2);
      if (fill) g.fill();
      else g.stroke();
    };
    const line = (x0: number, y0: number, x1: number, y1: number) => { g.beginPath(); g.moveTo(...P(x0, y0)); g.lineTo(...P(x1, y1)); g.stroke(); };
    if (n <= 2) {
      circle(0, 0, n === 1 ? 0.6 : 0.8, true);
      for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, r0 = n === 1 ? 1.0 : 1.2, r1 = n === 1 ? 1.4 : 1.9; line(r0 * Math.cos(a), r0 * Math.sin(a), r1 * Math.cos(a), r1 * Math.sin(a)); }
    } else if (n === 3) {
      g.strokeRect(...P(-1.8, -1.2), 1.4 * S, 1 * S); g.strokeRect(...P(0.4, -1.2), 1.4 * S, 1 * S); g.strokeRect(...P(-0.9, 0.2), 1.8 * S, 1 * S);
    } else if (n === 4) { circle(-0.3, -0.3, 1); line(0.4, 0.4, 1.4, 1.4); }
    else if (n === 5) { g.strokeRect(...P(-0.5, -1.6), 1 * S, 2 * S); g.beginPath(); g.arc(...P(0, 0), 1 * S, 0, Math.PI); g.stroke(); line(0, 1, 0, 1.6); }
    else if (n === 6) { g.beginPath(); g.arc(...P(0, 0), 1.4 * S, 0.6, Math.PI * 2 - 0.6, false); g.arc(...P(0.7, -0.3), 1.1 * S, Math.PI * 2 - 1.2, 1.4, true); g.fill(); }
    else if (n === 7) { tri(-0.2, 0, Math.PI); tri(-1.6, 0, Math.PI); g.fillRect(...P(0.7, -1), 0.4 * S, 2 * S); }
    else if (n === 8) { tri(-0.9, 0, 0); g.fillRect(...P(0.6, -1), 0.4 * S, 2 * S); g.fillRect(...P(1.3, -1), 0.4 * S, 2 * S); }
    else if (n === 9) { g.fillRect(...P(-1.1, -1), 0.4 * S, 2 * S); tri(0.2, 0, 0); tri(1.6, 0, 0); }
    else {
      g.beginPath(); g.moveTo(...P(-1.6, -0.5)); g.lineTo(...P(-1, -0.5)); g.lineTo(...P(-0.2, -1.3)); g.lineTo(...P(-0.2, 1.3)); g.lineTo(...P(-1, 0.5)); g.lineTo(...P(-1.6, 0.5)); g.fill();
      for (let i = 0; i < n - 10; i++) { g.beginPath(); g.arc(...P(-0.2, 0), (0.8 + 0.6 * i) * S, -0.8, 0.8); g.stroke(); }
    }
  };
  for (const { x, y, w, h, k } of keys) {
    const cx = x + w / 2, cy = y + h / 2;
    switch (k.t) {
      case 'letter':
        text(k.c, x + w - 2.6, y + 5.6, 4.2, 'right');
        text(k.z, x + 2.4, y + h - 2.6, 3.6, 'left', TC);
        break;
      case 'num':
        text(k.s, x + 2.4, y + 5, 3.2, 'left');
        text(k.c, x + w - 2.6, y + 5.6, 3.8, 'right');
        if (k.z) text(k.z, x + 2.4, y + h - 2.6, 3.6, 'left', TC);
        break;
      case 'word':
        if (k.top) text(k.top, k.at === 'br' ? x + w - 3.1 : x + 3.1, y + 5.2, 3.6, k.at === 'br' ? 'right' : 'left');
        if (k.c === '中/英') {
          text(k.c, x + 3.1, y + h - 2.9, 3, 'left', TC);
          g.beginPath(); g.arc((x + 3.6) * S, (y + 3.4) * S, 0.7 * S, 0, Math.PI * 2); g.fill();
        } else if (k.c) {
          const icon = /^[⌫⇥⇧↩]$/.test(k.c);
          text(k.c, k.at === 'br' ? x + w - 3.1 : x + 3.1, y + h - 2.9, icon ? 4 : 2.6, k.at === 'br' ? 'right' : 'left', icon ? `"Segoe UI Symbol", ${FONT}` : FONT);
        }
        break;
      case 'fn':
        fnIcon(k.n, cx, y + 6);
        text(`F${k.n}`, cx, y + h - 2.6, 2.2, 'center');
        break;
      case 'icon':
        if (k.c === 'touch') {
          g.strokeStyle = '#c9c9c7';
          g.lineWidth = 0.4 * S;
          g.beginPath(); g.arc(cx * S, cy * S, 4.9 * S, 0, Math.PI * 2); g.stroke();
          g.strokeStyle = ink;
          g.lineWidth = 0.35 * S;
        } else if (k.c === 'globe') {
          const gx = x + 4.6, gy = y + h - 4.6, r = 1.9;
          g.beginPath(); g.arc(gx * S, gy * S, r * S, 0, Math.PI * 2); g.stroke();
          g.beginPath(); g.ellipse(gx * S, gy * S, 0.8 * S, r * S, 0, 0, Math.PI * 2); g.stroke();
          g.beginPath(); g.moveTo((gx - r) * S, gy * S); g.lineTo((gx + r) * S, gy * S); g.stroke();
        } else tri(cx, cy, { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[k.c]);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

let keycapMat: THREE.MeshStandardMaterial | undefined;

/** 鍵盤：中心在 (x, z)，後緣朝螢幕 */
function keyboard(b: Build, g: THREE.Group, x: number, z: number): void {
  const { W, D, h0, h1 } = KB;
  // 楔形：前緣 4.1 mm、後緣 10.9 mm
  const deck = (lz: number) => h0 + (h1 - h0) * (0.5 - lz / D);
  const wedge = (geo: THREE.BufferGeometry, lift: (lz: number) => number, scaleH = 0) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, scaleH ? (p.getY(i) * deck(p.getZ(i))) / scaleH : p.getY(i) + lift(p.getZ(i)));
    geo.computeVertexNormals();
    return geo;
  };
  const base = wedge(hplate(rrect(-W / 2, -D / 2, W / 2, D / 2, KB.R, 6), h1, 0.0012), () => 0, h1);
  add(g, base, b.mat.aluminium, x, 0, z);

  const keys = keyLayout();
  const geos = keys.map(({ x: kx, y: ky, w, h, corner }) => {
    const r = [0.0018, 0.0018, 0.0018, 0.0018];
    if (corner !== undefined) r[corner] = 0.006;
    const x0 = -W / 2 + kx / 1000, z0 = -D / 2 + ky / 1000;
    return hplate(rrect(x0, z0, x0 + w / 1000, z0 + h / 1000, r, 3), 0.0014, 0.0003);
  });
  const caps = mergeGeometries(geos)!;
  for (const ge of geos) ge.dispose();
  // 鍵帽高出鋁面約 0.9 mm，頂面跟著楔形傾斜；字樣貼圖由上往下投影
  wedge(caps, (lz) => deck(lz) - 0.0005);
  const p = caps.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) uv.set([(p.getX(i) + W / 2) / W, 1 - (p.getZ(i) + D / 2) / D], i * 2);
  caps.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  keycapMat ??= Object.assign(new THREE.MeshStandardMaterial({ map: keyboardTexture(keys), roughness: 0.45 }), { name: 'keycap' });
  add(g, caps, keycapMat, x, 0, z, false);
}

/* ---------------- Magic Mouse ---------------- */

/** 量測表（mm，離任一端的距離 → 值）：平面半寬、上殼頂高、白／銀接縫高、底面高 */
const MOUSE = {
  L: 113.5,
  width: [[0, 0], [0.3, 6], [1, 11.3], [2, 14.8], [3, 17.1], [4.5, 19.6], [6, 21.5], [8, 23.2], [10, 24.5], [12.5, 25.7], [15, 26.4], [20, 27.4], [30, 28.2], [40, 28.5], [56.75, 28.55]],
  top: [[0, 4.5], [1.3, 6.9], [3.4, 8.6], [7.6, 11.3], [11.7, 13.4], [15.9, 15.1], [20, 16.6], [24.2, 17.8], [28.3, 18.8], [32.5, 19.6], [36.6, 20.2], [40.8, 20.8], [45, 21.1], [49, 21.4], [56.75, 21.6]],
  seam: [[0, 4.5], [3.4, 4.1], [7.6, 5.4], [11.7, 6.6], [15.9, 7.8], [20, 8.8], [24.2, 9.8], [28.3, 10.6], [32.5, 11.2], [36.6, 11.7], [40.8, 12.2], [45, 12.5], [49, 12.7], [56.75, 12.9]],
  base: [[0, 4.5], [3.4, 2.8], [7.6, 1.9], [11.7, 1.4], [15.9, 1.0], [17.3, 0.6], [56.75, 0.6]],
} as const;

const lerpTable = (t: readonly (readonly [number, number])[], s: number) => {
  for (let i = 1; i < t.length; i++) if (s <= t[i][0]) {
    const [s0, v0] = t[i - 1], [s1, v1] = t[i];
    return v0 + ((v1 - v0) * (s - s0)) / (s1 - s0);
  }
  return t[t.length - 1][1];
};

let shellMat: THREE.MeshPhysicalMaterial | undefined;

/** 滑鼠：中心在 (x, z)、轉 yaw，長邊沿 z */
function mouse(b: Build, g: THREE.Group, x: number, z: number, yaw: number): void {
  const M = MOUSE, half = M.L / 2;
  const ss = [0, 0.3, 0.7, 1.2, 2, 3, 4.5, 6, 8, 10, 12.5, 15, 18, 22, 26, 30, 35, 40, 45, 50, half];
  const along = [...ss, ...ss.slice(0, -1).reverse().map((s) => M.L - s)];
  const K = 24, J = 8, shell: THREE.Vector3[][] = [], baseR: THREE.Vector3[][] = [];
  for (const s of along) {
    const d = Math.min(s, M.L - s), w = lerpTable(M.width, d) / 1000, t = lerpTable(M.top, d) / 1000, e = lerpTable(M.seam, d) / 1000;
    const bo = lerpTable(M.base, d) / 1000, zz = (s - half) / 1000;
    // 上殼：從 −x 的接縫越過頂端到 +x（扁橢圓拱）
    const sh: THREE.Vector3[] = [];
    for (let k = 0; k <= K; k++) { const ψ = Math.PI - (k / K) * Math.PI; sh.push(V(w * Math.cos(ψ), e + (t - e) * Math.sin(ψ), zz)); }
    shell.push(sh);
    // 底座：從 +x 接縫往下往內收到底面、橫過底面、再上到 −x 接縫
    const br: THREE.Vector3[] = [];
    for (let j = 0; j <= J; j++) { const φ = (j / J) * (Math.PI / 2); br.push(V(w - 0.14 * w * (1 - Math.cos(φ)), e - (e - bo) * Math.sin(φ), zz)); }
    for (let j = J; j >= 0; j--) { const φ = (j / J) * (Math.PI / 2); br.push(V(-(w - 0.14 * w * (1 - Math.cos(φ))), e - (e - bo) * Math.sin(φ), zz)); }
    baseR.push(br);
  }
  const grp = new THREE.Group();
  grp.position.set(x, 0, z);
  grp.rotation.y = yaw;
  g.add(grp);
  shellMat ??= Object.assign(new THREE.MeshPhysicalMaterial({ color: 0xf3f3f1, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 }), { name: 'mouseShell' });
  add(grp, skin(shell, { closed: false }), shellMat);
  add(grp, skin(baseR, { closed: false }), b.mat.aluminium);
  // 底下兩條黑色滑軌（4.7 寬、79 長，中心 ±15.5）是唯一著地的地方
  for (const s of [-1, 1]) gbox(grp, 0.0047, 0.0006, 0.079, s * 0.0155, 0.0003, 0, b.mat.black, 0.0002, false);
}
