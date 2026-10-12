import { existsSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { extractAchievements } from "./achievements";
import { extractBestiary } from "./bestiary";
import { assembleEntry, assertUniqueSlugs } from "./assemble";
import { dedupeByName } from "./dedupe";
import { planAssets } from "./ui-assets";
import {
  BRAND_SOURCES,
  FRAME_SOURCES,
  ICON_SOURCES,
  SPLASH_SOURCE,
  SPLASH_TARGET,
  TABLES,
  UI_ICON_SOURCES,
  type IconSource,
  type Lang,
} from "./config";
import { buildMapData, type MapResult } from "./map";
import { MapDataSchema } from "./map-schema";
import { loadMapTables } from "./map-tables";
import type { LocaleFile } from "./schemas";
import { groupEntries, type RawEntry } from "./group-entries";
import { WeaponDataSchema, type WeaponData } from "./weapon-schema";
import { DATATABLES_DIR, loadGameTables } from "./game-tables";
import { buildWeaponData } from "./weapons";
import { buildArmorEffects } from "./armor-effects";
import { buildArtifactData } from "./artifacts";
import { buildEffectData } from "./effects";
import { buildEnchantmentData } from "./enchantments";
import { ArmorEffectDataSchema, ArtifactDataSchema, EnchantmentDataSchema, TalismanDataSchema } from "./gear-schema";
import { loadIconReferences, referenceFor, referencePaths, type IconReferences } from "./icon-references";
import { listIconFiles, loadOverrides } from "./icon-files";
import { issue, type Issue } from "./issues";
import { toSlug } from "./keys";
import { linkEntries } from "./link-entries";
import { buildIconIndex, matchIcon, type IconIndex, type IconOverrides } from "./match-icons";
import { copyIcons, iconWebPath, sortEntries, validateOutput, writeOutputs } from "./output";
import { loadLocales } from "./parse-locale";
import { renderReport } from "./report";
import uiGameKeys from "./ui-game-keys.json";
import { buildUiGameStrings } from "./ui-game-strings";
import { loadTalismanTables } from "./talisman-tables";
import { buildTalismanData, withTalismanDescriptions } from "./talismans";
import { applyEnglishOverrides } from "./text-overrides";
import { extractSoulStorm, SOUL_STORM_ICON_SOURCES } from "./soul-storm";

export interface ExtractOptions {
  readonly sourceRoot: string;
  readonly outRoot: string;
  readonly overridesPath: string;
  /** Hand-made mob portraits; defaults to mob-portrait-overrides next to the icon overrides. */
  readonly mobPortraitOverrideDir?: string;
  /** The hand-kept Soul Storm status file; defaults to soul-storm-status.json next to the icon overrides. */
  readonly soulStormStatusPath?: string;
}

export interface ExtractSummary {
  readonly entries: number;
  readonly armorSets: number;
  readonly icons: number;
  readonly mobs: number;
  /** Every DataTable file name the extract read. */
  readonly tablesRead: readonly string[];
  readonly issues: Issue[];
}

interface IconPlan {
  readonly raw: RawEntry;
  readonly source?: string;
  readonly issues: Issue[];
}

interface IconCatalog {
  readonly indexes: ReadonlyMap<string, IconIndex>;
  readonly issues: Issue[];
}

async function loadIconCatalog(sourceRoot: string): Promise<IconCatalog> {
  const sources = Object.values(ICON_SOURCES).filter((source): source is IconSource => source !== undefined);
  const byRoot = new Map(sources.map((source) => [source.root, source]));
  const listed = await Promise.all(
    [...byRoot.values()].map(async ({ root, pattern }) => ({ root, files: await listIconFiles(sourceRoot, root, pattern) })),
  );
  return {
    indexes: new Map(listed.map(({ root, files }) => [root, buildIconIndex(files ?? [])])),
    issues: listed.filter(({ files }) => files === null).map(({ root }) => issue("missing-icon-root", root)),
  };
}

/** The first existing file the game's IconReference names for this entry, if any. */
function referencedIcon(raw: RawEntry, references: IconReferences, sourceRoot: string): string | undefined {
  const reference = referenceFor(references, raw.category, raw.id);
  return reference
    ? referencePaths(reference).map((file) => path.join(sourceRoot, ...file.split("/"))).find((file) => existsSync(file))
    : undefined;
}

/** Icon order: hand override, then the game's IconReference, then file-name matching. */
function planIcon(raw: RawEntry, catalog: IconCatalog, overrides: IconOverrides, references: IconReferences, sourceRoot: string): IconPlan {
  const iconSource = ICON_SOURCES[raw.category];
  if (!iconSource || raw.release !== "base") return { raw, issues: [] };
  const referenced = Object.hasOwn(overrides, raw.id) ? undefined : referencedIcon(raw, references, sourceRoot);
  if (referenced) return { raw, source: referenced, issues: [] };
  const where = `${raw.category}:${raw.id}`;
  const index = catalog.indexes.get(iconSource.root) ?? new Map<string, readonly string[]>();
  const match = matchIcon(raw.id, index, overrides, { fallbackToBase: iconSource.fallbackToBase });
  switch (match.kind) {
    case "matched": {
      const source = path.join(sourceRoot, ...match.file.split("/"));
      return existsSync(source)
        ? { raw, source, issues: [] }
        : { raw, issues: [issue("override-missing-file", `${where} → ${match.file}`)] };
    }
    case "ambiguous":
      return { raw, issues: [issue("ambiguous-icon", `${where}: ${match.candidates.join(", ")}`)] };
    case "missing":
      return { raw, issues: [issue("missing-icon", where)] };
    case "none":
      return { raw, issues: [] };
  }
}

const webPathOf = (raw: RawEntry): string => iconWebPath(raw.category, toSlug(raw.id));

/** Copies the splash art into the site sources; a missing file is reported, and the home page goes without it. */
async function copySplash(sourceRoot: string, outRoot: string): Promise<Issue[]> {
  const from = path.join(sourceRoot, ...SPLASH_SOURCE.split("/"));
  if (!existsSync(from)) return [issue("missing-brand", SPLASH_SOURCE)];
  const to = path.join(outRoot, ...SPLASH_TARGET.split("/"));
  await mkdir(path.dirname(to), { recursive: true });
  await copyFile(from, to);
  return [];
}

/** World map markers; with no region table in source-data the map is left empty and reported. */
async function extractMap(sourceRoot: string, locales: Readonly<Record<Lang, LocaleFile>>): Promise<MapResult> {
  const tables = await loadMapTables(sourceRoot);
  if (!tables) {
    return { data: { worlds: [], legend: {} }, icons: [], issues: [issue("missing-map-tables", `${DATATABLES_DIR}/DT_WorldRegionMapData.json`)] };
  }
  return buildMapData(tables, locales, (relative) => existsSync(path.join(sourceRoot, ...relative.split("/"))));
}

export async function runExtract(options: ExtractOptions): Promise<ExtractSummary> {
  const locales = await loadLocales(options.sourceRoot);
  const grouped = groupEntries(locales, TABLES);
  const overrides = await loadOverrides(options.overridesPath);
  const catalog = await loadIconCatalog(options.sourceRoot);
  const references = await loadIconReferences(options.sourceRoot);
  const plans = grouped.entries.map((raw) => planIcon(raw, catalog, overrides, references, options.sourceRoot));
  const assembled = plans.map((plan) => assembleEntry(plan.raw, plan.source ? webPathOf(plan.raw) : undefined));
  const deduped = dedupeByName(assembled.map((result) => result.entry));
  assertUniqueSlugs(deduped.entries);
  const linked = linkEntries(deduped.entries);
  const output = validateOutput(sortEntries(linked.entries), linked.armorSets);
  const kept = new Set(deduped.entries.map((entry) => `${entry.category}:${entry.id}`));
  const copies = plans.flatMap((plan) =>
    plan.source && kept.has(`${plan.raw.category}:${plan.raw.id}`) ? [{ from: plan.source, to: path.join(options.outRoot, "public", ...webPathOf(plan.raw).split("/")) }] : [],
  );
  const frames = planAssets(options.sourceRoot, options.outRoot, FRAME_SOURCES, "frames", "missing-frame");
  const uiIcons = planAssets(options.sourceRoot, options.outRoot, UI_ICON_SOURCES, "ui", "missing-ui-icon");
  const brand = planAssets(options.sourceRoot, options.outRoot, BRAND_SOURCES, "brand", "missing-brand");
  const soulStormIcons = planAssets(options.sourceRoot, options.outRoot, SOUL_STORM_ICON_SOURCES, "soul-storm", "missing-ui-icon");
  const map = await extractMap(options.sourceRoot, locales);
  const mapIcons = map.icons.map((icon) => ({
    from: path.join(options.sourceRoot, ...icon.from.split("/")),
    to: path.join(options.outRoot, "public", ...icon.published.split("/")),
  }));
  await copyIcons(
    [...copies, ...frames.copies, ...uiIcons.copies, ...brand.copies, ...soulStormIcons.copies, ...mapIcons],
    path.join(options.outRoot, "public", "icons"),
  );
  // After copyIcons, which clears public/icons.
  const achievements = await extractAchievements(options.sourceRoot, options.outRoot, locales);
  const bestiary = await extractBestiary({
    sourceRoot: options.sourceRoot,
    outRoot: options.outRoot,
    locales,
    entries: output.entries,
    map: map.data,
    overrideDir: options.mobPortraitOverrideDir ?? path.join(path.dirname(options.overridesPath), "mob-portrait-overrides"),
  });
  const soulStorm = await extractSoulStorm({
    sourceRoot: options.sourceRoot,
    locales,
    map: map.data,
    links: bestiary.links,
    icons: soulStormIcons.paths,
    statusPath: options.soulStormStatusPath ?? path.join(path.dirname(options.overridesPath), "soul-storm-status.json"),
  });
  const splashIssues = await copySplash(options.sourceRoot, options.outRoot);
  const weaponTables = await loadGameTables(options.sourceRoot);
  const weapons = weaponTables
    ? buildWeaponData(output.entries, weaponTables)
    : { data: { weapons: {}, effectFormats: {} } satisfies WeaponData, issues: [issue("missing-datatables", DATATABLES_DIR)] };
  const artifacts = weaponTables ? buildArtifactData(output.entries, weaponTables) : { data: {}, issues: [] };
  const armorEffects = weaponTables ? buildArmorEffects(output.entries, weaponTables) : { data: {}, issues: [] };
  const enchantments = weaponTables ? buildEnchantmentData(output.entries, weaponTables) : { data: {}, issues: [] };
  const effectValues = weaponTables ? buildEffectData(output.entries, weaponTables) : {};
  const talismanTables = await loadTalismanTables(options.sourceRoot);
  const talismans = weaponTables && talismanTables ? buildTalismanData(output.entries, talismanTables, weaponTables.effects) : { data: {}, issues: [] };
  const described = validateOutput(withTalismanDescriptions(applyEnglishOverrides(output.entries), talismans.data), output.armorSets);
  const uiStrings = buildUiGameStrings(locales, uiGameKeys);
  const issues = [
    ...catalog.issues,
    ...frames.issues,
    ...uiIcons.issues,
    ...brand.issues,
    ...soulStormIcons.issues,
    ...splashIssues,
    ...grouped.issues,
    ...plans.filter((plan) => kept.has(`${plan.raw.category}:${plan.raw.id}`)).flatMap((plan) => plan.issues),
    ...assembled.flatMap((result) => result.issues),
    ...deduped.issues,
    ...linked.issues,
    ...weapons.issues,
    ...artifacts.issues,
    ...armorEffects.issues,
    ...enchantments.issues,
    ...talismans.issues,
    ...map.issues,
    ...uiStrings.issues,
    ...achievements.issues,
    ...bestiary.issues,
    ...soulStorm.issues,
  ];
  const extraData = {
    "frames.json": frames.paths,
    "category-icons.json": uiIcons.paths,
    "brand.json": brand.paths,
    "weapons.json": WeaponDataSchema.parse(weapons.data),
    "artifacts.json": ArtifactDataSchema.parse(artifacts.data),
    "armor-effects.json": ArmorEffectDataSchema.parse(armorEffects.data),
    "enchantments.json": EnchantmentDataSchema.parse(enchantments.data),
    "effects.json": EnchantmentDataSchema.parse(effectValues),
    "talismans.json": TalismanDataSchema.parse(talismans.data),
    "map.json": MapDataSchema.parse(map.data),
    "ui-game-strings.json": uiStrings.strings,
    "achievements.json": achievements.data,
    "mobs.json": bestiary.mobs,
    "loot-sources.json": bestiary.sources,
    "soul-storm.json": soulStorm.data,
  };
  await writeOutputs(options.outRoot, described, extraData, renderReport({ ...described, issues }));
  return { entries: described.entries.length, armorSets: output.armorSets.length, icons: copies.length, mobs: bestiary.mobs.mobs.length, tablesRead: [...bestiary.tablesRead, ...soulStorm.tablesRead], issues };
}
