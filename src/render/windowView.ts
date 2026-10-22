import * as THREE from 'three';
import { X, Z } from '../core/units';
import { site } from '../data/layout';

/*
 * 窗外景觀：台中西區高樓上的實拍照片（曾成訓攝，2013-12-25，Nikon D800；CC BY 2.0，via Wikimedia Commons），
 * 先跑 npm run fetch:backplates。每個方向一張照片，貼在離房子中心 DIST 的垂直平面上：
 * 照片是直線透視鏡頭拍的，平面寬 = 距離 × 36 mm ÷ 焦距（全片幅），視角與原照片相同；地平線對到室內眼高。
 * 東面（客廳窗、陽台）白天與夜晚是同一方向；西面（臥室）與北面（廚房）不會同時被看到，共用照片，
 * 夜晚北面左右翻轉，避免從陽台同時看到兩棟同樣的高樓。照片載入時縮到 4096 寬。
 */
const DIST = 80;   // m
const EYE = 1.6;   // m
const MAX_W = 4096;

type Facing = 'E' | 'W' | 'N';
interface Plate {
  file: string;
  /** 焦距（mm，全片幅） */
  f: number;
  /** 地平線在照片中的位置（由上往下的比例） */
  horizon: number;
  flip?: boolean;
}
export type ViewKey = 'day' | 'night';

const VIEWS: Record<ViewKey, Record<Facing, Plate>> = {
  day: {
    E: { file: 'Taichung_old_city_center_Skyline_2013.jpg', f: 15, horizon: 0.547 },
    W: { file: 'Cityscape_in_West_District_of_Taichung.jpg', f: 24, horizon: 0.487 },
    N: { file: 'Cityscape_in_West_District_of_Taichung.jpg', f: 24, horizon: 0.487 },
  },
  night: {
    E: { file: 'Taichung_night_skyline_2013.jpg', f: 18, horizon: 0.62 },
    W: { file: 'Night_cityscape_in_West_District_of_Taichung_02.jpg', f: 12, horizon: 0.577 },
    N: { file: 'Night_cityscape_in_West_District_of_Taichung_02.jpg', f: 12, horizon: 0.577, flip: true },
  },
};

/**
 * 照片白色對應的亮度：白天沿用參考版單位（曝光 1.0），比室內亮一些；
 * 夜間以 cd/m² 計（曝光約 EV 5），燈光約數 cd/m²、夜空不到 1 cd/m²，比攝影師長曝的照片暗一點
 */
const BRIGHTNESS: Record<ViewKey, number> = { day: 1.3, night: 8 };

/** 霧面玻璃透光率（蝕刻／噴砂霧面玻璃約 0.7–0.85） */
const FROSTED_T = 0.8;

export class WindowView {
  readonly group = new THREE.Group();
  private readonly sets: Partial<Record<ViewKey, THREE.Group>> = {};
  /** 各方向照片的平均線性顏色（已乘上亮度），給霧面玻璃用 */
  private readonly average: Partial<Record<ViewKey, Record<Facing, THREE.Color>>> = {};

  constructor(scene: THREE.Scene) {
    this.group.name = 'window-view';
    this.group.visible = false;
    scene.add(this.group);
  }

  /** 載入照片並建好日夜兩組平面 */
  async load(baseUrl: string, anisotropy: number): Promise<void> {
    const loader = new THREE.ImageLoader();
    const cache = new Map<string, Promise<{ tex: THREE.Texture; avg: THREE.Color }>>();
    const get = (file: string) => {
      let p = cache.get(file);
      if (!p) cache.set(file, (p = loader.loadAsync(baseUrl + file).then((img) => prepare(img, anisotropy))));
      return p;
    };
    const [fx1, fy1, fx2, fy2] = site.floor, cx = X((fx1 + fx2) / 2), cz = Z((fy1 + fy2) / 2);
    for (const key of ['day', 'night'] as const) {
      const set = new THREE.Group();
      set.visible = false;
      this.group.add(set);
      this.sets[key] = set;
      const avg = {} as Record<Facing, THREE.Color>;
      for (const facing of ['E', 'W', 'N'] as const) {
        const plate = VIEWS[key][facing], { tex, avg: a } = await get(plate.file);
        const w = (DIST * 36) / plate.f, h = (DIST * 24) / plate.f;
        const geo = new THREE.PlaneGeometry(w, h);
        if (plate.flip) {
          const uv = geo.attributes.uv;
          for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
        }
        const mat = new THREE.MeshBasicMaterial({ map: tex, fog: false });
        mat.color.setScalar(BRIGHTNESS[key]);
        const me = new THREE.Mesh(geo, mat);
        // 地平線對到眼高：平面中心比眼高高出 (horizon − 0.5) × 高
        const y = EYE + (plate.horizon - 0.5) * h;
        // 平面正面朝向房子
        const [px, pz, yaw] = { E: [cx + DIST, cz, -Math.PI / 2], W: [cx - DIST, cz, Math.PI / 2], N: [cx, cz - DIST, 0] }[facing];
        me.position.set(px, y, pz);
        me.rotation.y = yaw;
        set.add(me);
        avg[facing] = a.clone().multiplyScalar(BRIGHTNESS[key]);
      }
      this.average[key] = avg;
    }
  }

  /** 漫遊（與拍環境探針）時才顯示 */
  show(key: ViewKey | null): void {
    this.group.visible = key !== null;
    for (const k of ['day', 'night'] as const) if (this.sets[k]) this.sets[k]!.visible = k === key;
  }

  /**
   * 霧面玻璃的發光亮度：完全漫射，亮度 ≈ 透光率 × 窗外平均亮度；out 為窗戶朝外方向（世界座標）。
   * 照片沒拍到的南面用三面平均。
   */
  frostedGlow(key: ViewKey, out: THREE.Vector3): THREE.Color | null {
    const a = this.average[key];
    if (!a) return null;
    const c = Math.abs(out.x) > Math.abs(out.z) ? (out.x > 0 ? a.E : a.W) : out.z < 0 ? a.N : a.E.clone().add(a.W).add(a.N).multiplyScalar(1 / 3);
    return c.clone().multiplyScalar(FROSTED_T);
  }
}

/** 縮到 4096 寬的貼圖，並算出平均線性顏色 */
function prepare(img: HTMLImageElement, anisotropy: number): { tex: THREE.Texture; avg: THREE.Color } {
  const s = Math.min(1, MAX_W / img.width);
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * s);
  c.height = Math.round(img.height * s);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  // 平均顏色：縮成 32 × 21 後轉線性再平均
  const t = document.createElement('canvas');
  t.width = 32;
  t.height = 21;
  const g = t.getContext('2d')!;
  g.drawImage(c, 0, 0, 32, 21);
  const d = g.getImageData(0, 0, 32, 21).data, avg = new THREE.Color(0, 0, 0), tmp = new THREE.Color();
  for (let i = 0; i < d.length; i += 4) avg.add(tmp.setRGB(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, THREE.SRGBColorSpace));
  avg.multiplyScalar(1 / (d.length / 4));
  return { tex, avg };
}
