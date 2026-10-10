/** Tile arithmetic for the map pyramid: zMax holds the render at full size, each level below halves it. */
import { SOURCE_TILE, TILE } from "../../src/lib/map/worlds";

export interface TileId {
  readonly z: number;
  readonly x: number;
  readonly y: number;
}

const CUTS_PER_SOURCE = SOURCE_TILE / TILE;

export const levelSize = (imageSize: number, zMax: number, z: number): number => Math.ceil(imageSize / 2 ** (zMax - z));

export const tilesPerSide = (imageSize: number, zMax: number, z: number): number => Math.ceil(levelSize(imageSize, zMax, z) / TILE);

export function levelTiles(imageSize: number, zMax: number, z: number): TileId[] {
  const side = tilesPerSide(imageSize, zMax, z);
  return Array.from({ length: side * side }, (_, index) => ({ z, x: index % side, y: Math.floor(index / side) }));
}

export const childrenOf = (tile: TileId): { tile: TileId; left: number; top: number }[] =>
  [0, 1].flatMap((dy) =>
    [0, 1].map((dx) => ({ tile: { z: tile.z + 1, x: tile.x * 2 + dx, y: tile.y * 2 + dy }, left: dx * TILE, top: dy * TILE })),
  );

/** Which source image a top-level tile comes from, and where in it. */
export const sourceCut = (tile: TileId): { row: number; col: number; left: number; top: number } => ({
  row: Math.floor(tile.y / CUTS_PER_SOURCE),
  col: Math.floor(tile.x / CUTS_PER_SOURCE),
  left: (tile.x % CUTS_PER_SOURCE) * TILE,
  top: (tile.y % CUTS_PER_SOURCE) * TILE,
});

const pad2 = (value: number): string => String(value).padStart(2, "0");

export const sourceName = (region: string, row: number, col: number): string => `${region}_${pad2(row)}_${pad2(col)}.png`;

export const tileKey = (tile: TileId): string => `${tile.z}/${tile.x}/${tile.y}`;
