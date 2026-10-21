import * as THREE from 'three';
import { X, Z } from '../core/units';
import type { ItemOf } from '../data/query';
import type { Build } from './prims';

/** 盆栽：圓柱花盆＋橢球葉叢（占位造型） */
export function plant(b: Build, it: ItemOf<'plant'>): void {
  const { mat } = b;
  const [x, y] = it.at;
  b.cyl(x, y, it.potR, 0, it.potH, mat.pot, { solid: true });
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(it.leafR, 14, 10), mat.plant);
  leaf.scale.set(1, it.leafSY, 1);
  leaf.position.set(X(x), it.leafY, Z(y));
  leaf.castShadow = true;
  b.root.add(leaf);
}

export function vase(b: Build, it: ItemOf<'vase'>): void {
  b.cyl(it.at[0], it.at[1], it.r, it.h[0], it.h[1], b.mat.ceramicBeige);
}

export function storageBox(b: Build, it: ItemOf<'storageBox'>): void {
  b.box(it.rect, 0, it.h, b.mat.kraft, { solid: true });
}
