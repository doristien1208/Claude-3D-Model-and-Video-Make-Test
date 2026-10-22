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
  throw: [1.068, 0.927, 0.919],
  fabric: [0.472, 0.401, 0.347],
  fabricL: [0.604, 0.527, 0.454],
  headboard: [0.21, 0.151, 0.121],
  leather: [0.784, 0.855, 0.943],
  ochre: [0.976, 0.562, 0.228],
  rug: [0.693, 0.685, 0.734],
  rug2: [2.287, 2.452, 2.519],
  chair: [0.085, 0.082, 0.083],
} as const satisfies Record<string, RGB>;

/** 光暈用的漸層：u = 0 最亮、u = 1 完全透明（貼在 map 上，搭配加色疊加） */
function rampTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 1;
  const g = c.getContext('2d')!, img = g.createImageData(256, 1);
  for (let i = 0; i < 256; i++) {
    const t = i / 255, v = Math.round(255 * Math.pow(1 - t, 2.2));
    img.data.set([v, v, v, 255], i * 4);
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** 書櫃陳列師常用的書色：象牙、沙色、燕麥、灰褐、炭灰，加一兩本鏽紅、灰綠（去掉書衣、色塊分群） */
const BOOK_COLORS = [0xede7da, 0xcdbfa8, 0xbfb2a0, 0x8e8070, 0x3a3a38, 0x9a5a3c, 0x8f9a80];

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
  const M = (o: THREE.MeshStandardMaterialParameters) =>
    new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, ...o });
  const terryN = terryNormalMap(), rollEnd = rollEndTexture();
  const terry = (color: number, sheenColor: number, map?: THREE.Texture) => new THREE.MeshPhysicalMaterial({
    color, map, roughness: 0.95, normalMap: map ? undefined : terryN, normalScale: new THREE.Vector2(0.6, 0.6),
    sheen: 1, sheenRoughness: 0.6, sheenColor,
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
    tileDark: PBR('stoneDarkTile'),
    tileLight: PBR('stoneLightTile'),
    linen: PBR('fabric', TINTS.linen),
    duvet: PBR('fabric', TINTS.duvet),
    throw: PBR('rug', TINTS.throw),
    fabric: PBR('fabric', TINTS.fabric),
    fabricL: PBR('fabric', TINTS.fabricL),
    headboard: PBR('fabric', TINTS.headboard),
    leather: PBR('leather', TINTS.leather),
    ochre: PBR('fabric', TINTS.ochre),
    rug: PBR('rug', TINTS.rug),
    rug2: PBR('rug', TINTS.rug2),
    chair: PBR('fabric', TINTS.chair),
    // 衛浴陶瓷（施釉瓷，physicallybased.info 實測 "Porcelain"）
    white: new THREE.MeshPhysicalMaterial({ color: 0xe0e0dd, roughness: 0.04, ior: 1.5 }),
    // 壓克力浴缸（PMMA ior 1.49）
    acrylic: new THREE.MeshPhysicalMaterial({ color: 0xebebe8, roughness: 0.07, ior: 1.49 }),
    // 馬桶座蓋（尿素樹脂，比陶瓷略霧）
    seat: new THREE.MeshPhysicalMaterial({ color: 0xe6e6e2, roughness: 0.2, ior: 1.5 }),
    // 鏡子：銀鏡反射率約 86%（AGC Mirox，EN 1036），玻璃含鐵帶極淡綠；鏡面本身另有即時平面反射
    mirror: M({ color: 0xf0f3f1, roughness: 0.02, metalness: 1 }),
    // 清玻璃（浮法 ior 1.52）：穿透材質，反射不會被透明度一起淡掉；薄片（thickness 0）不折射
    glass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, roughness: 0, ior: 1.52, thickness: 0, metalness: 0 }),
    // 電視（關機）：OLED 光面，抗反射膜約 1% 反射
    tv: new THREE.MeshPhysicalMaterial({ color: 0x0e0e0e, roughness: 0.05, ior: 1.22 }),
    // 植物葉片（琴葉榕、橡膠樹一類的蠟質葉）
    plant: M({ color: 0x3a4a2e, roughness: 0.45, side: THREE.DoubleSide }),
    // 霧面施釉陶盆（炭灰）
    pot: M({ color: 0x3c3c3a, roughness: 0.6 }),
    // 牛皮紙箱（physicallybased.info 實測 "Cardboard"）
    kraft: M({ color: 0xa07e5d, roughness: 0.85 }),
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
    // 冰箱玻璃門板（深灰光面）
    fridgeGlass: new THREE.MeshPhysicalMaterial({ color: 0x232526, roughness: 0.12, ior: 1.5 }),
    // 深古銅陽極鋁（Tiger Drylac Dark Bronze #4E4542；陽極處理以金屬建模）
    alu: M({ color: 0x4e4542, roughness: 0.3, metalness: 1 }),
    // 窗簾：象牙白麻紗（半透明）、燕麥色布簾；雙面
    sheer: PBR('fabric', [1.55, 1.5, 1.38], { transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false, vertexColors: true }),
    drape: PBR('fabric', [0.92, 0.8, 0.64], { side: THREE.DoubleSide, vertexColors: true }),
    // 開關插座面板：霧白（灰泥牆）、深灰（木作）；防水蓋
    plateWhite: M({ color: 0xf1eee8, roughness: 0.35 }),
    plateDark: M({ color: 0x3b3c3d, roughness: 0.4, metalness: 0.15 }),
    coverClear: new THREE.MeshStandardMaterial({ color: 0xd8dcdc, transparent: true, opacity: 0.35, roughness: 0.2, depthWrite: false }),
    // 間接燈在天花／牆面上的光暈（加色疊加，強度隨日夜切換；見 lighting.ts）
    coveGlow: new THREE.MeshBasicMaterial({ color: 0xffb36b, map: rampTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    // 衛浴霧面玻璃：蝕刻面把窗外的光完全打散，室內看到的是一片均勻亮面，不做穿透
    // （three.js 穿透玻璃後面的穿透物件不會畫，隔著淋浴隔屏看會變成透明窗）；發光亮度由 main.ts 依窗外 HDRI 設定。
    // 室內側：粗糙反射＋少量背向散射
    frosted: new THREE.MeshPhysicalMaterial({ color: 0x5e6060, roughness: 0.5, ior: 1.52 }),
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
  };
  for (const [k, m] of Object.entries(mat)) m.name = k;

  const books = BOOK_COLORS.map((c, i) => {
    // 霧面上膜書封 0.5–0.6、布面精裝 0.85
    const m = M({ color: c, roughness: i % 2 ? 0.55 : 0.85 });
    m.name = `book${i}`;
    return m;
  });

  return { mat, books };
}

export type Materials = ReturnType<typeof createMaterials>;
export type Mat = Materials['mat'];
export type MatKey = keyof Mat;
