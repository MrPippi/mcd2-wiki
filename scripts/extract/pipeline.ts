import { existsSync } from "node:fs";
import path from "node:path";
import { assembleEntry, assertUniqueSlugs } from "./assemble";
import { planAssets } from "./ui-assets";
import { FRAME_SOURCES, ICON_SOURCES, TABLES, UI_ICON_SOURCES, type IconSource } from "./config";
import { groupEntries, type RawEntry } from "./group-entries";
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
  const roots = [...new Set(sources.map((source) => source.root))];
  const listed = await Promise.all(roots.map(async (root) => ({ root, files: await listIconFiles(sourceRoot, root) })));
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

export async function runExtract(options: ExtractOptions): Promise<ExtractSummary> {
  const grouped = groupEntries(await loadLocales(options.sourceRoot), TABLES);
  const overrides = await loadOverrides(options.overridesPath);
  const catalog = await loadIconCatalog(options.sourceRoot);
  const plans = grouped.entries.map((raw) => planIcon(raw, catalog, overrides, options.sourceRoot));
  const assembled = plans.map((plan) => assembleEntry(plan.raw, plan.source ? webPathOf(plan.raw) : undefined));
  const entries = assembled.map((result) => result.entry);
  assertUniqueSlugs(entries);
  const linked = linkEntries(entries);
  const output = validateOutput(sortEntries(linked.entries), linked.armorSets);
  const copies = plans.flatMap((plan) =>
    plan.source ? [{ from: plan.source, to: path.join(options.outRoot, "public", ...webPathOf(plan.raw).split("/")) }] : [],
  );
  const frames = planAssets(options.sourceRoot, options.outRoot, FRAME_SOURCES, "frames", "missing-frame");
  const uiIcons = planAssets(options.sourceRoot, options.outRoot, UI_ICON_SOURCES, "ui", "missing-ui-icon");
  await copyIcons([...copies, ...frames.copies, ...uiIcons.copies], path.join(options.outRoot, "public", "icons"));
  const issues = [
    ...catalog.issues,
    ...frames.issues,
    ...uiIcons.issues,
    ...grouped.issues,
    ...plans.flatMap((plan) => plan.issues),
    ...assembled.flatMap((result) => result.issues),
    ...linked.issues,
  ];
  const extraData = { "frames.json": frames.paths, "category-icons.json": uiIcons.paths };
  await writeOutputs(options.outRoot, output, extraData, renderReport({ ...output, issues }));
  return { entries: output.entries.length, armorSets: output.armorSets.length, icons: copies.length, issues };
}
