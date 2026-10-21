import { walls, type Item, type ItemType, type Opening, type Wall } from './layout';

export type ItemOf<T extends ItemType> = Extract<Item, { type: T }>;

const openingIndex = new Map<string, { wall: Wall; opening: Opening }>();
for (const wall of walls) for (const opening of wall.openings ?? []) openingIndex.set(opening.id, { wall, opening });

/** 依開口 id 找到開口與所在的牆 */
export function findOpening(id: string): { wall: Wall; opening: Opening } {
  const hit = openingIndex.get(id);
  if (!hit) throw new Error(`layout：找不到開口 ${id}`);
  return hit;
}

export const isHorizontal = (w: Wall): boolean => w.a[1] === w.b[1];
