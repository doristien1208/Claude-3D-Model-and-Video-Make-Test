import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/*
 * 合併靜態物件：同一個容器裡、同一個材質（環境探針已依區域複製材質，所以等於「同區同材質」）、
 * 同樣陰影設定的不透明 mesh 合成一個，繪製呼叫從兩千多次降到幾百次。
 * 會動的東西不合併：userData.dynamic 的子樹（門扇、滑門、窗簾）、skip 裡的物件（鏡面、霧面玻璃、天花板群組）、
 * InstancedMesh、多材質、透明材質（要排序）。要在第一次渲染之前做（原本的幾何還沒上傳 GPU）。
 */
export function mergeStatic(container: THREE.Object3D, skip: ReadonlySet<THREE.Object3D>): { before: number; after: number } {
  container.updateMatrixWorld(true);
  const inv = container.matrixWorld.clone().invert();
  const groups = new Map<string, THREE.Mesh[]>();
  let before = 0;
  const visit = (o: THREE.Object3D) => {
    if (o !== container && (skip.has(o) || o.userData.dynamic || !o.visible)) return;
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && !(mesh as THREE.InstancedMesh).isInstancedMesh && !Array.isArray(mesh.material) && !mesh.material.transparent
      && !Object.keys(mesh.geometry.morphAttributes).length && mesh.onBeforeRender === THREE.Object3D.prototype.onBeforeRender) {
      before++;
      const key = `${mesh.material.uuid}|${mesh.castShadow}|${mesh.receiveShadow}|${mesh.renderOrder}`;
      const list = groups.get(key);
      if (list) list.push(mesh);
      else groups.set(key, [mesh]);
    }
    for (const c of o.children) visit(c);
  };
  visit(container);

  let after = 0;
  const m4 = new THREE.Matrix4();
  for (const list of groups.values()) {
    if (list.length < 2) { after++; continue; }
    // 只保留每個幾何都有的屬性；沒有索引的補連號索引（合併要求一致）
    const names = ['position', 'normal', 'uv', 'color'].filter((n) => list.every((me) => me.geometry.getAttribute(n)));
    const geos = list.map((me) => {
      const g = new THREE.BufferGeometry();
      for (const n of names) g.setAttribute(n, me.geometry.getAttribute(n).clone());
      const src = me.geometry.index;
      g.setIndex(src ? src.clone() : [...Array(g.attributes.position.count).keys()]);
      return g.applyMatrix4(m4.multiplyMatrices(inv, me.matrixWorld));
    });
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) { after += list.length; continue; }
    const first = list[0], out = new THREE.Mesh(merged, first.material);
    out.castShadow = first.castShadow;
    out.receiveShadow = first.receiveShadow;
    out.renderOrder = first.renderOrder;
    out.name = `merged:${(first.material as THREE.Material).name}`;
    container.add(out);
    for (const me of list) me.removeFromParent();
    after++;
  }
  return { before, after };
}
