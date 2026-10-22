import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const ORBIT_FOV = 55;
const TARGET = new THREE.Vector3(5.125, 0.6, 5.8);

/** 俯瞰：從東南上方看整間屋子 */
export function createOrbit(camera: THREE.PerspectiveCamera, dom: HTMLElement) {
  const orbit = new OrbitControls(camera, dom);
  orbit.target.copy(TARGET);
  orbit.enableDamping = true;
  orbit.maxPolarAngle = 1.42;
  orbit.minDistance = 3;
  orbit.maxDistance = 30;
  camera.position.set(TARGET.x + 7, 13.5, TARGET.z + 11);
  orbit.update();
  const home = { p: camera.position.clone(), t: orbit.target.clone() };

  return {
    orbit,
    goHome(): void {
      camera.fov = ORBIT_FOV;
      camera.position.copy(home.p);
      orbit.target.copy(home.t);
      orbit.update();
    },
  };
}
