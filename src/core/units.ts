/* 平面 px → 世界公尺（Y 軸朝上）。100 px = 1 m，原點在外廓西北角 (70, 125)。 */

export const PX = 100;
export const ORIGIN_X = 70;
export const ORIGIN_Y = 125;

export const X = (x: number): number => (x - ORIGIN_X) / PX;
export const Z = (y: number): number => (y - ORIGIN_Y) / PX;

/** 世界公尺 → 平面 px */
export const toPxX = (x: number): number => x * PX + ORIGIN_X;
export const toPxY = (z: number): number => z * PX + ORIGIN_Y;
