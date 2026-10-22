import * as THREE from 'three';
import { X, Z } from '../core/units';
import { CEILING_H, probeZones } from '../data/layout';

/*
 * 每區一個環境反射探針（PMREMGenerator.fromScene，r186 可指定拍攝位置），
 * 加上箱型投影修正：反射方向先打到區域外框，再從探針位置去查環境圖，
 * 讓地板、檯面上映出的窗與門跟著視角正確移動（官方只有 WebGPU 版 webgpu_materials_envmaps_bpcem，這裡以 onBeforeCompile 修改 r186 的 WebGL 著色器）。
 * 日夜各拍一組並快取；門、窗簾移動時不重拍。
 */
const SIZE = 256;
const EYE = 1.4;
const RADIANCE_LINE = 'reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );';

const BP_PARS = /* glsl */`
varying vec3 vBpWorld;
uniform vec3 bpMin;
uniform vec3 bpMax;
uniform vec3 bpProbe;
vec3 bpCorrect( vec3 v ) {
	vec3 p = vBpWorld;
	// 物件在區域外（例如外牆上的窗框）就不修正
	if ( any( lessThan( p, bpMin - 0.05 ) ) || any( greaterThan( p, bpMax + 0.05 ) ) ) return v;
	vec3 d = normalize( v );
	vec3 t = max( ( bpMax - p ) / d, ( bpMin - p ) / d );
	float f = min( min( t.x, t.y ), t.z );
	return p + d * f - bpProbe;
}
`;

interface Zone {
  id: string;
  box: THREE.Box3;
  probe: THREE.Vector3;
  materials: THREE.MeshStandardMaterial[];
  cache: Map<string, THREE.WebGLRenderTarget>;
}

function patch(m: THREE.MeshStandardMaterial, z: Zone): void {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.bpMin = { value: z.box.min };
    shader.uniforms.bpMax = { value: z.box.max };
    shader.uniforms.bpProbe = { value: z.probe };
    shader.vertexShader = 'varying vec3 vBpWorld;\n' + shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      '#include <worldpos_vertex>\n#ifdef USE_ENVMAP\n\tvBpWorld = worldPosition.xyz;\n#endif',
    );
    const chunk = THREE.ShaderChunk.envmap_physical_pars_fragment;
    if (!chunk.includes(RADIANCE_LINE)) console.warn('envProbes：three.js 著色器已變更，箱型投影未套用');
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <envmap_physical_pars_fragment>',
      BP_PARS + chunk.replace(RADIANCE_LINE, `${RADIANCE_LINE}\n\t\t\treflectVec = bpCorrect( reflectVec );`),
    );
  };
  m.customProgramCacheKey = () => 'bpcem';
}

export class EnvProbes {
  private readonly zones: Zone[];
  private readonly pmrem: THREE.PMREMGenerator;
  private readonly scene: THREE.Scene;

  /** exclude：執行期間會被整體修改的共用材質（例如日夜切換的發光材質），不複製 */
  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, root: THREE.Object3D, exclude: ReadonlySet<THREE.Material>) {
    this.scene = scene;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.zones = probeZones.map(({ id, rect: [x1, y1, x2, y2], probe }) => {
      const box = new THREE.Box3(new THREE.Vector3(X(x1), 0, Z(y1)), new THREE.Vector3(X(x2), CEILING_H, Z(y2)));
      const [px, py] = probe ?? [(x1 + x2) / 2, (y1 + y2) / 2];
      return { id, box, probe: new THREE.Vector3(X(px), EYE, Z(py)), materials: [], cache: new Map() };
    });

    // 依物件中心決定屬於哪一區（不在任何區內就取最近的一區），每區複製一份材質
    root.updateMatrixWorld(true);
    const clones = new Map<Zone, Map<THREE.Material, THREE.MeshStandardMaterial>>();
    const bb = new THREE.Box3(), c = new THREE.Vector3();
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      const m = mesh.material as THREE.MeshStandardMaterial;
      if (!m.isMeshStandardMaterial || exclude.has(m)) return;
      bb.setFromObject(mesh).getCenter(c);
      const zone = this.zoneAt(c);
      let map = clones.get(zone);
      if (!map) clones.set(zone, (map = new Map()));
      let cm = map.get(m);
      if (!cm) {
        cm = m.clone();
        patch(cm, zone);
        zone.materials.push(cm);
        map.set(m, cm);
      }
      mesh.material = cm;
    });
  }

  private zoneAt(p: THREE.Vector3): Zone {
    let best = this.zones[0], bestD = Infinity;
    for (const z of this.zones) {
      const d = z.box.distanceToPoint(p);
      if (d < bestD) { best = z; bestD = d; }
    }
    return best;
  }

  /**
   * 拍（或從快取取出）一組探針並套用。prepare 負責把場景切到漫遊狀態（天花板顯示、不剖切、隱藏鏡面），回傳還原函式。
   */
  apply(key: string, prepare: () => () => void): void {
    if (this.zones.some((z) => !z.cache.has(key))) {
      // 拍攝時先拿掉所有反射圖，避免把另一組（例如白天）的反射拍進去
      for (const z of this.zones) for (const m of z.materials) this.setEnv(m, null);
      const restore = prepare();
      for (const z of this.zones) {
        if (!z.cache.has(key)) z.cache.set(key, this.pmrem.fromScene(this.scene, 0, 0.05, 30, { size: SIZE, position: z.probe }));
      }
      restore();
    }
    for (const z of this.zones) {
      const tex = z.cache.get(key)!.texture;
      for (const m of z.materials) this.setEnv(m, tex);
    }
  }

  private setEnv(m: THREE.MeshStandardMaterial, tex: THREE.Texture | null): void {
    if (m.envMap === tex) return;
    m.envMap = tex;
    m.needsUpdate = true;
  }

  /** 丟掉快取（例如換了窗外 HDRI 之後要重拍） */
  invalidate(): void {
    for (const z of this.zones) {
      for (const rt of z.cache.values()) rt.dispose();
      z.cache.clear();
    }
  }
}
