/** Merges the mob DataTable rows into one bestiary entry per named mob: names, kind, world, base stats, variants and Soul Corrupted versions. */
import type { Lang } from "./config";
import { ExtractError, issue, type Issue } from "./issues";
import { toSlug } from "./keys";
import { englishFallbacks, localize, locRef, type LocRef } from "./loc-table";
import { STAT_ATTRIBUTES, STAT_KEYS, type Mob, type StatKey } from "./mob-schema";
import type { MobRow, MobTables } from "./mob-tables";
import { normalizeTag, tagKey, traitClosure } from "./mob-tags";
import type { LocaleFile } from "./schemas";

export interface MobDraft {
  readonly mob: Mob;
  readonly tags: readonly string[];
  readonly closure: readonly string[];
  readonly soul?: { readonly tags: readonly string[]; readonly closure: readonly string[] };
  readonly references: readonly string[];
}
export interface MobsResult {
  readonly drafts: readonly MobDraft[];
  readonly tagIndex: ReadonlyMap<string, string>;
  readonly issues: Issue[];
}

type Kind = Mob["kind"];
type Locales = Readonly<Record<Lang, LocaleFile>>;
type Stat = Mob["stats"][number];

const KEY_PATTERN = /^SW_Mob_(.+?)_SW_TextEntry_Name$/i;
const ABSTRACT_NAME = /^(Default|Monstrosity$|Monstrosity_Storm$|StormiMoss$)/;
const NO_LOOT = tagKey("SW.Trait.CannotDropLoot");
const OVERWORLD = tagKey("SW.Mob.Default.Overworld");
const WELLSPRING = tagKey("SW.Mob.Default.Wellspring");
const SOUL_SUFFIX = /\.SoulStated$/i;
const NAME_SLOT = 'SW.TextEntry.Name';
const KIND_ORDER: readonly Kind[] = ["boss", "miniboss", "regular", "variant"];

/** One named mob: every table row that shares its name key. */
interface Candidate {
  readonly id: string;
  readonly kind: Kind;
  readonly ref: LocRef;
  readonly rows: readonly MobRow[];
}

export function mobIdFromKey(key: string): string | undefined {
  return KEY_PATTERN.exec(key)?.[1];
}

function nameRef(row: MobRow): { ref: LocRef | undefined; present: boolean } {
  const entry = Object.entries(row.TypeTextData?.Texts ?? {}).find(([key]) => key.includes(NAME_SLOT));
  return entry ? { ref: locRef(entry[1].Text), present: true } : { ref: undefined, present: false };
}

function rowsIndex(tables: MobTables): ReadonlyMap<string, MobRow> {
  const index = new Map<string, MobRow>();
  for (const row of [...tables.definitions, ...tables.type1, ...tables.type2, ...tables.type3, ...tables.variants, ...tables.soulStated]) {
    if (!index.has(tagKey(row.TypeTag.TagName))) index.set(tagKey(row.TypeTag.TagName), row);
  }
  return index;
}

function sources(tables: MobTables): readonly (readonly [Kind, readonly MobRow[]])[] {
  return [["regular", tables.type1], ["miniboss", tables.type2], ["boss", tables.type3], ["variant", tables.variants]];
}

/** Named, loot-dropping rows. The name comes from the key in TypeTextData (never the row name); rows of one kind with the same English name are one mob. */
function classifyRows(tables: MobTables, locales: Locales, rowsByKey: ReadonlyMap<string, MobRow>): { candidates: Candidate[]; issues: Issue[] } {
  const groups = new Map<string, Candidate>();
  const issues: Issue[] = [];
  for (const [kind, rows] of sources(tables)) {
    for (const row of rows) {
      const { ref, present } = nameRef(row);
      if (!present || ABSTRACT_NAME.test(row.Name)) continue;
      if (traitClosure(row, rowsByKey).some((tag) => tagKey(tag) === NO_LOOT)) {
        issues.push(issue("mob-skipped", `${row.Name}: CannotDropLoot`));
        continue;
      }
      const english = ref ? localize(locales, ref.namespace, ref.key)?.en : undefined;
      if (!ref || !english) {
        issues.push(issue("mob-unnamed", `${row.Name}: no English name`));
        continue;
      }
      const id = mobIdFromKey(ref.key) ?? row.Name;
      const groupKey = `${kind}:${english.toLowerCase()}`;
      const known = groups.get(groupKey);
      groups.set(groupKey, known ? { ...known, rows: [...known.rows, row] } : { id, kind, ref, rows: [row] });
    }
  }
  return { candidates: [...groups.values()], issues };
}

const englishOf = (locales: Locales, candidate: Candidate): string => localize(locales, candidate.ref.namespace, candidate.ref.key)?.en ?? "";
const tagsOf = (rows: readonly MobRow[]): string[] => rows.map((row) => normalizeTag(row.TypeTag.TagName));

/** A variant with exactly a base mob's English name is the same creature under another tag: fold it into that base. */
function foldVariants(candidates: readonly Candidate[], locales: Locales): { kept: Candidate[]; folded: ReadonlyMap<string, Candidate[]> } {
  const bases = candidates.filter((candidate) => candidate.kind !== "variant");
  const folded = new Map<string, Candidate[]>();
  const kept: Candidate[] = [];
  for (const candidate of candidates) {
    const name = englishOf(locales, candidate).toLowerCase();
    const owner = candidate.kind === "variant" ? bases.find((base) => englishOf(locales, base).toLowerCase() === name) : undefined;
    if (!owner) {
      kept.push(candidate);
      continue;
    }
    folded.set(owner.id, [...(folded.get(owner.id) ?? []), candidate]);
  }
  return { kept, folded };
}

const attributeValues = (row: MobRow): ReadonlyMap<string, number> =>
  new Map((row.AttributeValues ?? []).map((entry) => [tagKey(entry.Attribute.TagName), entry.Value] as const));

/** Whitelisted stats of a row; a stat the row lacks comes from the nearest row in `ancestors` that has it. */
function statsOf(row: MobRow | undefined, ancestors: readonly MobRow[] = []): Stat[] {
  const chain = (row ? [row, ...ancestors] : []).map(attributeValues);
  return STAT_KEYS.flatMap((key: StatKey) => {
    const found = chain
      .map((values) => STAT_ATTRIBUTES[key].map((attribute) => values.get(tagKey(attribute))).find((value) => value !== undefined))
      .find((value) => value !== undefined);
    return found === undefined ? [] : [{ key, value: found }];
  });
}

const ancestorRows = (closure: readonly string[], rowsByKey: ReadonlyMap<string, MobRow>): MobRow[] =>
  closure.flatMap((tag) => rowsByKey.get(tagKey(tag)) ?? []);

function worldOf(closure: readonly string[]): Mob["world"] {
  const keys = closure.map(tagKey);
  if (keys.includes(OVERWORLD)) return "overworld";
  return keys.includes(WELLSPRING) ? "wellspring" : null;
}

/** The base mob a named variant belongs to: the one listing it in Variants.Replacements, else the first mob in its trait closure. */
function ownerSlugOf(variant: Candidate, closure: readonly string[], bases: readonly Candidate[], slugs: ReadonlyMap<string, string>): string | undefined {
  const own = new Set(tagsOf(variant.rows).map(tagKey));
  const listed = bases.find((base) =>
    base.rows.some((row) => (row.Variants?.Replacements ?? []).some((rep) => own.has(tagKey(rep.TypeTagToUseInstead.TagName)))),
  );
  if (listed) return slugs.get(listed.id);
  const byTag = bases.find((base) => closure.some((tag) => tagsOf(base.rows).map(tagKey).includes(tagKey(tag))));
  return byTag ? slugs.get(byTag.id) : undefined;
}

function matchSoul(tables: MobTables, bases: readonly Candidate[], foldedTags: ReadonlyMap<string, string[]>): { matched: Map<string, MobRow[]>; issues: Issue[] } {
  const owners = new Map<string, string>();
  for (const base of bases) {
    for (const tag of [...tagsOf(base.rows), ...(foldedTags.get(base.id) ?? [])]) owners.set(tagKey(tag), base.id);
  }
  const matched = new Map<string, MobRow[]>();
  const issues: Issue[] = [];
  for (const row of tables.soulStated) {
    const owner = owners.get(tagKey(row.TypeTag.TagName.replace(SOUL_SUFFIX, "")));
    if (owner === undefined) issues.push(issue("mob-skipped", `${row.Name}: no base mob for Soul Corrupted tag`));
    else matched.set(owner, [...(matched.get(owner) ?? []), row]);
  }
  return { matched, issues };
}

const refsOf = (rows: readonly MobRow[]): string[] => rows.flatMap((row) => (row.CharacterReference ? [row.CharacterReference] : []));

const nameSlugOf = (candidate: Candidate, locales: Locales): string => toSlug(englishOf(locales, candidate).replace(/[^A-Za-z0-9]+/g, "_"));

const GENERIC_SUFFIX = /-(type\d+|variant\d+)$/;

/** True when the slug should follow the English name: several rows with unrelated ids were merged, or the id ends in a generic suffix (Witch_Type3 is "Soul Corrupted Witch"). */
function nameLed(candidate: Candidate, locales: Locales): boolean {
  const idSlug = toSlug(candidate.id);
  const nameSlug = nameSlugOf(candidate, locales);
  if (nameSlug === "" || nameSlug === idSlug) return false;
  return GENERIC_SUFFIX.test(idSlug) || (candidate.rows.length > 1 && !sharesIdPrefix(candidate));
}

const rowId = (row: MobRow): string => {
  const { ref } = nameRef(row);
  return (ref ? mobIdFromKey(ref.key) : undefined) ?? row.Name;
};

/** Size or storm versions of one mob (Monstrosity_Copper + Monstrosity_Copper_Storm) keep the representative's id slug. */
function sharesIdPrefix(candidate: Candidate): boolean {
  const prefix = candidate.id.toLowerCase();
  return candidate.rows.every((row) => rowId(row).toLowerCase().startsWith(prefix));
}

/** Slugs by mob id. Name-led mobs get the English-name slug unless another mob already owns it; id slugs are placed first and never move. */
function assignSlugs(candidates: readonly Candidate[], locales: Locales): ReadonlyMap<string, string> {
  const slugs = new Map<string, string>();
  const owners = new Map<string, string>();
  const place = (candidate: Candidate, slug: string): boolean => {
    const clash = owners.get(slug);
    if (clash !== undefined) return false;
    owners.set(slug, candidate.id);
    slugs.set(candidate.id, slug);
    return true;
  };
  const led = candidates.filter((candidate) => nameLed(candidate, locales));
  for (const candidate of candidates.filter((entry) => !led.includes(entry))) {
    const slug = toSlug(candidate.id);
    if (!place(candidate, slug)) throw new ExtractError(`怪物 slug 重複：${owners.get(slug)} 與 ${candidate.id} 都是 ${slug}`);
  }
  for (const candidate of led) {
    if (place(candidate, nameSlugOf(candidate, locales))) continue;
    const slug = toSlug(candidate.id);
    if (!place(candidate, slug)) throw new ExtractError(`怪物 slug 重複：${owners.get(slug)} 與 ${candidate.id} 都是 ${slug}`);
  }
  return slugs;
}

interface Context {
  readonly locales: Locales;
  readonly rowsByKey: ReadonlyMap<string, MobRow>;
  readonly slugs: ReadonlyMap<string, string>;
  readonly kept: readonly Candidate[];
  readonly folded: ReadonlyMap<string, Candidate[]>;
  readonly soul: ReadonlyMap<string, MobRow[]>;
}

function toDraft(candidate: Candidate, ctx: Context): MobDraft | undefined {
  const slug = ctx.slugs.get(candidate.id);
  const [rep] = candidate.rows;
  const name = localize(ctx.locales, candidate.ref.namespace, candidate.ref.key);
  if (slug === undefined || rep === undefined || name === undefined) return undefined;
  const closure = traitClosure(rep, ctx.rowsByKey);
  const foldedRows = (ctx.folded.get(candidate.id) ?? []).flatMap((entry) => entry.rows);
  const soulRows = ctx.soul.get(candidate.id) ?? [];
  const bases = ctx.kept.filter((entry) => entry.kind !== "variant");
  const ownerSlug = candidate.kind === "variant" ? ownerSlugOf(candidate, closure, bases, ctx.slugs) : undefined;
  const variants = candidate.kind === "variant" ? [] : variantSlugs(candidate, ctx);
  const [soulRep] = soulRows;
  const mob: Mob = {
    slug, id: candidate.id, kind: candidate.kind, world: worldOf(closure), name,
    untranslated: englishFallbacks(ctx.locales, candidate.ref.namespace, candidate.ref.key),
    stats: statsOf(rep, ancestorRows(closure, ctx.rowsByKey)), variants, areas: [], drops: [],
    ...(ownerSlug === undefined ? {} : { variantOf: ownerSlug }),
    ...(soulRep === undefined ? {} : { soulCorrupted: { stats: statsOf(soulRep), drops: [] } }),
  };
  return {
    mob, tags: tagsOf(candidate.rows), closure,
    ...(soulRep === undefined ? {} : { soul: { tags: tagsOf(soulRows), closure: traitClosure(soulRep, ctx.rowsByKey) } }),
    references: [...refsOf(candidate.rows), ...refsOf(foldedRows), ...refsOf(soulRows)],
  };
}

/** Slugs of the named variants a base lists, in the order of its Variants.Replacements, then any others that point back by trait. */
function variantSlugs(base: Candidate, ctx: Context): string[] {
  const variants = ctx.kept.filter((entry) => entry.kind === "variant");
  const bases = ctx.kept.filter((entry) => entry.kind !== "variant");
  const order = base.rows.flatMap((row) => (row.Variants?.Replacements ?? []).map((rep) => tagKey(rep.TypeTagToUseInstead.TagName)));
  const mine = variants.filter((variant) => {
    const [rep] = variant.rows;
    return rep !== undefined && ownerSlugOf(variant, traitClosure(rep, ctx.rowsByKey), bases, ctx.slugs) === ctx.slugs.get(base.id);
  });
  const rank = (variant: Candidate): number => {
    const index = order.findIndex((key) => tagsOf(variant.rows).map(tagKey).includes(key));
    return index === -1 ? order.length : index;
  };
  return [...mine].sort((a, b) => rank(a) - rank(b)).flatMap((variant) => ctx.slugs.get(variant.id) ?? []);
}

function indexTags(drafts: readonly MobDraft[], folded: ReadonlyMap<string, Candidate[]>, ids: ReadonlyMap<string, string>): Map<string, string> {
  const index = new Map<string, string>();
  for (const draft of drafts) {
    const extra = (folded.get(draft.mob.id) ?? []).flatMap((entry) => tagsOf(entry.rows));
    for (const tag of [...draft.tags, ...extra, ...(draft.soul?.tags ?? [])]) index.set(tagKey(tag), ids.get(draft.mob.id) ?? draft.mob.slug);
  }
  return index;
}

const byKindThenName = (a: MobDraft, b: MobDraft): number =>
  KIND_ORDER.indexOf(a.mob.kind) - KIND_ORDER.indexOf(b.mob.kind) || a.mob.name.en.localeCompare(b.mob.name.en, "en");

export function buildMobs(tables: MobTables, locales: Locales): MobsResult {
  const rowsByKey = rowsIndex(tables);
  const { candidates, issues } = classifyRows(tables, locales, rowsByKey);
  const { kept, folded } = foldVariants(candidates, locales);
  const slugs = assignSlugs(kept, locales);
  const foldedTags = new Map([...folded].map(([id, entries]) => [id, entries.flatMap((entry) => tagsOf(entry.rows))] as const));
  const soul = matchSoul(tables, kept, foldedTags);
  const ctx: Context = { locales, rowsByKey, slugs, kept, folded, soul: soul.matched };
  const drafts = kept.flatMap((candidate) => toDraft(candidate, ctx) ?? []).sort(byKindThenName);
  return { drafts, tagIndex: indexTags(drafts, folded, slugs), issues: [...issues, ...soul.issues] };
}
