import * as THREE from 'three';
import { X, Z } from '../core/units';
import { CEILING_H, probeZones, site } from '../data/layout';

/*
 * 燈只照亮所在的空間：夜間的燈沒有陰影（WebGL 每個著色器最多 16 張貼圖，二十幾盞燈放不下陰影圖），光會穿牆照到隔壁。
 * 依探針區把室內分成幾個光區（相通的客餐廳、走廊、玄關算同一區），每盞點光源、聚光燈、面光源只照它所在光區外框內的表面。
 * 外框往室內牆的另一側多留 3 cm 包住自己的牆面；靠外牆的一側延伸到牆外，讓窗框、窗台也照得到。
 * 判斷寫在 three.js 的燈光迴圈裡（依片段世界座標），燈的順序與 three.js 收集燈光的順序相同（場景前序走訪、只算看得到的燈）。
 */
const GROUPS: readonly (readonly string[])[] = [
  ['great', 'hall-guest', 'entry'], ['balcony'], ['mbath'], ['mbed'], ['study'], ['guest'], ['bath'], ['storage'],
];
const MARGIN = 3;   // px
const OUTSIDE = 30; // px：外牆側延伸到牆外

const POINT_LINE = 'getPointLightInfo( pointLight, geometryPosition, directLight );';
const SPOT_LINE = 'getSpotLightInfo( spotLight, geometryPosition, directLight );';
const RECT_CALL = 'RE_Direct_RectArea( rectAreaLight,';

export class LightMask {
  private readonly boxes: { min: THREE.Vector3; max: THREE.Vector3; group: number }[] = [];
  readonly uniforms = {
    lmBoxMin: { value: [] as THREE.Vector3[] },
    lmBoxMax: { value: [] as THREE.Vector3[] },
    lmBoxGroup: { value: [] as number[] },
    lmPoint: { value: [] as number[] },
    lmSpot: { value: [] as number[] },
    lmRect: { value: [] as number[] },
  };

  constructor() {
    const [fx1, fy1, fx2, fy2] = site.floor;
    const edge = (v: number, outer: number, dir: 1 | -1) => (Math.abs(v - outer) < 15 ? outer + dir * OUTSIDE : v + dir * MARGIN);
    for (const z of probeZones) {
      const group = GROUPS.findIndex((ids) => ids.includes(z.id));
      if (group < 0) continue;
      const [x1, y1, x2, y2] = z.rect;
      this.boxes.push({
        min: new THREE.Vector3(X(edge(x1, fx1, -1)), -0.1, Z(edge(y1, fy1, -1))),
        max: new THREE.Vector3(X(edge(x2, fx2, 1)), CEILING_H + 0.2, Z(edge(y2, fy2, 1))),
        group,
      });
    }
    this.uniforms.lmBoxMin.value = this.boxes.map((b) => b.min);
    this.uniforms.lmBoxMax.value = this.boxes.map((b) => b.max);
    this.uniforms.lmBoxGroup.value = this.boxes.map((b) => b.group);
  }

  /** 世界座標所在的光區；不在任何光區內傳回 −1（不受限） */
  groupAt(p: THREE.Vector3): number {
    const b = this.boxes.find((b) => p.x >= b.min.x && p.x <= b.max.x && p.z >= b.min.z && p.z <= b.max.z);
    return b ? b.group : -1;
  }

  /** 依 three.js 收集燈光的順序建立各類燈的光區；場景裡的燈增減或顯示狀態改變後要重叫 */
  update(scene: THREE.Scene): void {
    const point: number[] = [], spot: number[] = [], rect: number[] = [], p = new THREE.Vector3();
    scene.traverseVisible((o) => {
      const l = o as THREE.Light;
      if (!l.isLight) return;
      const g = this.groupAt(l.getWorldPosition(p));
      if ((l as THREE.PointLight).isPointLight) point.push(g);
      else if ((l as THREE.SpotLight).isSpotLight) spot.push(g);
      else if ((l as THREE.RectAreaLight).isRectAreaLight) rect.push(g);
    });
    this.uniforms.lmPoint.value = point;
    this.uniforms.lmSpot.value = spot;
    this.uniforms.lmRect.value = rect;
  }

  /** 給 onBeforeCompile 用：加上片段世界座標與光區判斷 */
  patch(shader: THREE.WebGLProgramParametersWithUniforms): void {
    Object.assign(shader.uniforms, this.uniforms);
    shader.vertexShader = 'varying vec3 vLmWorld;\n' + shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
	vec4 lmP = vec4( transformed, 1.0 );
	#ifdef USE_INSTANCING
	lmP = instanceMatrix * lmP;
	#endif
	vLmWorld = ( modelMatrix * lmP ).xyz;`,
    );
    const chunk = THREE.ShaderChunk.lights_fragment_begin;
    for (const s of [POINT_LINE, SPOT_LINE, RECT_CALL]) if (!chunk.includes(s)) console.warn('lightMask：three.js 著色器已變更，燈光遮罩未完整套用', s);
    const lights = chunk
      .replace(POINT_LINE, `${POINT_LINE}\n\t\tdirectLight.color *= lmOn( lmPoint[ i ] );`)
      .replace(SPOT_LINE, `${SPOT_LINE}\n\t\tdirectLight.color *= lmOn( lmSpot[ i ] );`)
      .replace(RECT_CALL, `if ( lmOn( lmRect[ i ] ) > 0.5 ) ${RECT_CALL}`);
    const n = this.boxes.length;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vLmWorld;
uniform vec3 lmBoxMin[ ${n} ];
uniform vec3 lmBoxMax[ ${n} ];
uniform int lmBoxGroup[ ${n} ];
#if NUM_POINT_LIGHTS > 0
uniform int lmPoint[ NUM_POINT_LIGHTS ];
#endif
#if NUM_SPOT_LIGHTS > 0
uniform int lmSpot[ NUM_SPOT_LIGHTS ];
#endif
#if NUM_RECT_AREA_LIGHTS > 0
uniform int lmRect[ NUM_RECT_AREA_LIGHTS ];
#endif
int lmFrag = 0;
float lmOn( int g ) { return ( g < 0 || ( ( lmFrag >> g ) & 1 ) == 1 ) ? 1.0 : 0.0; }`)
      .replace('#include <lights_fragment_begin>', `lmFrag = 0;
	for ( int k = 0; k < ${n}; k ++ ) {
		if ( all( greaterThanEqual( vLmWorld, lmBoxMin[ k ] ) ) && all( lessThanEqual( vLmWorld, lmBoxMax[ k ] ) ) ) lmFrag |= 1 << lmBoxGroup[ k ];
	}
${lights}`);
  }
}
