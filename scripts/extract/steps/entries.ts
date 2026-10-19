import { existsSync } from "node:fs";
import path from "node:path";
import { assembleEntry, assertUniqueSlugs } from "../assemble";
import { ICON_SOURCES, TABLES, type IconSource } from "../../../shared/config";
import { dedupeByName } from "../dedupe";
import { groupEntries, type RawEntry } from "../group-entries";
import { listIconFiles, loadOverrides } from "../icon-files";
import { loadIconReferences, referenceFor, referencePaths, type IconReferences } from "../icon-references";
import { issue, type Issue } from "../issues";
import { toSlug } from "../keys";
import { linkEntries } from "../link-entries";
import { buildIconIndex, matchIcon, type IconIndex, type IconOverrides } from "../match-icons";
import { iconWebPath, sortEntries, validateOutput, type ExtractOutput, type IconCopy } from "../output";
import { defineStep } from "../step";
import { localesStep } from "./locales";

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

export interface EntriesValue {
  readonly output: ExtractOutput;
  /** The entry icons to publish; the icons step copies them. */
  readonly copies: IconCopy[];
}

/** The wiki entries: grouped from the locale tables, icons planned, assembled, deduped and linked. */
export const entriesStep = defineStep({
  name: "entries",
  needs: { locales: localesStep },
  writes: [],
  async run({ options }, { locales }) {
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
      plan.source && kept.has(`${plan.raw.category}:${plan.raw.id}`)
        ? [{ from: plan.source, to: path.join(options.outRoot, "public", ...webPathOf(plan.raw).split("/")) }]
        : [],
    );
    const issues = [
      ...catalog.issues,
      ...grouped.issues,
      ...plans.filter((plan) => kept.has(`${plan.raw.category}:${plan.raw.id}`)).flatMap((plan) => plan.issues),
      ...assembled.flatMap((result) => result.issues),
      ...deduped.issues,
      ...linked.issues,
    ];
    const value: EntriesValue = { output, copies };
    return { value, issues };
  },
});
