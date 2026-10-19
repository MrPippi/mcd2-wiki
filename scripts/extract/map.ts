/** World map markers from the game's DataTables: minecart stations, rifts, the teleport statue, merchants, area names. */
import path from "node:path";
import { isInside, toBlocks, toImagePixel, type BlockPoint, type WorldFrame } from "../../shared/map/transform";
import { WORLDS, imageSizeOf, zMaxFor, type WorldSource } from "../../shared/map/worlds";
import { localizedFrom } from "../../shared/lang";
import type { Lang } from "../../shared/config";
import { issue, type Issue } from "./issues";
import { gameText } from "./game-text";
import { locRef } from "./loc-table";
import { MARKER_KINDS, type MapData, type MapMarker, type MarkerKind, type WorldMap } from "../../shared/map-schema";
import type { AreaRowValue, MapTables, TeleportRowValue } from "./map-tables";
import type { LocaleFile, Localized } from "../../shared/schemas";

type Locales = Readonly<Record<Lang, LocaleFile>>;

export interface MapIcon {
  readonly from: string;
  readonly published: string;
}

export interface MapResult {
  readonly data: MapData;
  readonly icons: MapIcon[];
  readonly issues: Issue[];
  /** An area tag's name in every language, for the markers added after the tables are read. */
  readonly areaName: (tag: string) => Localized | undefined;
}

const WORLD_LABELS = "Text/Release/WorldMapLabels.csv";
const SETTINGS_LABELS = "Text/Release/SettingsLabels.csv";
const PORTAL_ID = "sw.teleportpoint.townportal.portallocation";
const RIFT_ID = /\.rifts\.\d+$/i;
const NAME_TEXT = /SW\.TextEntry\.Name/;
const AREA_ICON_DIR = "Assets/UI/Icons/Location/AreaIcons";
const PORTAL_ICON = `${AREA_ICON_DIR}/T_UI_Icon_Town_Portal.png`;
const WORLD_MAP_ICON_DIR = "Plugins/SpicewoodUI/Content/Spicewood/UI/Texture/WorldMap/Icons";
const MINECART_ICON = "Plugins/SpicewoodUI/Content/Spicewood/UI/Texture/Minimap/Icons/T_UI_Icon_Minecart.png";
const RIFT_ICON = `${WORLD_MAP_ICON_DIR}/T_UI_Icon_Rift.png`;
const MERCHANT_ICON = `${WORLD_MAP_ICON_DIR}/T_UI_Icon_VillageMerchant.png`;
const MINIMAP_ICON_DIR = "Plugins/SpicewoodUI/Content/Spicewood/UI/Texture/Minimap/Icons";
/** Quest pins: the game's core (gold) and side (blue) quest-giver icons. */
export const QUEST_ICONS = {
  core: `${MINIMAP_ICON_DIR}/T_UI_Icon_CoreQuestGiver_Minimap.png`,
  side: `${MINIMAP_ICON_DIR}/T_UI_Icon_SideQuestGiver_Minimap.png`,
} as const;
/** Pins from the level data (storm generator slots, talisman chests, dungeon doors), added after the tables are read. */
export const SPOT_ICONS = {
  storm: `${WORLD_MAP_ICON_DIR}/T_UI_Icon_Storminator.png`,
  chest: `${WORLD_MAP_ICON_DIR}/T_UI_Icon_Chest.png`,
  dungeon: `${WORLD_MAP_ICON_DIR}/T_UI_Icon_Dungeon_LV1.png`,
} as const;
/** DT_MerchantLocationsDefinition MarkerType → icon. */
const MERCHANT_ICONS: Readonly<Record<string, string>> = {
  Merchant: MERCHANT_ICON,
  Enchantsmith: `${WORLD_MAP_ICON_DIR}/T_UI_Icon_Enchantsmith.png`,
  Blacksmith: `${WORLD_MAP_ICON_DIR}/T_UI_Icon_Blacksmith.png`,
};
/** Icon source per kind for the filter swatches; the area kind has none. */
const LEGEND_SOURCES: Readonly<Record<string, string>> = {
  minecart: MINECART_ICON,
  rift: RIFT_ICON,
  portal: PORTAL_ICON,
  merchant: MERCHANT_ICON,
  "quest-main": QUEST_ICONS.core,
  "quest-side": QUEST_ICONS.side,
  storm: SPOT_ICONS.storm,
  "talisman-chest": SPOT_ICONS.chest,
  dungeon: SPOT_ICONS.dungeon,
};

/** A point found in the tables, before it is placed in a world. */
interface Candidate {
  readonly id: string;
  readonly kind: "minecart" | "rift" | "portal" | "merchant";
  readonly block: BlockPoint;
  readonly areaTag?: string;
  readonly name: Localized;
  readonly area?: Localized;
  readonly note?: Localized;
  readonly iconSource?: string;
}

interface Gathered {
  readonly candidates: Candidate[];
  readonly issues: Issue[];
}

interface Context {
  readonly text: (namespace: string, key: string) => Localized | undefined;
  readonly loc: (text: string) => Localized | undefined;
  readonly areaName: (tag: string) => Localized | undefined;
  /** Map texts read so far that show English in some language (spec §1.2.2: fallbacks must be visible). */
  readonly fallbackIssues: () => Issue[];
}

interface Frame {
  readonly world: WorldSource;
  readonly frame: WorldFrame;
  readonly name: Localized;
}

const lower = (text: string): string => text.toLowerCase();
const round1 = (value: number): number => Math.round(value * 10) / 10;
const kindOrder = (kind: MarkerKind): number => MARKER_KINDS.indexOf(kind);
const optional = <K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> =>
  value === undefined ? {} : ({ [key]: value } as Record<K, V>);

function makeContext(tables: MapTables, locales: Locales): Context {
  const areas = new Map<string, AreaRowValue>(tables.areas.map((row) => [lower(row.TypeTag.TagName), row]));
  // Every text the map reads, by namespace and key, so English fallbacks can be reported once each.
  const used = new Map<string, { namespace: string; key: string }>();
  const text = (namespace: string, key: string) => {
    used.set(`${namespace} ${key}`, { namespace, key });
    return gameText(locales, namespace, key)?.text;
  };
  const fallbackIssues = (): Issue[] =>
    [...used.values()].flatMap(({ namespace, key }) => {
      const langs = gameText(locales, namespace, key)?.untranslated ?? [];
      return langs.length ? [issue("map-text-fallback", `${namespace} ${key}: ${langs.join(", ")}`)] : [];
    });
  const loc = (value: string) => {
    const ref = locRef(value);
    return ref ? text(ref.namespace, ref.key) : undefined;
  };
  const areaName = (tag: string) => {
    const texts = Object.entries(areas.get(lower(tag))?.TypeTextData?.Texts ?? {});
    const name = texts.find(([key]) => NAME_TEXT.test(key))?.[1].Text;
    return name ? loc(name) : undefined;
  };
  return { text, loc, areaName, fallbackIssues };
}

function worldFrames(tables: MapTables, ctx: Context): { frames: Frame[]; issues: Issue[] } {
  const found = WORLDS.map((world) => ({ world, row: tables.regions.find((row) => row.Name === world.region) }));
  return {
    frames: found.flatMap(({ world, row }) => {
      if (!row) return [];
      const { MinPos, MaxPos, MapDims } = row.RegionData.Bounds;
      const frame: WorldFrame = {
        minX: MinPos.X,
        maxX: MaxPos.X,
        minY: MinPos.Y,
        maxY: MaxPos.Y,
        span: MapDims.X,
        ratio: row.RegionData.FancyMapSizeRatio.X,
        imageSize: imageSizeOf(world),
      };
      return [{ world, frame, name: ctx.text(WORLD_LABELS, world.label) ?? localizedFrom(() => world.region) }];
    }),
    issues: found.filter(({ row }) => !row).map(({ world }) => issue("missing-map-tables", `DT_WorldRegionMapData › ${world.region}`)),
  };
}

const placed = (
  candidate: Omit<Candidate, "name">,
  name: Localized | undefined,
): Gathered => (name ? { candidates: [{ ...candidate, name }], issues: [] } : { candidates: [], issues: [issue("map-missing-name", `${candidate.kind}:${candidate.id}`)] });

const merge = (parts: readonly Gathered[]): Gathered => ({
  candidates: parts.flatMap((part) => part.candidates),
  issues: parts.flatMap((part) => part.issues),
});

function minecarts(tables: MapTables, ctx: Context): Gathered {
  // Many real stations only exist as Debug rows; when a tag repeats, the non-Debug row wins (it is inserted last).
  const debugFirst = [...tables.teleports].sort((a, b) => Number(b.Type === "Debug") - Number(a.Type === "Debug"));
  const byId = new Map<string, TeleportRowValue>(debugFirst.map((row) => [lower(row.IdTag.TagName), row]));
  return merge(
    tables.exploration.filter((row) => !/^test/i.test(row.Name)).map((row) => {
      const point = byId.get(lower(row.TeleportTag.TagName));
      if (!point) return { candidates: [], issues: [issue("map-unmatched-tag", `${row.Name} → ${row.TeleportTag.TagName}`)] };
      const areaTag = point.AreaTag.TagName;
      return placed({ id: row.Name, kind: "minecart", block: toBlocks(point.Location), areaTag, iconSource: MINECART_ICON }, ctx.areaName(areaTag));
    }),
  );
}

function rifts(tables: MapTables, ctx: Context): Gathered {
  const note = ctx.text(WORLD_LABELS, "worldmap_tooltip_description_rift");
  return merge(
    tables.teleports
      .filter((row) => row.Type === "Area" && RIFT_ID.test(row.IdTag.TagName))
      .map((row) => {
        const areaTag = row.AreaTag.TagName;
        const base = { id: row.Name, kind: "rift" as const, block: toBlocks(row.Location), areaTag, iconSource: RIFT_ICON };
        return placed({ ...base, ...optional("area", ctx.areaName(areaTag)), ...optional("note", note) }, ctx.text(WORLD_LABELS, "worldmap_tooltip_title_rift"));
      }),
  );
}

function portals(tables: MapTables, ctx: Context): Gathered {
  return merge(
    tables.teleports
      .filter((row) => lower(row.IdTag.TagName) === PORTAL_ID)
      .map((row) => {
        const areaTag = row.AreaTag.TagName;
        const base = { id: row.Name, kind: "portal" as const, block: toBlocks(row.Location), areaTag, iconSource: PORTAL_ICON };
        return placed({ ...base, ...optional("area", ctx.areaName(areaTag)) }, ctx.text(SETTINGS_LABELS, "Input_TownPortal"));
      }),
  );
}

function merchants(tables: MapTables, ctx: Context): Gathered {
  return merge(
    tables.merchants.map((row) =>
      placed(
        {
          id: row.Name,
          kind: "merchant",
          block: toBlocks(row.Location),
          ...optional("note", ctx.loc(row.MerchantDescription)),
          ...optional("iconSource", row.MarkerType === undefined ? undefined : MERCHANT_ICONS[row.MarkerType]),
        },
        ctx.loc(row.MerchantName),
      ),
    ),
  );
}

export const publishedIcon = (source: string): string => `icons/map/${path.posix.basename(source).toLowerCase()}`;

function toMarker(candidate: Candidate, frame: WorldFrame, iconExists: (relative: string) => boolean): MapMarker {
  const { px, py } = toImagePixel(frame, candidate.block);
  const icon = candidate.iconSource && iconExists(candidate.iconSource) ? publishedIcon(candidate.iconSource) : undefined;
  return {
    id: candidate.id,
    kind: candidate.kind,
    px: round1(px),
    py: round1(py),
    name: candidate.name,
    ...optional("area", candidate.area),
    ...optional("note", candidate.note),
    ...optional("icon", icon),
  };
}

/** Area names as text labels (no icon: the site keeps them quieter than the pins). */
function areaLabels(points: readonly { candidate: Candidate; marker: MapMarker }[], ctx: Context): MapMarker[] {
  const tags = [...new Set(points.flatMap(({ candidate }) => (candidate.areaTag ? [lower(candidate.areaTag)] : [])))];
  return tags.flatMap((tag) => {
    const name = ctx.areaName(tag);
    if (!name) return [];
    const members = points.filter(({ candidate }) => candidate.areaTag && lower(candidate.areaTag) === tag).map(({ marker }) => marker);
    const mean = (pick: (marker: MapMarker) => number) => round1(members.reduce((sum, marker) => sum + pick(marker), 0) / members.length);
    return [{ id: `area:${tag}`, kind: "area" as const, px: mean((m) => m.px), py: mean((m) => m.py), name }];
  });
}

const byKindThenId = (a: MapMarker, b: MapMarker): number => kindOrder(a.kind) - kindOrder(b.kind) || a.id.localeCompare(b.id, "en");

function buildWorld(frame: Frame, candidates: readonly Candidate[], ctx: Context, iconExists: (relative: string) => boolean): WorldMap {
  const points = candidates.map((candidate) => ({ candidate, marker: toMarker(candidate, frame.frame, iconExists) }));
  return {
    key: frame.world.key,
    name: frame.name,
    frame: frame.frame,
    zMax: zMaxFor(frame.frame.imageSize),
    markers: [...points.map(({ marker }) => marker), ...areaLabels(points, ctx)].sort(byKindThenId),
  };
}

function iconsOf(candidates: readonly Candidate[], iconExists: (relative: string) => boolean): MapIcon[] {
  // Quest and level-data pins are added after this, so their icons are published up front.
  const sources = [...candidates.map((candidate) => candidate.iconSource), ...Object.values(QUEST_ICONS), ...Object.values(SPOT_ICONS)];
  const present = [...new Set(sources.filter((source): source is string => source !== undefined && iconExists(source)))];
  return present.map((from) => ({ from, published: publishedIcon(from) }));
}

function legendOf(iconExists: (relative: string) => boolean): MapData["legend"] {
  const present = Object.entries(LEGEND_SOURCES).filter(([, source]) => iconExists(source));
  return Object.fromEntries(present.map(([kind, source]) => [kind, publishedIcon(source)]));
}

export function buildMapData(tables: MapTables, locales: Locales, iconExists: (relative: string) => boolean): MapResult {
  const ctx = makeContext(tables, locales);
  const { frames, issues: frameIssues } = worldFrames(tables, ctx);
  const gathered = merge([minecarts(tables, ctx), rifts(tables, ctx), portals(tables, ctx), merchants(tables, ctx)]);
  const inside = (candidate: Candidate) => frames.some((frame) => isInside(frame.frame, candidate.block));
  const placedCandidates = gathered.candidates.filter(inside);
  const worlds = frames.map((frame) => buildWorld(frame, placedCandidates.filter((c) => isInside(frame.frame, c.block)), ctx, iconExists));
  return {
    data: {
      worlds,
      legend: legendOf(iconExists),
    },
    icons: iconsOf(placedCandidates, iconExists),
    areaName: ctx.areaName,
    issues: [
      ...frameIssues,
      ...gathered.issues,
      ...gathered.candidates.filter((c) => !inside(c)).map((c) => issue("map-marker-outside", `${c.kind}:${c.id}`)),
      ...ctx.fallbackIssues(),
    ],
  };
}
