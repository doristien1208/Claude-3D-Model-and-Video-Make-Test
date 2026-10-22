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
    // 浴缸的水：ior 1.333，幾乎無色
    water: new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, roughness: 0.02, ior: 1.333, thickness: 0.35,
      attenuationColor: new THREE.Color().setRGB(0.969, 0.996, 0.997), attenuationDistance: 1 }),
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
    // 衛浴霧面玻璃
    frosted: new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, roughness: 0.45, ior: 1.52, thickness: 0 }),
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
