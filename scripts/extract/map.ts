/** World map markers from the game's DataTables: minecart stations, rifts, the teleport statue, merchants, area names. */
import path from "node:path";
import { isInside, toBlocks, toImagePixel, type BlockPoint, type WorldFrame } from "../../src/lib/map/transform";
import { WORLDS, imageSizeOf, zMaxFor, type WorldSource } from "../../src/lib/map/worlds";
import type { Lang } from "./config";
import { issue, type Issue } from "./issues";
import { localize, locRef } from "./loc-table";
import { MARKER_KINDS, type MapData, type MapMarker, type MarkerKind, type WorldMap } from "./map-schema";
import type { AreaRowValue, MapTables, TeleportRowValue } from "./map-tables";
import type { LocaleFile, Localized } from "./schemas";

type Locales = Readonly<Record<Lang, LocaleFile>>;

export interface MapIcon {
  readonly from: string;
  readonly published: string;
}

export interface MapResult {
  readonly data: MapData;
  readonly icons: MapIcon[];
  readonly issues: Issue[];
}

const WORLD_LABELS = "Text/Release/WorldMapLabels.csv";
const SETTINGS_LABELS = "Text/Release/SettingsLabels.csv";
const PORTAL_ID = "sw.teleportpoint.townportal.portallocation";
const RIFT_ID = /\.rifts\.\d+$/i;
const NAME_TEXT = /SW\.TextEntry\.Name/;
const AREA_ICON_DIR = "Assets/UI/Icons/Location/AreaIcons";
const PORTAL_ICON = `${AREA_ICON_DIR}/T_UI_Icon_Town_Portal.png`;

/** A point found in the tables, before it is placed in a world. */
interface Candidate {
  readonly id: string;
  readonly kind: Exclude<MarkerKind, "area">;
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
  readonly areaIcon: (tag: string) => string | undefined;
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
  const text = (namespace: string, key: string) => localize(locales, namespace, key);
  const loc = (value: string) => {
    const ref = locRef(value);
    return ref ? text(ref.namespace, ref.key) : undefined;
  };
  const areaName = (tag: string) => {
    const texts = Object.entries(areas.get(lower(tag))?.TypeTextData?.Texts ?? {});
    const name = texts.find(([key]) => NAME_TEXT.test(key))?.[1].Text;
    return name ? loc(name) : undefined;
  };
  const areaIcon = (tag: string) => {
    const match = /\/AreaIcons\/([^./]+)\./.exec(areas.get(lower(tag))?.AreaIcon ?? "");
    return match ? `${AREA_ICON_DIR}/${match[1]}.png` : undefined;
  };
  return { text, loc, areaName, areaIcon };
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
      return [{ world, frame, name: ctx.text(WORLD_LABELS, world.label) ?? { zh: world.region, en: world.region } }];
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
  const byId = new Map<string, TeleportRowValue>(
    tables.teleports.filter((row) => row.Type !== "Debug").map((row) => [lower(row.IdTag.TagName), row]),
  );
  return merge(
    tables.exploration.map((row) => {
      const point = byId.get(lower(row.TeleportTag.TagName));
      if (!point) return { candidates: [], issues: [issue("map-unmatched-tag", `${row.Name} → ${row.TeleportTag.TagName}`)] };
      const areaTag = point.AreaTag.TagName;
      return placed({ id: row.Name, kind: "minecart", block: toBlocks(point.Location), areaTag }, ctx.areaName(areaTag));
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
        const base = { id: row.Name, kind: "rift" as const, block: toBlocks(row.Location), areaTag };
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
        { id: row.Name, kind: "merchant", block: toBlocks(row.Location), ...optional("note", ctx.loc(row.MerchantDescription)) },
        ctx.loc(row.MerchantName),
      ),
    ),
  );
}

const publishedIcon = (source: string): string => `icons/map/${path.posix.basename(source).toLowerCase()}`;

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

function areaLabels(points: readonly { candidate: Candidate; marker: MapMarker }[], ctx: Context, iconExists: (relative: string) => boolean): MapMarker[] {
  const tags = [...new Set(points.flatMap(({ candidate }) => (candidate.areaTag ? [lower(candidate.areaTag)] : [])))];
  return tags.flatMap((tag) => {
    const name = ctx.areaName(tag);
    if (!name) return [];
    const members = points.filter(({ candidate }) => candidate.areaTag && lower(candidate.areaTag) === tag).map(({ marker }) => marker);
    const mean = (pick: (marker: MapMarker) => number) => round1(members.reduce((sum, marker) => sum + pick(marker), 0) / members.length);
    const source = ctx.areaIcon(tag);
    const icon = source && iconExists(source) ? publishedIcon(source) : undefined;
    return [{ id: `area:${tag}`, kind: "area" as const, px: mean((m) => m.px), py: mean((m) => m.py), name, ...optional("icon", icon) }];
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
    markers: [...points.map(({ marker }) => marker), ...areaLabels(points, ctx, iconExists)].sort(byKindThenId),
  };
}

function iconsOf(candidates: readonly Candidate[], ctx: Context, iconExists: (relative: string) => boolean): MapIcon[] {
  const sources = candidates.flatMap((candidate) => [candidate.iconSource, candidate.areaTag ? ctx.areaIcon(candidate.areaTag) : undefined]);
  const present = [...new Set(sources.filter((source): source is string => source !== undefined && iconExists(source)))];
  return present.map((from) => ({ from, published: publishedIcon(from) }));
}

export function buildMapData(tables: MapTables, locales: Locales, iconExists: (relative: string) => boolean): MapResult {
  const ctx = makeContext(tables, locales);
  const { frames, issues: frameIssues } = worldFrames(tables, ctx);
  const gathered = merge([minecarts(tables, ctx), rifts(tables, ctx), portals(tables, ctx), merchants(tables, ctx)]);
  const inside = (candidate: Candidate) => frames.some((frame) => isInside(frame.frame, candidate.block));
  const placedCandidates = gathered.candidates.filter(inside);
  return {
    data: {
      worlds: frames.map((frame) => buildWorld(frame, placedCandidates.filter((c) => isInside(frame.frame, c.block)), ctx, iconExists)),
    },
    icons: iconsOf(placedCandidates, ctx, iconExists),
    issues: [
      ...frameIssues,
      ...gathered.issues,
      ...gathered.candidates.filter((c) => !inside(c)).map((c) => issue("map-marker-outside", `${c.kind}:${c.id}`)),
    ],
  };
}
