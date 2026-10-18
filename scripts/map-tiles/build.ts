/** Cuts a world's BeautyRender images into the published webp tile pyramid. */
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { SOURCE_TILE, TILE, imageSizeOf, zMaxFor } from "../../src/lib/map/worlds";
import { childrenOf, levelTiles, sourceCut, sourceName, tileKey, type TileId } from "./pyramid";
import { clearVoid, dilate, featherMask, voidMask, type VoidCut } from "./void-mask";

export interface TileWorld {
  readonly key: string;
  readonly region: string;
  readonly grid: number;
}

export interface TileOptions {
  /** WorldMap/BeautyRender: one folder per region. */
  readonly sourceDir: string;
  /** public/map. */
  readonly outDir: string;
  readonly quality: number;
}

export interface TileSummary {
  readonly world: string;
  readonly tiles: number;
  readonly bytes: number;
  readonly skipped: boolean;
}

export class MapTilesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MapTilesError";
  }
}

interface SourceStamp {
  readonly name: string;
  readonly size: number;
  readonly mtimeMs: number;
}

type Level = ReadonlyMap<string, Buffer>;

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
/** Render pixels per void-mask cell. */
const MASK_SCALE = 4;
/** Smallest void region (in mask cells, 256×256 render pixels) cleared; smaller tan patches are content. */
const VOID_MIN_AREA = 4096;
/** The land edge fades out over this many mask cells (4 render pixels each), in FEATHER_STEPS flat levels. */
const FEATHER_RADIUS = 16;
const FEATHER_STEPS = 6;
/** Bumped when the void clearing or the edge fade changes, so unchanged sources still rebuild. */
const VOID_MASK_VERSION = 2;

type WorldVoid = Omit<VoidCut, "left" | "top">;

async function stampSources(world: TileWorld, sourceDir: string): Promise<SourceStamp[]> {
  const names = Array.from({ length: world.grid * world.grid }, (_, i) => sourceName(world.region, Math.floor(i / world.grid), i % world.grid));
  const missing = names.filter((name) => !existsSync(path.join(sourceDir, world.region, name)));
  if (missing.length > 0) throw new MapTilesError(`${world.region} 缺少地圖原圖：${missing.join("、")}`);
  return Promise.all(
    names.map(async (name) => {
      const info = await stat(path.join(sourceDir, world.region, name));
      return { name, size: info.size, mtimeMs: Math.round(info.mtimeMs) };
    }),
  );
}

async function sameSources(manifestPath: string, stamps: readonly SourceStamp[]): Promise<boolean> {
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { sources?: unknown; voidMask?: unknown };
    return manifest.voidMask === VOID_MASK_VERSION && JSON.stringify(manifest.sources) === JSON.stringify(stamps);
  } catch {
    return false;
  }
}

/** The void mask of a whole world, read from its sources shrunk by MASK_SCALE. */
async function worldVoid(world: TileWorld, sourceDir: string): Promise<WorldVoid> {
  const cell = SOURCE_TILE / MASK_SCALE;
  const width = world.grid * cell;
  const parts = [];
  for (let row = 0; row < world.grid; row += 1) {
    for (let col = 0; col < world.grid; col += 1) {
      const input = await sharp(path.join(sourceDir, world.region, sourceName(world.region, row, col))).resize(cell, cell).removeAlpha().png().toBuffer();
      parts.push({ input, left: col * cell, top: row * cell });
    }
  }
  const rgb = await sharp({ create: { width, height: width, channels: 3, background: { r: 0, g: 0, b: 0 } } }).composite(parts).removeAlpha().raw().toBuffer();
  const core = voidMask(new Uint8Array(rgb), width, width, VOID_MIN_AREA);
  return { core, fringe: dilate(core, width, width), feather: featherMask(core, width, width, FEATHER_RADIUS, FEATHER_STEPS), width, scale: MASK_SCALE };
}

async function cutSource(file: string, tiles: readonly TileId[], quality: number, cut: VoidCut): Promise<[string, Buffer][]> {
  const raw = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const info = raw.info;
  const data = clearVoid(new Uint8Array(raw.data), info.width, info.height, cut);
  return Promise.all(
    tiles.map(async (tile): Promise<[string, Buffer]> => {
      const { left, top } = sourceCut(tile);
      const webp = await sharp(data, { raw: info }).extract({ left, top, width: TILE, height: TILE }).webp({ quality }).toBuffer();
      return [tileKey(tile), webp];
    }),
  );
}

async function topLevel(world: TileWorld, options: TileOptions, imageSize: number, zMax: number): Promise<Level> {
  const mask = await worldVoid(world, options.sourceDir);
  const nameOf = (tile: TileId): string => {
    const cut = sourceCut(tile);
    return sourceName(world.region, cut.row, cut.col);
  };
  const tiles = levelTiles(imageSize, zMax, zMax);
  const names = [...new Set(tiles.map(nameOf))];
  const parts: [string, Buffer][][] = [];
  for (const name of names) {
    const own = tiles.filter((tile) => nameOf(tile) === name);
    const { row, col } = sourceCut(own[0]);
    const cut = { ...mask, left: col * SOURCE_TILE, top: row * SOURCE_TILE };
    parts.push(await cutSource(path.join(options.sourceDir, world.region, name), own, options.quality, cut));
  }
  return new Map(parts.flat());
}

async function downscale(children: Level, tile: TileId, quality: number): Promise<Buffer> {
  const parts = childrenOf(tile).flatMap(({ tile: child, left, top }) => {
    const input = children.get(tileKey(child));
    return input ? [{ input, left, top }] : [];
  });
  const square = await sharp({ create: { width: TILE * 2, height: TILE * 2, channels: 4, background: TRANSPARENT } })
    .composite(parts)
    .png()
    .toBuffer();
  return sharp(square).resize(TILE, TILE).webp({ quality }).toBuffer();
}

async function buildLevels(world: TileWorld, options: TileOptions, imageSize: number, zMax: number): Promise<Level[]> {
  const levels: Level[] = [await topLevel(world, options, imageSize, zMax)];
  for (let z = zMax - 1; z >= 0; z -= 1) {
    const children = levels[levels.length - 1];
    const tiles = levelTiles(imageSize, zMax, z);
    levels.push(new Map(await Promise.all(tiles.map(async (tile): Promise<[string, Buffer]> => [tileKey(tile), await downscale(children, tile, options.quality)]))));
  }
  return levels;
}

async function writeLevels(worldDir: string, levels: readonly Level[]): Promise<{ count: number; bytes: number }> {
  const tiles = levels.flatMap((level) => [...level]);
  for (const [key, buffer] of tiles) {
    const file = path.join(worldDir, ...key.split("/")) + ".webp";
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, buffer);
  }
  return { count: tiles.length, bytes: tiles.reduce((sum, [, buffer]) => sum + buffer.length, 0) };
}

export async function buildWorldTiles(world: TileWorld, options: TileOptions): Promise<TileSummary> {
  const stamps = await stampSources(world, options.sourceDir);
  const worldDir = path.join(options.outDir, world.key);
  const manifestPath = path.join(worldDir, "manifest.json");
  if (await sameSources(manifestPath, stamps)) return { world: world.key, tiles: 0, bytes: 0, skipped: true };
  const imageSize = imageSizeOf(world);
  const zMax = zMaxFor(imageSize);
  const levels = await buildLevels(world, options, imageSize, zMax);
  await rm(worldDir, { recursive: true, force: true });
  const written = await writeLevels(worldDir, levels);
  await writeFile(manifestPath, `${JSON.stringify({ imageSize, zMax, voidMask: VOID_MASK_VERSION, sources: stamps }, null, 2)}\n`, "utf8");
  return { world: world.key, tiles: written.count, bytes: written.bytes, skipped: false };
}
