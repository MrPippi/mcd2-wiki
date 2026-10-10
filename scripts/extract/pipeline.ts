import { existsSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
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
} from "./config";
import { groupEntries, type RawEntry } from "./group-entries";
import { WeaponDataSchema, type WeaponData } from "./weapon-schema";
import { DATATABLES_DIR, loadGameTables } from "./game-tables";
import { buildWeaponData } from "./weapons";
import { buildArtifactData } from "./artifacts";
import { buildEnchantmentData } from "./enchantments";
import { ArtifactDataSchema, EnchantmentDataSchema } from "./gear-schema";
import { listIconFiles, loadOverrides } from "./icon-files";
import { issue, type Issue } from "./issues";
import { toSlug } from "./keys";
import { linkEntries } from "./link-entries";
import { buildIconIndex, matchIcon, type IconIndex, type IconOverrides } from "./match-icons";
import { copyIcons, iconWebPath, sortEntries, validateOutput, writeOutputs } from "./output";
import { loadLocales } from "./parse-locale";
import { renderReport } from "./report";

export interface ExtractOptions {
  readonly sourceRoot: string;
  readonly outRoot: string;
  readonly overridesPath: string;
}

export interface ExtractSummary {
  readonly entries: number;
  readonly armorSets: number;
  readonly icons: number;
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

function planIcon(raw: RawEntry, catalog: IconCatalog, overrides: IconOverrides, sourceRoot: string): IconPlan {
  const iconSource = ICON_SOURCES[raw.category];
  if (!iconSource || raw.release !== "base") return { raw, issues: [] };
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

export async function runExtract(options: ExtractOptions): Promise<ExtractSummary> {
  const grouped = groupEntries(await loadLocales(options.sourceRoot), TABLES);
  const overrides = await loadOverrides(options.overridesPath);
  const catalog = await loadIconCatalog(options.sourceRoot);
  const plans = grouped.entries.map((raw) => planIcon(raw, catalog, overrides, options.sourceRoot));
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
  await copyIcons(
    [...copies, ...frames.copies, ...uiIcons.copies, ...brand.copies],
    path.join(options.outRoot, "public", "icons"),
  );
  const splashIssues = await copySplash(options.sourceRoot, options.outRoot);
  const weaponTables = await loadGameTables(options.sourceRoot);
  const weapons = weaponTables
    ? buildWeaponData(output.entries, weaponTables)
    : { data: { weapons: {}, effectFormats: {} } satisfies WeaponData, issues: [issue("missing-datatables", DATATABLES_DIR)] };
  const artifacts = weaponTables ? buildArtifactData(output.entries, weaponTables) : { data: {}, issues: [] };
  const enchantments = weaponTables ? buildEnchantmentData(output.entries, weaponTables) : { data: {}, issues: [] };
  const issues = [
    ...catalog.issues,
    ...frames.issues,
    ...uiIcons.issues,
    ...brand.issues,
    ...splashIssues,
    ...grouped.issues,
    ...plans.filter((plan) => kept.has(`${plan.raw.category}:${plan.raw.id}`)).flatMap((plan) => plan.issues),
    ...assembled.flatMap((result) => result.issues),
    ...deduped.issues,
    ...linked.issues,
    ...weapons.issues,
    ...artifacts.issues,
    ...enchantments.issues,
  ];
  const extraData = {
    "frames.json": frames.paths,
    "category-icons.json": uiIcons.paths,
    "brand.json": brand.paths,
    "weapons.json": WeaponDataSchema.parse(weapons.data),
    "artifacts.json": ArtifactDataSchema.parse(artifacts.data),
    "enchantments.json": EnchantmentDataSchema.parse(enchantments.data),
  };
  await writeOutputs(options.outRoot, output, extraData, renderReport({ ...output, issues }));
  return { entries: output.entries.length, armorSets: output.armorSets.length, icons: copies.length, issues };
}
