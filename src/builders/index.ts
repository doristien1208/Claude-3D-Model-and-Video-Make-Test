import { items, lighting, type Item, type ItemType } from '../data/layout';
import type { ItemOf } from '../data/query';
import type { Materials } from '../materials/library';
import { buildArchitecture, type Architecture } from './architecture';
import * as decor from './decor';
import * as fixtures from './fixtures';
import * as furniture from './furniture';
import * as millwork from './millwork';
import { Build } from './prims';

type Builder<T extends ItemType> = (b: Build, it: ItemOf<T>) => void;

/** 每種 layout 物件類型對應一個建構器；之後升級模型或換成 glTF 只要換這裡 */
const registry: { [T in ItemType]: Builder<T> } = {
  slatWall: millwork.slatWall,
  headboardPanel: millwork.headboardPanel,
  shelf: millwork.shelf,
  cabinet: millwork.cabinet,
  kitchenRun: millwork.kitchenRun,
  island: millwork.island,
  tvCabinet: millwork.tvCabinet,
  shoeCabinet: millwork.shoeCabinet,
  wallShelf: millwork.wallShelf,
  bed: furniture.bed,
  nightstand: furniture.nightstand,
  rug: furniture.rug,
  curtains: furniture.curtains,
  desk: furniture.desk,
  officeChair: furniture.officeChair,
  sofaL: furniture.sofaL,
  coffeeTable: furniture.coffeeTable,
  armchair: furniture.armchair,
  barStool: furniture.barStool,
  bathtub: fixtures.bathtub,
  showerValve: fixtures.showerValve,
  showerHead: fixtures.showerHead,
  glassScreen: fixtures.glassScreen,
  toilet: fixtures.toilet,
  vanity: fixtures.vanity,
  towelBar: fixtures.towelBar,
  wallLamp: fixtures.wallLamp,
  deskLamp: fixtures.deskLamp,
  floorLamp: fixtures.floorLamp,
  pendant: fixtures.pendant,
  sconce: fixtures.sconce,
  tv: fixtures.tv,
  monitor: fixtures.monitor,
  plant: decor.plant,
  vase: decor.vase,
  storageBox: decor.storageBox,
};

function buildItem(b: Build, it: Item): void {
  (registry[it.type] as Builder<typeof it.type>)(b, it as never);
}

export interface House extends Architecture {
  build: Build;
}

export function buildHouse(materials: Materials): House {
  const b = new Build(materials);
  const arch = buildArchitecture(b);
  for (const it of items) buildItem(b, it);
  fixtures.downlights(b, lighting.downlights);
  return { build: b, ...arch };
}
