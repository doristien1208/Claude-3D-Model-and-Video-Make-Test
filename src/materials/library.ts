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

const BOOK_COLORS = [0x8a7a68, 0x5d4c3f, 0xa49580, 0x3f4a48, 0xb8a68a, 0x6e5a4a, 0x2f3433];

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
    black: M({ color: 0x1d1b1a, roughness: 0.5, metalness: 0.4 }),
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
    white: M({ color: 0xf1eee8, roughness: 0.25 }),
    water: M({ color: 0xaebfbe, roughness: 0.1 }),
    mirror: M({ color: 0x6a7274, roughness: 0.12, metalness: 0.3 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xcfe0e6, transparent: true, opacity: 0.16, roughness: 0.05, depthWrite: false }),
    tv: M({ color: 0x0b0b0c, roughness: 0.18, metalness: 0.3 }),
    plant: M({ color: 0x55663f, roughness: 0.9 }),
    pot: M({ color: 0x2e2a27, roughness: 0.7 }),
    kraft: M({ color: 0xb39673, roughness: 1 }),
    outside: M({ color: 0x9e9a92, roughness: 1 }),
    glow: M({ color: 0xffe2bd, emissive: 0xffb46b, emissiveIntensity: 3 }),
    glowSoft: M({ color: 0xf0e2cc, emissive: 0xffbb7a, emissiveIntensity: 1.2, roughness: 1 }),
    // 以下三種在參考版是單次使用的行內材質
    wetFloor: M({ color: 0x2b2826, roughness: 0.4 }),
    sinkMetal: M({ color: 0x161515, roughness: 0.3, metalness: 0.6 }),
    ceramicBeige: M({ color: 0xc9b9a0, roughness: 0.6 }),
    // 門樘陰影縫、嵌入式取手的凹槽
    gap: M({ color: 0x1a1715, roughness: 0.9 }),
    // 深色鋁框（窗、陽台拉門）
    alu: M({ color: 0x232120, roughness: 0.4, metalness: 0.6 }),
    // 衛浴霧面玻璃
    frosted: new THREE.MeshStandardMaterial({ color: 0xe6eaea, transparent: true, opacity: 0.62, roughness: 0.5, depthWrite: false }),
  };
  for (const [k, m] of Object.entries(mat)) m.name = k;

  const books = BOOK_COLORS.map((c, i) => {
    const m = M({ color: c, roughness: 0.9 });
    m.name = `book${i}`;
    return m;
  });

  return { mat, books };
}

export type Materials = ReturnType<typeof createMaterials>;
export type Mat = Materials['mat'];
export type MatKey = keyof Mat;
