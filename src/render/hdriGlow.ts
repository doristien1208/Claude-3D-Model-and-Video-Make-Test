import * as THREE from 'three';

/** 霧面玻璃透光率（蝕刻／噴砂霧面玻璃約 0.7–0.85） */
export const FROSTED_T = 0.8;

/**
 * 完全漫射的霧面玻璃，室內側的亮度 ≈ 透光率 × 窗外照度 / π，而照度 / π 就是窗外亮度在朝外半球上的 cos 加權平均。
 * 這裡直接對 HDRI（等距柱狀投影）積分；回傳線性亮度，與 scene.background 同單位（未乘 backgroundIntensity）。
 * rotationY 與 scene.backgroundRotation.y 相同；step 為取樣間隔（像素）。
 */
export function hemisphereMean(tex: THREE.Texture, out: THREE.Vector3, rotationY: number, step = 8): THREE.Color {
  const { data, width: W, height: H } = tex.image as { data: Uint16Array | Float32Array; width: number; height: number };
  const half = data instanceof Uint16Array;
  const get = (k: number) => (half ? THREE.DataUtils.fromHalfFloat(data[k]) : data[k]);
  // 背景取樣方向為 R_y(−rotation)·世界方向，先把朝外方向轉進 HDRI 的座標
  const n = out.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -rotationY).normalize();
  let r = 0, g = 0, bl = 0, w = 0;
  for (let j = step >> 1; j < H; j += step) {
    // 第 0 列是影像頂端（flipY 後 v = 1，朝上）；three.js equirectUv：u = atan(z, x) / 2π + 0.5，v = asin(y) / π + 0.5
    const lat = (0.5 - (j + 0.5) / H) * Math.PI, cl = Math.cos(lat), sy = Math.sin(lat);
    for (let i = step >> 1; i < W; i += step) {
      const phi = ((i + 0.5) / W - 0.5) * 2 * Math.PI;
      const c = n.x * cl * Math.cos(phi) + n.y * sy + n.z * cl * Math.sin(phi);
      if (c <= 0) continue;
      const k = (j * W + i) * 4, wt = c * cl; // cl：這一格的立體角
      r += get(k) * wt;
      g += get(k + 1) * wt;
      bl += get(k + 2) * wt;
      w += wt;
    }
  }
  return new THREE.Color(r / w, g / w, bl / w);
}
