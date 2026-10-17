/**
 * The weighted pool of effect templates an item rolls from, rebuilt from the DataTables. Nothing here is read from the
 * game's code; the rules below are what the 1.1.2 data supports, and the third-party per-threat odds table (1.1.1) agrees
 * with them in every cell:
 * - every drop table row (DT_EffectTemplateGroupDropTableDefinition) is keyed by one item tag and names pool groups with a
 *   weight and an operation (all Set today); an item uses the rows of all its tags, their parents included, and of
 *   SW.Item.Property.Gear that every item has (it gives the Utility archetype group 0.25);
 * - an item row also has the tags of the item row whose own tag it carries (the elemental quivers carry the Quiver row's
 *   tag, which brings the Ranger archetype), and every artifact has SW.Item.Property.Artifact, which the Well and Quiver
 *   rows leave out;
 * - a pool group several rows name (Mushroom armor: the Utility archetype says 1, the gear row 0.25) takes the last Set in
 *   tag order, the gear tag last; the game rolls 0.25;
 * - SecondaryETG is empty in every row, so it is read like PrimaryETG;
 * - a group (DT_EffectTemplateGroupDefinition) lists templates with their own weight and operation, and the pool group's
 *   weight scales their Set and Add entries; templates listed by several groups collect an entry from each.
 */
import { GEAR_TAG, tagNames } from "./game-rows";
import type { GameTables, WeightedTagValue } from "./game-tables";

type ItemRow = GameTables["items"][number];

export type Operation = "set" | "add" | "multiply";

const operationOf = (tag: WeightedTagValue): Operation => {
  const name = (tag.Operation ?? "set").toLowerCase();
  return name === "add" || name === "multiply" ? name : "set";
};

interface Weighted {
  readonly target: string;
  readonly operation: Operation;
  readonly weight: number;
  /** Which Set wins among several: the highest rank (the row of the item's tag order, the gear row last of all). */
  readonly rank: number;
}

const weighted = (tags: readonly WeightedTagValue[] | undefined, rank = 0): Weighted[] =>
  (tags ?? []).map((tag) => ({ target: tag.TypeTag.TagName, operation: operationOf(tag), weight: tag.Weight ?? 1, rank }));

/** Every tag plus its parents (A.B.C also counts as A.B and A). */
export function withParents(tags: readonly string[]): Set<string> {
  return new Set(tags.flatMap((tag) => tag.split(".").map((_, index, parts) => parts.slice(0, index + 1).join("."))));
}

/** The tags the drop table is matched with: the item's own, their parents, and the gear tag. */
export const poolTags = (itemTags: readonly string[]): Set<string> => withParents([...itemTags, GEAR_TAG]);

/**
 * Combines the weights several drop table rows give one pool group: the Set of the highest rank wins (rows rank by the
 * item's tag order, and the gear row outranks every tag), Add entries sum and Multiply entries multiply. Only the Mushroom
 * armor shows it: its Utility archetype row says 1, the gear row 0.25, and the game rolls 0.25.
 */
export function combineGroup(parts: readonly Pick<Weighted, "operation" | "weight" | "rank">[]): number {
  const of = (operation: Operation) => parts.filter((part) => part.operation === operation);
  const winner = of("set").reduce<Pick<Weighted, "weight" | "rank"> | undefined>((best, part) => (best === undefined || part.rank >= best.rank ? part : best), undefined);
  const add = of("add").reduce((sum, part) => sum + part.weight, 0);
  const multiply = of("multiply").reduce((product, part) => product * part.weight, 1);
  return Math.max(0, ((winner?.weight ?? 0) + add) * multiply);
}

/** The pool groups an item rolls from and their weights, from the drop table rows its tags match. */
export function poolGroups(tags: ReadonlySet<string>, tables: GameTables): Map<string, number> {
  const entries = [...tags].flatMap((tag, index) =>
    tables.dropTable
      .filter((row) => row.TypeTag.TagName === tag)
      .flatMap((row) => [...weighted(row.PrimaryETG?.Tags, tag === GEAR_TAG ? Infinity : index), ...weighted(row.SecondaryETG?.Tags, tag === GEAR_TAG ? Infinity : index)]),
  );
  const targets = [...new Set(entries.map((entry) => entry.target))];
  return new Map(targets.map((target) => [target, combineGroup(entries.filter((entry) => entry.target === target))]));
}

export interface TemplateOps {
  readonly template: string;
  readonly ops: readonly (readonly [Operation, number])[];
}

/** For each template the pool groups list: its entries, Set and Add ones scaled by the group's weight. */
export function groupTemplates(groups: ReadonlyMap<string, number>, tables: GameTables): TemplateOps[] {
  const listed = tables.groups
    .filter((group) => groups.has(group.TypeTag.TagName))
    .flatMap((group) => weighted(group.TagList?.Tags).map((entry) => ({ ...entry, group: groups.get(group.TypeTag.TagName) ?? 0 })));
  const templates = [...new Set(listed.map((entry) => entry.target))];
  return templates.map((template) => ({
    template,
    ops: listed
      .filter((entry) => entry.target === template)
      .map((entry): readonly [Operation, number] => [entry.operation, entry.operation === "multiply" ? entry.weight : entry.weight * entry.group]),
  }));
}

/** An item's tags plus the traits of every item row whose own tag it carries, followed to the end (cycles are cut). */
export function inheritedTags(item: ItemRow, rows: readonly ItemRow[]): string[] {
  const byTag = new Map(rows.flatMap((row) => (row.TypeTag ? [[row.TypeTag.TagName, row] as const] : [])));
  const visit = (row: ItemRow, seen: ReadonlySet<string>): string[] =>
    tagNames(row.Traits).flatMap((tag) => {
      const parent = byTag.get(tag);
      // The tag is listed even when it is a cycle's way back (the final Set drops repeats); only following it again is cut.
      return [tag, ...(parent && !seen.has(tag) ? visit(parent, new Set([...seen, tag])) : [])];
    });
  return [...new Set(visit(item, new Set(item.TypeTag ? [item.TypeTag.TagName] : [])))];
}
