/** Wires the mob and loot DataTables into the two bestiary outputs: the mob list and the item-to-source index. */
import path from "node:path";
import type { Lang } from "../../shared/config";
import { issue, type Issue } from "./issues";
import { buildItemIndex } from "./loot-items";
import { buildItemSources } from "./loot-sources";
import { loadLootTables, type LootTables } from "./loot-tables";
import { areaMarkers, buildAreaNamer, buildMobAreas, SPAWN_AREA_PREFIXES } from "./mob-areas";
import { attachDrops, unusedMobRows } from "./mob-drops";
import { listPortraitFiles, planPortraits, publishPortraits, withPortraits } from "./mob-portraits";
import { ItemSourcesSchema, MobDataSchema, type ItemSourcesData, type MobData } from "../../shared/mob-schema";
import { loadMobTables, type AreaRow, type MobTables } from "./mob-tables";
import { buildMobs, type MobDraft } from "./mobs";
import type { MapData } from "../../shared/map-schema";
import type { LocaleFile, Entry } from "../../shared/schemas";

export interface BestiaryInput {
  readonly sourceRoot: string;
  readonly outRoot: string;
  readonly locales: Readonly<Record<Lang, LocaleFile>>;
  readonly entries: readonly Entry[];
  readonly map: MapData;
  /** Hand-made portraits that win over the game renders. */
  readonly overrideDir: string;
}
/** What other pages need to link into the bestiary: the mob tag → slug index and the area rows. Not serialized. */
export interface BestiaryLinks {
  readonly tagIndex: ReadonlyMap<string, string>;
  readonly areas: readonly AreaRow[];
}
export interface BestiaryResult {
  readonly mobs: MobData;
  readonly sources: ItemSourcesData;
  readonly issues: Issue[];
  readonly tablesRead: readonly string[];
  readonly links: BestiaryLinks;
}

const RENDERS_DIR = ["Renders", "Mobs"];
const EMPTY_SOURCES: ItemSourcesData = { sources: {}, items: {}, bookDrops: [] };

interface MobsPart {
  readonly mobs: MobData;
  readonly issues: Issue[];
  readonly links: BestiaryLinks;
}

async function loadAndBuildMobs(input: BestiaryInput, tables: MobTables): Promise<{ drafts: MobDraft[]; issues: Issue[]; tagIndex: ReadonlyMap<string, string> }> {
  const built = buildMobs(tables, input.locales);
  const areas = buildMobAreas({
    tables,
    tagIndex: built.tagIndex,
    namer: buildAreaNamer(tables.areas, input.locales),
    prefixes: SPAWN_AREA_PREFIXES,
    markers: areaMarkers(input.map),
  });
  const renderDir = path.join(input.sourceRoot, ...RENDERS_DIR);
  const [renders, overrides] = await Promise.all([listPortraitFiles(renderDir, ".png"), listPortraitFiles(input.overrideDir, ".webp")]);
  const portraits = planPortraits(built.drafts, { renderDir, renders: renders ?? [], overrideDir: input.overrideDir, overrides: overrides ?? [] });
  await publishPortraits(input.outRoot, portraits.plans);
  const missing = renders === null ? [issue("missing-mob-portraits", RENDERS_DIR.join("/"))] : [];
  const withAreas = built.drafts.map((draft) => ({ ...draft, mob: { ...draft.mob, areas: [...(areas.areasBySlug.get(draft.mob.slug) ?? [])] } }));
  return {
    drafts: withPortraits(withAreas, portraits.plans),
    issues: [...built.issues, ...areas.issues, ...(renders === null ? missing : portraits.issues)],
    tagIndex: built.tagIndex,
  };
}

function composeMobs(input: BestiaryInput, tables: MobTables | undefined, loot: LootTables | undefined): Promise<MobsPart> {
  return tables ? composeFrom(input, tables, loot) : Promise.resolve({ mobs: { mobs: [] }, issues: [issue("missing-mob-tables", "DT_MobType1Definition.json")], links: { tagIndex: new Map(), areas: [] } });
}

async function composeFrom(input: BestiaryInput, tables: MobTables, loot: LootTables | undefined): Promise<MobsPart> {
  const built = await loadAndBuildMobs(input, tables);
  const index = loot ? buildItemIndex(loot, input.entries) : undefined;
  const dropped = attachDrops(built.drafts, loot?.mob ?? [], (tag) => index?.resolve(tag).map((ref) => ref.key) ?? []);
  return {
    mobs: MobDataSchema.parse({ mobs: dropped.drafts.map((draft) => draft.mob) }),
    issues: [...built.issues, ...(loot ? [...dropped.issues, ...unusedMobRows(built.drafts, loot.mob)] : [])],
    links: { tagIndex: built.tagIndex, areas: tables.areas },
  };
}

function buildSources(input: BestiaryInput, tables: MobTables | undefined, loot: LootTables | undefined): { sources: ItemSourcesData; issues: Issue[] } {
  if (!loot) return { sources: EMPTY_SOURCES, issues: [issue("missing-loot-tables", "DT_LootSourceDefinition_Area.json")] };
  const index = buildItemIndex(loot, input.entries);
  const built = buildItemSources({
    tables: loot,
    index,
    namer: buildAreaNamer(tables?.areas ?? [], input.locales),
    locales: input.locales,
  });
  const unmatched = index.unresolvedRows.map((row) => issue("loot-item-unmatched", row));
  return { sources: ItemSourcesSchema.parse(built.data), issues: [...built.issues, ...unmatched] };
}

export async function extractBestiary(input: BestiaryInput): Promise<BestiaryResult> {
  const tablesRead: string[] = [];
  const onRead = (file: string): void => {
    tablesRead.push(file);
  };
  const tables = await loadMobTables(input.sourceRoot, onRead);
  const loot = await loadLootTables(input.sourceRoot, onRead);
  const mobs = await composeMobs(input, tables, loot);
  const sources = buildSources(input, tables, loot);
  return { mobs: mobs.mobs, sources: sources.sources, issues: [...mobs.issues, ...sources.issues], tablesRead: [...tablesRead], links: mobs.links };
}
