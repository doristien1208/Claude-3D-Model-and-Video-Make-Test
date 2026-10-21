import * as THREE from 'three';

/** 每張貼圖代表的實際尺寸（公尺）；幾何的 UV 以公尺計（世界座標 UV，1 UV = 1 m） */
export const COVERS = {
  floor: 1.8, walnut: 0.6, slat: 0.6,
  stoneDarkSlab: 0.6, stoneDarkTile: 0.6, stoneLightSlab: 0.6, stoneLightTile: 0.6,
  plaster: 1, fabric: 0.12, rug: 0.3, leather: 0.2,
} as const;

export type TexName = keyof typeof COVERS;
/** base = basecolor（sRGB）、nrm = OpenGL 法線、orm = R:AO／G:roughness */
export type TexKind = 'base' | 'nrm' | 'orm';

export class TextureLibrary {
  readonly manager = new THREE.LoadingManager();
  /** 所有貼圖載入完成（或失敗）後 resolve */
  readonly ready: Promise<void>;
  private readonly loader = new THREE.TextureLoader(this.manager);
  private readonly cache = new Map<string, THREE.Texture>();
  private readonly anisotropy: number;
  private readonly baseUrl: string;

  constructor(renderer: THREE.WebGLRenderer, baseUrl = `${import.meta.env.BASE_URL}textures/`) {
    this.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    this.baseUrl = baseUrl;
    this.ready = new Promise((resolve) => {
      this.manager.onLoad = () => resolve();
    });
  }

  get(name: TexName, kind: TexKind): THREE.Texture {
    const key = `${name}_${kind}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const t = this.loader.load(`${this.baseUrl}${key}.jpg`);
    t.name = key;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = this.anisotropy;
    t.colorSpace = kind === 'base' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.repeat.set(1 / COVERS[name], 1 / COVERS[name]);
    this.cache.set(key, t);
    return t;
  }
}
