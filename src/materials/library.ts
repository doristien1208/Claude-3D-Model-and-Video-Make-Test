import * as THREE from 'three';
import { TextureLibrary, type TexName } from './textures';

type RGB = readonly [number, number, number];

/** 中性色貼圖的線性空間染色倍率（數值可大於 1），見 HANDOFF 8.2 */
export const TINTS = {
  wall: [1.158, 1.222, 1.297],
  ceil: [1.374, 1.49, 1.632],
  walnut: [0.883, 0.897, 1.003],
  walnutDark: [0.49, 0.554, 0.636],
  door: [0.541, 0.658, 0.828],
  stone: [0.723, 0.66, 0.667],
  stoneWarm: [0.797, 0.803, 0.783],
  linen: [1.607, 1.632, 1.615],
  duvet: [1.228, 1.193, 1.115],
  rug: [0.693, 0.685, 0.734],
  rug2: [2.287, 2.452, 2.519],
} as const satisfies Record<string, RGB>;

/**
 * 毛圈布的法線貼圖：隨機小圓丘（毛圈約 1.5 mm）疊加、可無縫拼接；一張代表 4 cm（世界座標 UV 下 repeat 25）。
 * 走近時才看得到，遠看靠 sheen 表現毛絨感。
 */
function terryNormalMap(): THREE.Texture {
  const S = 256, hgt = new Float32Array(S * S);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let n = 0; n < 2600; n++) {
    const cx = Math.floor(rnd() * S), cy = Math.floor(rnd() * S), r = 3 + rnd() * 2.5, a = 0.6 + rnd() * 0.4, k = Math.ceil(r);
    for (let dy = -k; dy <= k; dy++) for (let dx = -k; dx <= k; dx++) {
      const d2 = (dx * dx + dy * dy) / (r * r);
      if (d2 < 1) hgt[((cy + dy + S) % S) * S + ((cx + dx + S) % S)] += a * (1 - d2);
    }
  }
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!, img = g.createImageData(S, S), h = (x: number, y: number) => hgt[((y + S) % S) * S + ((x + S) % S)];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const nx = -0.6 * (h(x + 1, y) - h(x - 1, y)), ny = -0.6 * (h(x, y + 1) - h(x, y - 1)), l = Math.hypot(nx, ny, 1);
    img.data.set([(nx / l) * 127.5 + 127.5, (ny / l) * 127.5 + 127.5, (1 / l) * 127.5 + 127.5, 255], (y * S + x) * 4);
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(25, 25);
  return tex;
}

/**
 * 玻璃表面的微微起伏（浮法、強化玻璃的滾輪波紋）：可無縫拼接的 fBm 雜訊，換算成法線貼圖。
 * 一張代表 1.5 m、最大的起伏約半公尺；以半浮點數存，傾斜角不會因 8 位元量化而出現階梯。
 * slope 為最大傾斜（弧度），只影響反射（玻璃沒有厚度，不折射）。
 */
function glassNormal(slope: number): THREE.Texture {
  const S = 256, TILE = 1.5, hgt = new Float32Array(S * S);
  let seed = 11, amp = 1;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const cells of [3, 6, 12]) {
    const lat = Array.from({ length: cells * cells }, rnd);
    const L = (i: number, j: number) => lat[(j % cells) * cells + (i % cells)];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const fx = (x / S) * cells, fy = (y / S) * cells, i = Math.floor(fx), j = Math.floor(fy);
      const u = fx - i, v = fy - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
      const a = L(i, j) + (L(i + 1, j) - L(i, j)) * su, c = L(i, j + 1) + (L(i + 1, j + 1) - L(i, j + 1)) * su;
      hgt[y * S + x] += amp * (a + (c - a) * sv);
    }
    amp *= 0.5;
  }
  const h = (x: number, y: number) => hgt[((y + S) % S) * S + ((x + S) % S)];
  const gx = new Float32Array(S * S), gy = new Float32Array(S * S);
  let max = 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const k = y * S + x;
    gx[k] = h(x + 1, y) - h(x - 1, y);
    gy[k] = h(x, y + 1) - h(x, y - 1);
    max = Math.max(max, Math.hypot(gx[k], gy[k]));
  }
  const data = new Uint16Array(S * S * 4), f = slope / max, H = THREE.DataUtils.toHalfFloat;
  for (let k = 0; k < S * S; k++) {
    const nx = -gx[k] * f, ny = -gy[k] * f, l = Math.hypot(nx, ny, 1);
    data.set([H((nx / l) * 0.5 + 0.5), H((ny / l) * 0.5 + 0.5), H((1 / l) * 0.5 + 0.5), H(1)], k * 4);
  }
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.repeat.set(1 / TILE, 1 / TILE);
  tex.needsUpdate = true;
  return tex;
}

/** 捲起毛巾的端面：一層層之間的螺旋暗線（白底，乘上毛巾顏色） */
function rollEndTexture(): THREE.Texture {
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(0,0,0,0.38)';
  g.lineWidth = 2.5;
  g.beginPath();
  for (let t = 0; t <= 1; t += 0.002) {
    const a = t * 4.5 * 2 * Math.PI, r = 5 + t * 56;
    g.lineTo(S / 2 + r * Math.cos(a), S / 2 + r * Math.sin(a));
  }
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * 螢幕畫面（16:9）：暖色系的沙丘漸層桌布，上緣半透明選單列、下緣置中的 Dock（圓角方塊圖示），
 * 一看就是開著的電腦，但不用任何品牌圖案。
 */
function screenTexture(): THREE.Texture {
  const W = 1280, H = 720, c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#26335c');
  sky.addColorStop(0.45, '#8d5f78');
  sky.addColorStop(0.75, '#dc9068');
  sky.addColorStop(1, '#f0b77c');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  // 三層沙丘：越前面越暖、越暗
  const dunes: [number, number, number, string, string][] = [
    [0.55, 60, 1.3, '#b7707a', '#7d4a63'], [0.68, 50, 2.1, '#d9875f', '#9a5550'], [0.82, 40, 1.7, '#8f4a45', '#4d2a35'],
  ];
  dunes.forEach(([y0, amp, f, c0, c1], k) => {
    const grad = g.createLinearGradient(0, y0 * H - amp, 0, H);
    grad.addColorStop(0, c0);
    grad.addColorStop(1, c1);
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) g.lineTo(x, y0 * H + amp * Math.sin((x / W) * Math.PI * f + k * 1.7) + 0.4 * amp * Math.sin((x / W) * Math.PI * f * 3.1 + k));
    g.lineTo(W, H);
    g.fill();
  });
  const rr = (x: number, y: number, w: number, h: number, r: number) => {
    g.beginPath();
    g.roundRect(x, y, w, h, r);
    g.fill();
  };
  // 選單列與幾個選單字樣（用短條代替文字）
  g.fillStyle = 'rgba(255,255,255,0.16)';
  g.fillRect(0, 0, W, 22);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  [[26, 30], [72, 26], [112, 30], [156, 34], [204, 40], [258, 34]].forEach(([x, w]) => rr(x, 8, w, 7, 2));
  [[1080, 20], [1110, 26], [1150, 104]].forEach(([x, w]) => rr(x, 8, w, 7, 2));
  // Dock
  const icons = ['#3d8af7', '#f5f5f7', '#34c759', '#ff9f0a', '#ff375f', '#5e5ce6', '#64d2ff', '#ffd60a', '#8e8e93', '#30b0c7'];
  const S = 46, gap = 10, dw = icons.length * (S + gap) + gap, dx = (W - dw) / 2, dy = H - S - 22;
  g.fillStyle = 'rgba(255,255,255,0.22)';
  rr(dx, dy - 8, dw, S + 16, 18);
  icons.forEach((col, i) => {
    const x = dx + gap + i * (S + gap), grad = g.createLinearGradient(0, dy, 0, dy + S);
    grad.addColorStop(0, col);
    grad.addColorStop(1, `color-mix(in srgb, ${col} 70%, black)`);
    g.fillStyle = grad;
    rr(x, dy, S, S, 11);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** 玻璃表面最大傾斜（弧度，約 0.46°）：調小，只讓反射有一點點起伏 */
const GLASS_SLOPE = 0.008;

export function createMaterials(tex: TextureLibrary) {
  const PBR = (name: TexName, tint?: RGB, o: THREE.MeshStandardMaterialParameters = {}) => {
    const m = new THREE.MeshStandardMaterial({
      map: tex.get(name, 'base'),
      normalMap: tex.get(name, 'nrm'),
      roughnessMap: tex.get(name, 'orm'),
      aoMap: tex.get(name, 'orm'),
      roughness: 1,
      metalness: 0,
      ...o,
    });
    if (tint) m.color.setRGB(tint[0], tint[1], tint[2]);
    return m;
  };
  /**
   * 布料（Filament 布料模型、KHR_materials_sheen、V-Ray 布料建議）：絨面光澤 sheen 取代大部分鏡面反射，
   * sheenColor 預設為 √底色（比底色亮），斜看時邊緣柔和泛亮；鏡面反射調低（specularIntensity），
   * 不然整片會蒙上一層灰白的光。Poly Haven 布料貼圖已轉成線性平均 0.45 的中性灰，底色 = 倍率 × 0.45。
   */
  const cloth = (name: TexName, tint: RGB, o: { sheen?: number; sheenRoughness?: number; spec?: number; sheenColor?: number } = {}) => {
    const m = new THREE.MeshPhysicalMaterial({
      map: tex.get(name, 'base'), normalMap: tex.get(name, 'nrm'), roughnessMap: tex.get(name, 'orm'), aoMap: tex.get(name, 'orm'),
      roughness: 1, metalness: 0, sheen: o.sheen ?? 1, sheenRoughness: o.sheenRoughness ?? 0.75, specularIntensity: o.spec ?? 0.3,
    });
    m.color.setRGB(tint[0], tint[1], tint[2]);
    if (o.sheenColor !== undefined) m.sheenColor.set(o.sheenColor);
    else m.sheenColor.setRGB(...(tint.map((c) => Math.sqrt(Math.min(1, c * 0.45))) as [number, number, number]));
    return m;
  };
  /** 麻布：絨面光澤較弱、較集中，鏡面反射略高 */
  const LINEN = { sheen: 0.45, sheenRoughness: 0.6, spec: 0.4 };
  const M = (o: THREE.MeshStandardMaterialParameters) =>
    new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, ...o });
  const terryN = terryNormalMap(), rollEnd = rollEndTexture(), glassN = glassNormal(GLASS_SLOPE);
  const terry = (color: number, sheenColor: number, map?: THREE.Texture) => new THREE.MeshPhysicalMaterial({
    color, roughness: 0.95, normalScale: new THREE.Vector2(0.6, 0.6), sheen: 1, sheenRoughness: 0.6, sheenColor,
    ...(map ? { map } : { normalMap: terryN }),
  });

  const mat = {
    wall: PBR('plaster', TINTS.wall),
    ceil: PBR('plaster', TINTS.ceil),
    floor: PBR('floor'),
    walnut: PBR('walnut', TINTS.walnut),
    walnutDark: PBR('walnut', TINTS.walnutDark),
    door: PBR('walnut', TINTS.door),
    slat: PBR('slat', TINTS.walnut),
    // 黑色粉體烤漆：塗層是高分子，metalness 0（RAL 9005 LRV ≈ 4）；燈具、層架等用霧面
    black: M({ color: 0x202020, roughness: 0.6, metalness: 0 }),
    // 緞面黑：門把、龍頭、毛巾桿、窗把手
    blackSatin: M({ color: 0x1f1f1f, roughness: 0.35, metalness: 0 }),
    stone: PBR('stoneDarkSlab', TINTS.stone),
    stoneWarm: PBR('stoneLightSlab', TINTS.stoneWarm),
    // 洞石（暖白、霧面）：茶几
    travertine: PBR('stoneLightSlab', [1.04, 0.99, 0.9]),
    tileDark: PBR('stoneDarkTile'),
    tileLight: PBR('stoneLightTile'),
    linen: PBR('fabric', TINTS.linen),
    duvet: PBR('fabric', TINTS.duvet),
    // 沙發：燕麥灰褐羊毛 bouclé（座框、坐墊、椅背墊同一塊布）；抱枕：奶油色 bouclé、赭黃與陶土紅粗麻
    // （Poly Haven 貼圖已轉成線性平均 0.45 的中性灰，倍率換算自原本 fabric 貼圖上的顏色）
    sofa: cloth('boucle', [0.508, 0.391, 0.297]),
    pillowCream: cloth('boucle', [1.615, 1.414, 1.113]),
    // 床頭板、床座：深咖啡羊毛 bouclé（倍率換算自原本 fabric 貼圖上的顏色）
    headboard: cloth('boucle', [0.226, 0.147, 0.104]),
    // 歐式方枕：燕麥色粗麻
    bedOat: cloth('roughLinen', [1.3, 1.09, 0.79], LINEN),
    // 植鞣鞍皮（深咖啡）：西班牙椅
    saddle: PBR('leather', [0.64, 0.67, 0.66]),
    ochre: cloth('roughLinen', [1.05, 0.548, 0.195], LINEN),
    pillowRust: cloth('roughLinen', [0.839, 0.254, 0.137], LINEN),
    // 刷毛羊毛毯（HAY Mono，深咖啡灰）
    wool: cloth('fabric', [0.26, 0.21, 0.18], { sheenColor: 0x6a5d55 }),
    rug: PBR('rug', TINTS.rug),
    rug2: PBR('rug', TINTS.rug2),
    // 黑色皮革（Eames 鋁框椅吊帶）
    chair: PBR('leather', [0.044, 0.126, 0.31]),
    // 衛浴陶瓷（施釉瓷，physicallybased.info 實測 "Porcelain"）
    white: new THREE.MeshPhysicalMaterial({ color: 0xe0e0dd, roughness: 0.04, ior: 1.5 }),
    // 壓克力浴缸（PMMA ior 1.49）
    acrylic: new THREE.MeshPhysicalMaterial({ color: 0xebebe8, roughness: 0.07, ior: 1.49 }),
    // 馬桶座蓋（尿素樹脂，比陶瓷略霧）
    seat: new THREE.MeshPhysicalMaterial({ color: 0xe6e6e2, roughness: 0.2, ior: 1.5 }),
    // 鏡子：銀鏡反射率約 86%（AGC Mirox，EN 1036），玻璃含鐵帶極淡綠；鏡面本身另有即時平面反射
    mirror: M({ color: 0xf0f3f1, roughness: 0.02, metalness: 1 }),
    // 清玻璃（浮法 ior 1.52）：不用穿透（three.js 的穿透要把整個場景再畫一次，畫面時間約 ×3.7），
    // 改成只畫反射的黑色本體、以加法混合疊在後面的東西上：看得穿，反射也不會被透明度淡掉；薄片不折射
    glass: new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0, ior: 1.52, metalness: 0, normalMap: glassN,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    // 電視（關機）：OLED 光面，抗反射膜約 1% 反射
    tv: new THREE.MeshPhysicalMaterial({ color: 0x0e0e0e, roughness: 0.05, ior: 1.22 }),
    // 螢幕畫面（只發光、不反射；前面另疊一層 glass 做玻璃反射）：亮度由 lighting.ts 依日夜設定
    screen: M({ color: 0x000000, roughness: 1, emissive: 0xffffff, emissiveMap: screenTexture(), emissiveIntensity: 1 }),
    // 電視機身與窄邊框（霧黑）
    tvBody: M({ color: 0x161617, roughness: 0.5 }),
    // 植物葉片（琴葉榕一類的蠟質葉）：正面深綠亮面、背面淺綠霧面（葉片用正反兩個 InstancedMesh）
    plant: M({ color: 0x2f4426, roughness: 0.35 }),
    plantUnder: M({ color: 0x5b6d45, roughness: 0.6, side: THREE.BackSide }),
    plantStem: M({ color: 0x4d5a36, roughness: 0.6 }),
    bark: M({ color: 0x6b5a48, roughness: 0.85 }),
    // 橄欖：表面灰綠、背面銀白（細鱗片），樹皮灰
    oliveLeaf: M({ color: 0x4f5c3e, roughness: 0.55 }),
    oliveUnder: M({ color: 0xa3a894, roughness: 0.7, side: THREE.BackSide }),
    oliveBark: M({ color: 0x7a7266, roughness: 0.9 }),
    soil: M({ color: 0x3a2e25, roughness: 1 }),
    // 灰褐纖維土盆（琴葉榕）、灰色水泥感盆（Rodborough）
    potFibre: M({ color: 0x8b8278, roughness: 0.92 }),
    potStone: M({ color: 0x9c9a94, roughness: 0.95 }),
    // Hammershøi 白色亮釉瓷、乾燥枝
    glaze: M({ color: 0xe8e5de, roughness: 0.12 }),
    dried: M({ color: 0xb39a78, roughness: 0.9 }),
    // 霧面施釉陶盆（炭灰）
    pot: M({ color: 0x3c3c3a, roughness: 0.6 }),
    // IKEA TJENA 白色紙板收納箱
    tjena: M({ color: 0xe9e7e1, roughness: 0.85 }),
    outside: M({ color: 0x9e9a92, roughness: 1 }),
    glow: M({ color: 0xffe2bd, emissive: 0xffb46b, emissiveIntensity: 3 }),
    glowSoft: M({ color: 0xf0e2cc, emissive: 0xffbb7a, emissiveIntensity: 1.2, roughness: 1 }),
    // 以下三種在參考版是單次使用的行內材質
    wetFloor: M({ color: 0x2b2826, roughness: 0.4 }),
    sinkMetal: M({ color: 0x161515, roughness: 0.3, metalness: 0.6 }),
    ceramicBeige: M({ color: 0xcdbfa8, roughness: 0.55 }),
    // 門樘陰影縫、嵌入式取手的凹槽
    gap: M({ color: 0x1a1715, roughness: 0.9 }),
    // 深色鋁框（窗、陽台拉門）
    // 不鏽鋼（水槽）
    steel: M({ color: 0xc7c9c9, roughness: 0.35, metalness: 1 }),
    // 拋光鋁（Eames 鋁框椅側框、五爪腳）
    chrome: M({ color: 0xd9dbdc, roughness: 0.15, metalness: 1 }),
    // 噴砂陽極鋁（Apple 螢幕、鍵盤）
    aluminium: M({ color: 0xc4c6c8, roughness: 0.45, metalness: 1 }),
    // 冰箱玻璃門板（深灰光面）
    fridgeGlass: new THREE.MeshPhysicalMaterial({ color: 0x232526, roughness: 0.12, ior: 1.5 }),
    // 深古銅陽極鋁（Tiger Drylac Dark Bronze #4E4542；陽極處理以金屬建模）
    alu: M({ color: 0x4e4542, roughness: 0.3, metalness: 1 }),
    // 窗簾（雙面）：象牙白聚酯紗（約 50 g/m²，三角斷面絲有細微閃光）、燕麥色麻感布簾（200–300 g/m²）。
    // 紗：粗糙 0.7、白色絨面光澤較集中、不透明度 0.4，斜看時較密（grazingAlpha，見 envProbes）；布：絨面光澤 √底色、鏡面反射調低
    sheer: new THREE.MeshPhysicalMaterial({ map: tex.get('fabric', 'base'), normalMap: tex.get('fabric', 'nrm'), color: new THREE.Color(1.55, 1.5, 1.38),
      roughness: 0.7, sheen: 0.45, sheenRoughness: 0.4, sheenColor: new THREE.Color(0.85, 0.85, 0.85), specularIntensity: 0.5,
      transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false, vertexColors: true }),
    drape: new THREE.MeshPhysicalMaterial({ map: tex.get('fabric', 'base'), normalMap: tex.get('fabric', 'nrm'), roughnessMap: tex.get('fabric', 'orm'),
      aoMap: tex.get('fabric', 'orm'), color: new THREE.Color(0.92, 0.8, 0.64), roughness: 1, sheen: 0.8, sheenRoughness: 0.65,
      sheenColor: new THREE.Color(0.666, 0.59, 0.496), specularIntensity: 0.35, side: THREE.DoubleSide, vertexColors: true }),
    // 開關插座面板：霧白（灰泥牆）、深灰（木作）；防水蓋
    plateWhite: M({ color: 0xf1eee8, roughness: 0.35 }),
    plateDark: M({ color: 0x3b3c3d, roughness: 0.4, metalness: 0.15 }),
    coverClear: new THREE.MeshStandardMaterial({ color: 0xd8dcdc, transparent: true, opacity: 0.35, roughness: 0.2, depthWrite: false }),
    // 崁燈白色深杯（內面朝下看得到，半光澤）
    cup: M({ color: 0xf2f0ec, roughness: 0.35, side: THREE.BackSide }),
    // 衛浴霧面玻璃：蝕刻面把窗外的光完全打散，室內看到的是一片均勻亮面，不做穿透
    // （three.js 穿透玻璃後面的穿透物件不會畫，隔著淋浴隔屏看會變成透明窗）；發光亮度由 main.ts 依窗外 HDRI 設定。
    // 室內側：粗糙反射＋少量背向散射
    frosted: new THREE.MeshPhysicalMaterial({ color: 0x5e6060, roughness: 0.5, ior: 1.52, normalMap: glassN }),
    // 毛巾（毛圈布）：粗糙 0.95＋絨面光澤，毛圈用法線貼圖；白 #ECE8E1、燕麥 #CBBDA8；捲起來的端面另有螺旋貼圖
    towelWhite: terry(0xece8e1, 0xffffff),
    towelOat: terry(0xcbbda8, 0xe8dfcf),
    towelWhiteEnd: terry(0xece8e1, 0xffffff, rollEnd),
    towelOatEnd: terry(0xcbbda8, 0xe8dfcf, rollEnd),
    // 琥珀玻璃瓶（裝了液體看起來是深咖啡色）；不做穿透，理由同霧面玻璃
    amber: new THREE.MeshPhysicalMaterial({ color: 0x4a2408, roughness: 0.05, ior: 1.52 }),
    // 蠟燭：深色玻璃杯＋蠟
    darkGlass: new THREE.MeshPhysicalMaterial({ color: 0x1c1b1a, roughness: 0.06, ior: 1.52 }),
    wax: M({ color: 0xeee6d6, roughness: 0.55 }),
    // 衛生紙、霧面白陶盆
    paper: M({ color: 0xf2f0ea, roughness: 0.9 }),
    potWhite: M({ color: 0xd8d3c8, roughness: 0.75 }),
    // 書封（白底，顏色由 InstancedMesh 的實例顏色決定；霧面上膜與布面精裝之間）
    bookCover: M({ color: 0xffffff, roughness: 0.7 }),
  };
  for (const [k, m] of Object.entries(mat)) m.name = k;
  // 紗簾斜看時較密（真的紗在掠射角幾乎不透）：不透明度 × (1 + k·(1 − |N·V|)³)，由 envProbes 的著色器修改套用
  mat.sheer.userData.grazingAlpha = 1.4;

  return { mat };
}

export type Materials = ReturnType<typeof createMaterials>;
export type Mat = Materials['mat'];
export type MatKey = keyof Mat;
