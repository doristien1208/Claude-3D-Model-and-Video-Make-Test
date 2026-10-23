import { items, lighting, type Item, type ItemType } from '../data/layout';
import type { ItemOf } from '../data/query';
import type { Materials } from '../materials/library';
import { buildArchitecture, type Architecture } from './architecture';
import * as bath from './bath';
import * as bedroom from './bedroom';
import { curtains } from './curtains';
import * as decor from './decor';
import { buildDoors, collectObstacles, type Doors } from './doors';
import * as fixtures from './fixtures';
import * as furniture from './furniture';
import * as millwork from './millwork';
import { Build } from './prims';
import { buildCoves } from './ceiling';
import { buildDevices } from './devices';
import { buildBaseboards } from './trim';
import { buildWindows } from './windows';

type Builder<T extends ItemType> = (b: Build, it: ItemOf<T>) => void;

/** 每種 layout 物件類型對應一個建構器；之後升級模型或換成 glTF 只要換這裡 */
const registry: { [T in ItemType]: Builder<T> } = {
  slatWall: millwork.slatWall,
  headboardPanel: bedroom.headboardPanel,
  shelf: millwork.shelf,
  cabinet: millwork.cabinet,
  kitchenRun: millwork.kitchenRun,
  island: millwork.island,
  wallShelf: millwork.wallShelf,
  bed: bedroom.bed,
  nightstand: bedroom.nightstand,
  rug: furniture.rug,
  curtains,
  desk: furniture.desk,
  officeChair: furniture.officeChair,
  sofaL: furniture.sofaL,
  coffeeTable: furniture.coffeeTable,
  armchair: furniture.armchair,
  barStool: furniture.barStool,
  bathtub: bath.bathtub,
  bathSpout: bath.bathSpout,
  showerValve: bath.showerValve,
  showerHead: bath.showerHead,
  linearDrain: bath.linearDrain,
  glassScreen: bath.glassScreen,
  toilet: bath.toilet,
  vanity: bath.vanity,
  towelBar: bath.towelBar,
  towelRolls: bath.towelRolls,
  paperHolder: bath.paperHolder,
  tray: bath.tray,
  bathAccessory: bath.bathAccessory,
  wallLamp: bedroom.wallLamp,
  deskLamp: fixtures.deskLamp,
  floorLamp: fixtures.floorLamp,
  pendant: fixtures.pendant,
  sconce: fixtures.sconce,
  tv: fixtures.tv,
  monitor: fixtures.monitor,
  fridge: fixtures.fridge,
  plant: decor.plant,
  vase: decor.vase,
  storageBox: decor.storageBox,
};

/** 把 from 之後新加入 root 的物件標上來源，供碰撞檢查與除錯辨識 */
function tagSince(b: Build, from: number, item: string): void {
  for (let i = from; i < b.root.children.length; i++) b.root.children[i].userData.item ??= item;
}

function buildItem(b: Build, it: Item): void {
  const from = b.root.children.length;
  (registry[it.type] as Builder<typeof it.type>)(b, it as never);
  tagSince(b, from, it.id);
}

export interface House extends Architecture {
  build: Build;
  doors: Doors;
}

export function buildHouse(materials: Materials): House {
  const b = new Build(materials);
  const arch = buildArchitecture(b);
  tagSince(b, 0, '牆體');
  let from = b.root.children.length;
  buildWindows(b, arch.ceiling);
  tagSince(b, from, '窗');
  for (const it of items) buildItem(b, it);
  from = b.root.children.length;
  fixtures.downlights(b, lighting.downlights);
  tagSince(b, from, '崁燈');
  from = b.root.children.length;
  buildBaseboards(b);
  tagSince(b, from, '踢腳板');
  from = b.root.children.length;
  buildCoves(b, arch.ceiling);
  buildDevices(b);
  tagSince(b, from, '開關插座');
  // 門最後建：全開角度依前面已建好的牆與家具決定
  const doors = buildDoors(b, collectObstacles(b.root));
  return { build: b, doors, ...arch };
}
