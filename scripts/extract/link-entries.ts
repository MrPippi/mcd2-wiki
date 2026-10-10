import { byLang, localizedFrom } from "../../src/lib/lang";
import { LANGS, type Lang } from "./config";
import { issue, type Issue } from "./issues";
import { baseId, toSlug } from "./keys";
import { ARMOR_PIECES, type ArmorSet, type Entry } from "./schemas";

export interface LinkResult {
  readonly entries: Entry[];
  readonly armorSets: ArmorSet[];
  readonly issues: Issue[];
}

interface SetDraft {
  readonly id: string;
  readonly slug: string;
  readonly variant: Entry["variant"];
  readonly members: readonly Entry[];
}

const BOOK_PREFIX = /^EnchantmentBook_/;
const PIECE_PATTERN = /(Helmet|Chest|Leggings|Boots)/;
const entryKey = (entry: Entry): string => `${entry.category}:${entry.id}`;
const normalizeName = (name: string): string => name.trim().toLowerCase();

export function commonPrefix(values: readonly string[]): string {
  if (values.length === 0) return "";
  return values.reduce((prefix, value) => {
    let i = 0;
    while (i < prefix.length && i < value.length && prefix[i] === value[i]) i += 1;
    return prefix.slice(0, i);
  });
}

function trimToWordBoundary(prefix: string, names: readonly string[]): string {
  const atBoundary =
    /\s$/.test(prefix) || names.every((name) => name.length === prefix.length || /\s/.test(name.charAt(prefix.length)));
  return atBoundary ? prefix : prefix.slice(0, prefix.lastIndexOf(" ") + 1);
}

export function setNameFor(lang: Lang, names: readonly string[]): string | undefined {
  if (names.length < 2) return undefined;
  const prefix = commonPrefix(names);
  const cut = lang === "en" ? trimToWordBoundary(prefix, names) : prefix.replace(/之$/, "");
  const trimmed = cut.trim();
  return [...trimmed].length >= 2 ? trimmed : undefined;
}

function variantLinks(published: readonly Entry[]): Map<string, string[]> {
  const groups = new Map<string, Entry[]>();
  for (const entry of published) {
    const key = `${entry.category}:${baseId(entry.id)}`;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return new Map(
    published.map((entry) => {
      const group = groups.get(`${entry.category}:${baseId(entry.id)}`) ?? [];
      return [entryKey(entry), group.filter((other) => other !== entry).map((other) => other.slug)];
    }),
  );
}

function bookLinks(published: readonly Entry[]) {
  const enchantments = published.filter((entry) => entry.category === "enchantment");
  const byId = new Map(enchantments.map((entry) => [entry.id, entry]));
  const byName = new Map(enchantments.map((entry) => [normalizeName(entry.name.en), entry]));
  const pairs = published
    .filter((entry) => entry.category === "enchantment-book")
    .map((book) => ({
      book,
      target: byId.get(book.id.replace(BOOK_PREFIX, "")) ?? byName.get(normalizeName(book.name.en)),
    }));
  const linked = pairs.flatMap((pair) => (pair.target ? [{ book: pair.book, target: pair.target }] : []));
  return {
    bookToEnchantment: new Map(linked.map((pair) => [pair.book.id, pair.target.slug])),
    enchantmentToBook: new Map(linked.map((pair) => [pair.target.id, pair.book.slug])),
    issues: pairs.filter((pair) => !pair.target).map((pair) => issue("unlinked-enchantment", pair.book.id)),
  };
}

function setIdentity(entry: Entry): { id: string; slug: string } | undefined {
  const match = PIECE_PATTERN.exec(baseId(entry.id));
  if (!match) return undefined;
  const setBase = baseId(entry.id).replace(match[1], "");
  if (setBase === "") return undefined;
  return entry.variant === "unique"
    ? { id: `${setBase}_Unique`, slug: `${toSlug(setBase)}-unique` }
    : { id: setBase, slug: toSlug(setBase) };
}

/** Languages whose set names come from the pieces' common prefix; the rest take English until Task 5 adds their rules. */
const PREFIX_LANGS: readonly Lang[] = ["zh", "en"];

function toArmorSet(draft: SetDraft): { set: ArmorSet; issues: Issue[] } {
  const fallback = draft.variant === "unique" ? `${draft.id.replace(/_Unique$/, "")} (Unique)` : draft.id;
  const prefixed = byLang((lang) => (PREFIX_LANGS.includes(lang) ? setNameFor(lang, draft.members.map((member) => member.name[lang])) : undefined));
  const english = prefixed.en ?? fallback;
  const untranslated = LANGS.filter((lang) => lang !== "en" && prefixed[lang] === undefined);
  const pieces = Object.fromEntries(
    ARMOR_PIECES.flatMap((piece) => {
      const member = draft.members.find((candidate) => candidate.armorPiece === piece);
      return member ? [[piece, member.slug]] : [];
    }),
  ) as ArmorSet["pieces"];
  const name = localizedFrom((lang) => prefixed[lang] ?? (lang === "zh" ? fallback : english));
  return {
    set: { id: draft.id, slug: draft.slug, variant: draft.variant, name, pieces, ...(untranslated.length > 0 ? { untranslated } : {}) },
    issues: prefixed.zh && prefixed.en ? [] : [issue("armor-set-name-fallback", draft.id)],
  };
}

function buildArmorSets(published: readonly Entry[]) {
  const drafts = new Map<string, SetDraft>();
  for (const entry of published.filter((candidate) => candidate.category === "armor" && candidate.armorPiece)) {
    const identity = setIdentity(entry);
    if (!identity) continue;
    const previous = drafts.get(identity.slug);
    drafts.set(identity.slug, { ...identity, variant: entry.variant, members: [...(previous?.members ?? []), entry] });
  }
  const built = [...drafts.values()].map(toArmorSet);
  return {
    sets: built.map((result) => result.set).sort((a, b) => a.slug.localeCompare(b.slug, "en")),
    pieceToSet: new Map([...drafts.values()].flatMap((draft) => draft.members.map((member) => [member.id, draft.slug] as const))),
    issues: built.flatMap((result) => result.issues),
  };
}

function compactLinks(links: Entry["links"]): Entry["links"] {
  return Object.fromEntries(
    Object.entries(links).filter(([, value]) => value !== undefined && !(Array.isArray(value) && value.length === 0)),
  );
}

export function linkEntries(entries: readonly Entry[]): LinkResult {
  const published = entries.filter((entry) => entry.release === "base");
  const variants = variantLinks(published);
  const books = bookLinks(published);
  const armor = buildArmorSets(published);
  const linked = entries.map((entry): Entry => {
    if (entry.release !== "base") return { ...entry, links: {} };
    return {
      ...entry,
      links: compactLinks({
        variants: variants.get(entryKey(entry)),
        enchantment: entry.category === "enchantment-book" ? books.bookToEnchantment.get(entry.id) : undefined,
        enchantmentBook: entry.category === "enchantment" ? books.enchantmentToBook.get(entry.id) : undefined,
        armorSet: entry.category === "armor" ? armor.pieceToSet.get(entry.id) : undefined,
      }),
    };
  });
  return { entries: linked, armorSets: armor.sets, issues: [...books.issues, ...armor.issues] };
}
