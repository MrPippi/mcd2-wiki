/** The drop odds table of an item page: rows by kind of source, with the default view (threat 20, Normal, any rarity). Server-side only. */
import { DropDataSchema } from "../../scripts/extract/drop-schema";
import type { Entry } from "../../scripts/extract/schemas";
import rawDrops from "../data/drop-models.json";
import { formatOdds } from "./affix-odds";
import { booksFor } from "./data";
import { areaLabel, sourceIndex, sourceLabel, type DropLabel } from "./drop-labels";
import { itemRows } from "./drop-odds";
import type { DropFile, DropRow, DropSelection } from "./drop-types";
import type { Lang, UiKey } from "./i18n";

/** The drop model from `npm run extract`, validated at build time. */
export const dropData: DropFile = DropDataSchema.parse(rawDrops);

/** False when the extract found no drop tables or rarity factors: the pages then show no drop odds at all. */
export const dropAvailable: boolean = dropData.levels.length > 0 && dropData.sources.length > 0;

export const DEFAULT_SELECTION: DropSelection = { level: dropData.levels.at(-1) ?? 1, difficulty: "normal", rarity: "any" };
/** Rows a group shows before the rest fold away. */
export const VISIBLE_ROWS = 10;

export type DropKind = DropFile["sources"][number]["kind"];
/** Groups in page order. */
const KIND_ORDER: readonly DropKind[] = ["chest", "mob", "quest"];
const KIND_HEADING: Readonly<Record<DropKind, UiKey>> = { chest: "sourceChests", mob: "questRelatedMobs", quest: "sourceQuests" };

export interface DropRowView {
  readonly source: DropLabel;
  readonly area?: DropLabel;
  readonly chance: string;
  readonly probability: number;
}

export interface DropGroupView {
  readonly kind: DropKind;
  readonly heading: UiKey;
  readonly rows: readonly DropRowView[];
  readonly visible: readonly DropRowView[];
  readonly folded: readonly DropRowView[];
}

const CATEGORIES: ReadonlySet<Entry["category"]> = new Set(["melee", "ranged", "armor", "artifact", "talisman"]);

/** The model keys an item page reads: its own, or for an enchantment those of its books. */
export function dropKeysOf(entry: Entry): string[] {
  if (entry.category === "enchantment") return booksFor(entry.slug).map((book) => `${book.category}/${book.slug}`);
  return CATEGORIES.has(entry.category) ? [`${entry.category}/${entry.slug}`] : [];
}

const cache = new Map<string, readonly DropRow[]>();

/**
 * The rows of an item page at the default view, best first; built once per item (they do not depend on the language). An
 * enchantment with several books gives the chance of at least one of them, not the best of them.
 */
export function dropRowsOf(entry: Entry, file: DropFile = dropData): readonly DropRow[] {
  const keys = dropKeysOf(entry);
  if (file !== dropData) return itemRows(file, keys, DEFAULT_SELECTION);
  const id = `${entry.category}/${entry.slug}`;
  const known = cache.get(id);
  if (known) return known;
  const rows = itemRows(file, keys, DEFAULT_SELECTION);
  cache.set(id, rows);
  return rows;
}

/** The page's groups in a language; empty for a page that is no item or an item nothing drops. */
export function dropGroupsOf(entry: Entry, lang: Lang, file: DropFile = dropData): DropGroupView[] {
  const rows = dropRowsOf(entry, file);
  const { byId } = sourceIndex(file.sources);
  return KIND_ORDER.flatMap((kind): DropGroupView[] => {
    const views = rows
      .filter((row) => byId.get(row.source)?.kind === kind)
      .map((row): DropRowView => {
        const source = byId.get(row.source);
        const area = areaLabel(lang, row.area);
        return {
          source: source ? sourceLabel(lang, source, file.sources) : { name: row.source },
          ...(area ? { area } : {}),
          chance: formatOdds(row.probability),
          probability: row.probability,
        };
      });
    return views.length === 0 ? [] : [{ kind, heading: KIND_HEADING[kind], rows: views, visible: views.slice(0, VISIBLE_ROWS), folded: views.slice(VISIBLE_ROWS) }];
  });
}
