/**
 * Pins from the game's level data: Soul Storm generator slots, talisman chests and dungeon doors. The positions come
 * from source-data/MapSpots/map-spots.json, which scripts/map-spots writes once from the raw export (see docs/MAINTAINING.md).
 */
import path from "node:path";
import { z } from "zod";
import { isInside, toBlocks, toImagePixel } from "../../src/lib/map/transform";
import { entryIndex, locId } from "./game-rows";
import type { GuideTables } from "./guides-tables";
import { ExtractError, formatZodIssue, issue, type Issue } from "./issues";
import { publishedIcon, SPOT_ICONS } from "./map";
import { MARKER_KINDS, type MapData, type MapMarker, type WorldMap } from "./map-schema";
import { readJsonFile } from "./read-json";
import type { Entry, Localized } from "./schemas";

const SPOTS_FILE = ["MapSpots", "map-spots.json"] as const;
const CHEST_PREFIX = "sw.lootactor.talismanschest.";
/** The area a dungeon doorway belongs to: SW.Doorway.PlainsA2.Dungeon.5 and SW.Doorway.Dungeon.CarapaceA1.Dungeons.2. */
const DOORWAY_AREA = /([A-Z][a-z]+)A(\d+)/;

const Cm = { x: z.number(), y: z.number() };
const MapSpotsSchema = z.object({
  storm: z.array(z.object({ area: z.string(), slot: z.number().int(), ...Cm })),
  talismanChests: z.array(z.object({ chest: z.string(), ...Cm })),
  dungeons: z.array(z.object({ doorway: z.string(), size: z.enum(["Small", "Medium", "Large"]), ...Cm })),
});
export type MapSpotsData = z.infer<typeof MapSpotsSchema>;

/** Reads the spots file; undefined when source-data has none (the three kinds are then left off the map). */
export async function loadMapSpots(sourceRoot: string): Promise<MapSpotsData | undefined> {
  const rows = await readJsonFile(path.join(sourceRoot, ...SPOTS_FILE), "地圖點位 map-spots.json");
  if (rows === undefined) return undefined;
  const parsed = MapSpotsSchema.safeParse(rows);
  if (!parsed.success) {
    throw new ExtractError(`地圖點位檔欄位與預期不符（重跑 scripts/map-spots？）：${parsed.error.issues.slice(0, 3).map(formatZodIssue).join("；")}`);
  }
  return parsed.data;
}

const lower = (text: string): string => text.toLowerCase();

/** The talisman each chest holds, by lower-case chest name: the TalismansChest loot row whose one guaranteed drop is the item. */
export function chestTalismans(tables: Pick<GuideTables, "lootActor" | "talismans">, entries: readonly Entry[]): ReadonlyMap<string, Entry> {
  const find = entryIndex(entries);
  const pairs = tables.lootActor
    .filter((row) => lower(row.TypeTag.TagName).startsWith(CHEST_PREFIX))
    .flatMap((row) => {
      const slot = Object.values(row.LootDropDefinition.LootSlots ?? {}).find((one) => one.NumberOfGuaranteedDrops >= 1 && (one.DropTable.Tags ?? []).length === 1);
      const itemTag = slot?.DropTable.Tags?.[0]?.TypeTag.TagName;
      const item = itemTag ? tables.talismans.find((candidate) => lower(candidate.TypeTag.TagName) === lower(itemTag)) : undefined;
      const entry = item ? find("talisman", locId(item.TypeTextData)) : undefined;
      return entry ? [[lower(row.TypeTag.TagName.slice(CHEST_PREFIX.length)), entry] as const] : [];
    });
  return new Map(pairs);
}

export interface SpotInput {
  readonly spots: MapSpotsData;
  readonly areaName: (tag: string) => Localized | undefined;
  /** Lower-case chest name (SpeedIncrement -> speedincrement) to its talisman. */
  readonly talismans: ReadonlyMap<string, Entry>;
  readonly iconExists: (relative: string) => boolean;
}

export interface SpotMarkersResult {
  readonly data: MapData;
  readonly issues: Issue[];
}

interface Spot {
  readonly marker: Omit<MapMarker, "px" | "py">;
  readonly x: number;
  readonly y: number;
}

const round1 = (value: number): number => Math.round(value * 10) / 10;
const kindOrder = (marker: MapMarker): number => MARKER_KINDS.indexOf(marker.kind);
const byKindThenId = (a: MapMarker, b: MapMarker): number => kindOrder(a) - kindOrder(b) || a.id.localeCompare(b.id, "en");
const unnamed = (what: string, detail: string): { issues: Issue[] } => ({ issues: [issue("map-spot-unnamed", `${what}: ${detail}`)] });

const doorwayArea = (doorway: string): string | undefined => {
  const match = DOORWAY_AREA.exec(doorway);
  return match ? `SW.Area.${match[1]}.A${match[2]}` : undefined;
};

type Built = { spot?: Spot; issues?: Issue[] };

function stormSpots(input: SpotInput, icon: string | undefined): Built[] {
  return input.spots.storm.map((slot) => {
    const name = input.areaName(slot.area);
    if (!name) return unnamed("storm", slot.area);
    const marker = { id: `storm:${lower(slot.area)}:${slot.slot}`, kind: "storm" as const, name, ...(icon ? { icon } : {}) };
    return { spot: { marker, x: slot.x, y: slot.y } };
  });
}

function chestSpots(input: SpotInput, icon: string | undefined): Built[] {
  return input.spots.talismanChests.map((chest) => {
    const talisman = input.talismans.get(lower(chest.chest));
    if (!talisman) return { issues: [issue("map-chest-unlinked", chest.chest)] };
    const marker = {
      id: `talisman-chest:${lower(chest.chest)}`,
      kind: "talisman-chest" as const,
      name: talisman.name,
      entry: { category: talisman.category, slug: talisman.slug },
      ...(icon ? { icon } : {}),
    };
    return { spot: { marker, x: chest.x, y: chest.y } };
  });
}

function dungeonSpots(input: SpotInput, icon: string | undefined): Built[] {
  return input.spots.dungeons.map((door) => {
    const area = doorwayArea(door.doorway);
    const name = area ? input.areaName(area) : undefined;
    if (!name) return unnamed("dungeon", door.doorway);
    const marker = { id: `dungeon:${lower(door.doorway)}`, kind: "dungeon" as const, name, ...(icon ? { icon } : {}) };
    return { spot: { marker, x: door.x, y: door.y } };
  });
}

/** The map with the level-data pins added to the world each one falls in. */
export function addSpotMarkers(map: MapData, input: SpotInput): SpotMarkersResult {
  const icon = (source: string) => (input.iconExists(source) ? publishedIcon(source) : undefined);
  const built = [...stormSpots(input, icon(SPOT_ICONS.storm)), ...chestSpots(input, icon(SPOT_ICONS.chest)), ...dungeonSpots(input, icon(SPOT_ICONS.dungeon))];
  const spots = built.flatMap((one) => (one.spot ? [one.spot] : []));
  const placed = spots.map((spot) => {
    const block = toBlocks({ X: spot.x, Y: spot.y });
    return { spot, block, world: map.worlds.find((each) => isInside(each.frame, block)) };
  });
  const worlds = map.worlds.map((world: WorldMap) => {
    const added = placed
      .filter((each) => each.world?.key === world.key)
      .map(({ spot, block }): MapMarker => {
        const { px, py } = toImagePixel(world.frame, block);
        return { ...spot.marker, px: round1(px), py: round1(py) };
      });
    return { ...world, markers: [...world.markers, ...added].sort(byKindThenId) };
  });
  return {
    data: { ...map, worlds },
    issues: [...built.flatMap((one) => one.issues ?? []), ...placed.filter((each) => !each.world).map((each) => issue("map-spot-off-map", each.spot.marker.id))],
  };
}
