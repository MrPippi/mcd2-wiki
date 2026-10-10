/** The three worlds the game draws a top-down map for, as named in DT_WorldRegionMapData and the BeautyRender folders. */
export const WORLD_KEYS = ["overworld", "sift", "camp"] as const;
export type WorldKey = (typeof WORLD_KEYS)[number];

export interface WorldSource {
  readonly key: WorldKey;
  /** Row name in DT_WorldRegionMapData and folder name under WorldMap/BeautyRender. */
  readonly region: string;
  /** Source images per side: <Region>_<row>_<col>.png. */
  readonly grid: number;
  /** Key in Text/Release/WorldMapLabels.csv for the world's name. */
  readonly label: string;
}

export const WORLDS: readonly WorldSource[] = [
  { key: "overworld", region: "Overworld", grid: 8, label: "worldmap_dimension_overworld" },
  { key: "sift", region: "Sift", grid: 7, label: "worldmap_dimension_wellspring" },
  { key: "camp", region: "Camp", grid: 3, label: "worldmap_dimension_camp" },
];

/** Side of one BeautyRender source image. */
export const SOURCE_TILE = 1024;
/** Side of one published map tile. */
export const TILE = 256;

export const imageSizeOf = (world: Pick<WorldSource, "grid">): number => world.grid * SOURCE_TILE;

/** The zoom at which tiles show the render at full size. */
export const zMaxFor = (imageSize: number): number => Math.max(0, Math.ceil(Math.log2(imageSize / TILE)));
