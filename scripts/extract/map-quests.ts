/**
 * Quest pins on the world map. A quest with spots in DT_QuestLocationDefinition gets a pin on each; any other quest
 * with a region joins one pin per area that lists the area's quests. Runs after the quests are read.
 */
import path from "node:path";
import { z } from "zod";
import { isInside, toBlocks, toImagePixel } from "../../shared/map/transform";
import { DATATABLES_DIR } from "./game-tables";
import { ExtractError, formatZodIssue, issue, type Issue } from "./issues";
import { publishedIcon, QUEST_ICONS } from "./map";
import { MARKER_KINDS, type MapData, type MapMarker, type WorldMap } from "../../shared/map-schema";
import type { Quest } from "../../shared/quest-schema";
import { readTableFile } from "./table-reader";

const TABLE = "DT_QuestLocationDefinition";
const TAG_PREFIX = "sw.questlocation.";
/** The persistent level every map world is drawn from; spots in other levels (caves, boss arenas) have no map. */
const MAP_LEVEL = "Overworld";
/** An area's main and side pins share its spot; they stand this far (render pixels) either side of it. */
const AREA_PIN_OFFSET = 16;
/** A quest's spots closer than this (render pixels) are one pin: the game often stacks a few on one spot. */
const MERGE_PX = 24;

const QuestLocationRow = z.object({
  Name: z.string(),
  QuestLocationData: z.object({
    Location: z.object({ X: z.number(), Y: z.number(), Z: z.number() }),
    Level: z.string(),
  }),
});
export type QuestLocationRowValue = z.infer<typeof QuestLocationRow>;

export interface QuestMarkersResult {
  readonly data: MapData;
  readonly issues: Issue[];
}

/** Reads the quest location table; empty when source-data has none (every quest then falls back to its area). */
export async function loadQuestLocations(sourceRoot: string): Promise<QuestLocationRowValue[]> {
  const file = path.join(sourceRoot, ...DATATABLES_DIR.split("/"), `${TABLE}.json`);
  const rows = await readTableFile(file, `資料表 ${TABLE}`);
  if (rows === undefined) return [];
  const parsed = z.array(QuestLocationRow).safeParse(rows);
  if (!parsed.success) {
    throw new ExtractError(`任務地點資料表欄位與預期不符（遊戲更新了格式？）：${parsed.error.issues.slice(0, 3).map(formatZodIssue).join("；")}`);
  }
  return parsed.data;
}

/** The quest a row is named after: the longest quest id (CA02_B over CA02) that starts its tag. */
export function questOfRow(rowName: string, quests: readonly Quest[]): Quest | undefined {
  const tag = rowName.toLowerCase();
  if (!tag.startsWith(TAG_PREFIX)) return undefined;
  const rest = `${tag.slice(TAG_PREFIX.length)}.`;
  const key = (quest: Quest) => `${quest.id.toLowerCase().replace(/_/g, ".")}.`;
  return quests.filter((quest) => rest.startsWith(key(quest))).sort((a, b) => key(b).length - key(a).length)[0];
}

interface Spot {
  readonly id: string;
  readonly quest: Quest;
  readonly world: WorldMap["key"];
  readonly px: number;
  readonly py: number;
}

const round1 = (value: number): number => Math.round(value * 10) / 10;
const near = (a: Spot, b: Spot): boolean => a.world === b.world && Math.hypot(a.px - b.px, a.py - b.py) < MERGE_PX;

function spotsOf(rows: readonly QuestLocationRowValue[], quests: readonly Quest[], worlds: readonly WorldMap[]): { spots: Spot[]; issues: Issue[] } {
  const found = rows.map((row) => {
    const quest = questOfRow(row.Name, quests);
    if (!quest) return { issues: [issue("quest-location-unmatched", row.Name)] };
    const block = toBlocks(row.QuestLocationData.Location);
    const world = row.QuestLocationData.Level === MAP_LEVEL ? worlds.find((each) => isInside(each.frame, block)) : undefined;
    if (!world) return { issues: [issue("quest-location-off-map", `${row.Name} (${row.QuestLocationData.Level})`)] };
    const { px, py } = toImagePixel(world.frame, block);
    return { spot: { id: row.Name, quest, world: world.key, px: round1(px), py: round1(py) } };
  });
  const all = found.flatMap((each) => ("spot" in each && each.spot ? [each.spot] : []));
  // Rows in table order; a spot next to an earlier one of the same quest adds nothing.
  const spots = all.filter((spot, index) => !all.slice(0, index).some((earlier) => earlier.quest.slug === spot.quest.slug && near(earlier, spot)));
  return { spots, issues: found.flatMap((each) => each.issues ?? []) };
}

const questLink = (quest: Quest) => ({ slug: quest.slug, title: quest.title.text });
const isMain = (quest: Quest): boolean => quest.type === "core";
const kindOf = (quest: Quest): "quest-main" | "quest-side" => (isMain(quest) ? "quest-main" : "quest-side");
const iconSourceOf = (quest: Quest): string => (isMain(quest) ? QUEST_ICONS.core : QUEST_ICONS.side);

function spotMarker(spot: Spot, icon: (source: string) => string | undefined): MapMarker {
  const iconPath = icon(iconSourceOf(spot.quest));
  const area = spot.quest.region?.name;
  return {
    id: `quest:${spot.id}`,
    kind: kindOf(spot.quest),
    px: spot.px,
    py: spot.py,
    name: spot.quest.title.text,
    ...(area ? { area } : {}),
    ...(iconPath ? { icon: iconPath } : {}),
    quests: [questLink(spot.quest)],
  };
}

/** One main and one side pin per area position for the quests with no spot of their own, each listing its quests in quest-list order. */
function areaMarkers(quests: readonly Quest[], world: WorldMap["key"], icon: (source: string) => string | undefined): MapMarker[] {
  const placed = quests.flatMap((quest) => (quest.region?.map?.world === world ? [{ quest, region: quest.region, map: quest.region.map }] : []));
  const positionOf = ({ map }: (typeof placed)[number]) => `${map.px},${map.py}`;
  const positions = [...new Set(placed.map(positionOf))];
  return positions.flatMap((position) => {
    const members = placed.filter((member) => positionOf(member) === position);
    // The base area (Desert.A1 rather than Desert.A1.FortressInt) names the pins.
    const [base] = [...members].sort((a, b) => a.region.areaId.length - b.region.areaId.length);
    const groups = [true, false].map((main) => ({ main, quests: members.filter(({ quest }) => isMain(quest) === main).map(({ quest }) => quest) })).filter((group) => group.quests.length > 0);
    return groups.map(({ main, quests: listed }) => {
      const iconPath = icon(main ? QUEST_ICONS.core : QUEST_ICONS.side);
      // Both kinds at one spot: main to the left, side to the right.
      const shift = groups.length === 2 ? (main ? -AREA_PIN_OFFSET : AREA_PIN_OFFSET) : 0;
      return {
        id: `quest-area:${base.region.areaId.toLowerCase()}:${main ? "main" : "side"}`,
        kind: main ? ("quest-main" as const) : ("quest-side" as const),
        px: round1(base.map.px + shift),
        py: base.map.py,
        name: base.region.name,
        ...(iconPath ? { icon: iconPath } : {}),
        quests: listed.map(questLink),
      };
    });
  });
}

const kindOrder = (marker: MapMarker): number => MARKER_KINDS.indexOf(marker.kind);
const byKindThenId = (a: MapMarker, b: MapMarker): number => kindOrder(a) - kindOrder(b) || a.id.localeCompare(b.id, "en");

/** The map with quest pins added to each world. */
export function addQuestMarkers(
  map: MapData,
  quests: readonly Quest[],
  rows: readonly QuestLocationRowValue[],
  iconExists: (relative: string) => boolean,
): QuestMarkersResult {
  const icon = (source: string) => (iconExists(source) ? publishedIcon(source) : undefined);
  const { spots, issues } = spotsOf(rows, quests, map.worlds);
  const withSpots = new Set(spots.map((spot) => spot.quest.slug));
  const rest = quests.filter((quest) => !withSpots.has(quest.slug));
  const worlds = map.worlds.map((world) => {
    const added = [...spots.filter((spot) => spot.world === world.key).map((spot) => spotMarker(spot, icon)), ...areaMarkers(rest, world.key, icon)];
    return { ...world, markers: [...world.markers, ...added].sort(byKindThenId) };
  });
  return { data: { ...map, worlds }, issues };
}
