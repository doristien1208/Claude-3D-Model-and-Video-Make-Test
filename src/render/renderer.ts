import * as THREE from 'three';

/** 即時預覽用的 renderer；WebGL 無法啟用時回傳 null */
export function createRenderer(container: HTMLElement): THREE.WebGLRenderer | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  // r147 的 PCFSoftShadowMap 已移除；PCFShadowMap 現在以 shadow.radius 控制柔邊
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.tabIndex = 0;
  return renderer;
}
