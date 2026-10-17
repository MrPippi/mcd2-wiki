/**
 * The drop odds model (src/data/drop-models.json): for each trigger the site covers (drop-sources.ts) the slots it rolls with
 * their pools, the rarity rows that apply, and the tables the browser needs to turn those into a chance for any threat level,
 * difficulty and target rarity (src/lib/drop-odds.ts). Nothing here is read from the game's code; the rules are what the 1.1.2
 * data supports (drop-slots.ts, drop-pool.ts, drop-rarity-rows.ts, drop-universe.ts say which), checked against a third-party
 * table of 15,938 chances at threat 20 on Normal.
 */
import { compileDrops } from "./drop-compile";
import { buildHierarchy, createSlotResolver, slotNameOf, unknownOperations } from "./drop-slots";
import { difficultyRarityOps } from "./drop-rarity-rows";
import { DropDataSchema, type DropData } from "./drop-schema";
import type { DropFile } from "../../src/lib/drop-types";
import { planSources, type PlanInput } from "./drop-sources";
import { slotRuleOf, type DropTables } from "./drop-tables";
import type { ProfileContext } from "./drop-profile";
import { buildUniverse, type Universe } from "./drop-universe";
import type { LootTables } from "./loot-tables";
import type { ThreatRow } from "./guides-schema";
import { issue, type Issue } from "./issues";
import type { Entry } from "./schemas";

export interface DropInput extends PlanInput {
  readonly tables: DropTables;
  readonly entries: readonly Entry[];
  readonly threat: readonly ThreatRow[];
}

export const NO_DROPS: DropFile = { levels: [], rarityFactors: [], difficulties: { normal: [] }, slots: {}, items: [], pools: {}, profiles: {}, sources: [] };

/** One entry per difficulty: the rarity ops its row adds, keyed by the row's lower-cased name. */
function difficultiesOf(tables: DropTables): DropFile["difficulties"] {
  return Object.fromEntries(tables.difficulties.map((row) => [row.Name.toLowerCase(), difficultyRarityOps(row.TypeTag.TagName, tables.rarityChance)]));
}

/** The rules of the slots the profiles use. */
function rulesOf(tables: DropTables, used: ReadonlySet<string>): DropFile["slots"] {
  return Object.fromEntries(
    tables.slotRules.flatMap((row) => {
      const name = slotNameOf(row.TypeTag.TagName);
      return used.has(name) ? [[name, slotRuleOf(row)] as const] : [];
    }),
  );
}

/** The universe and profile context for these tables: what a trigger's profile is built from. */
export function createDropContext(loot: LootTables, tables: DropTables, entries: readonly Entry[]): { universe: Universe; context: ProfileContext } {
  const universe = buildUniverse(loot, entries);
  const rows = [loot.generic, loot.mob, loot.area, loot.lootActor, loot.quest].flat();
  const parents = buildHierarchy([...rows, ...tables.hierarchy]);
  return {
    universe,
    context: {
      resolver: createSlotResolver({ rows, parents, membersOf: universe.membersOf }),
      parents,
      rarityRows: tables.rarityChance,
      isPublished: (id) => universe.items.get(id)?.key !== undefined,
    },
  };
}

export function buildDropModels(input: DropInput): { data: DropFile; issues: Issue[] } {
  const withFactors = input.threat.filter((row) => row.rarity);
  if (withFactors.length === 0) return { data: NO_DROPS, issues: [issue("guides-value-missing", "drop odds: no rarity chance factors per threat level")] };
  const { universe, context } = createDropContext(input.loot, input.tables, input.entries);
  const planning = planSources(input, context);
  const compiled = compileDrops(universe, planning.planned);
  const used = new Set(Object.values(compiled.profiles).flatMap((profile) => profile.slots.map((slot) => slot.slot)));
  const unknown = unknownOperations([input.loot.generic, input.loot.mob, input.loot.area, input.loot.lootActor, input.loot.quest].flat());
  return {
    data: {
      levels: withFactors.map((row) => row.level),
      rarityFactors: withFactors.flatMap((row) => (row.rarity ? [[row.rarity.common, row.rarity.rare, row.rarity.special, row.rarity.unique] as [number, number, number, number]] : [])),
      difficulties: difficultiesOf(input.tables),
      slots: rulesOf(input.tables, used),
      ...compiled,
    },
    issues: [
      ...planning.issues,
      ...unknown.map((name) => issue("drop-ignored", `loot rows: operation ${name} is not applied`)),
      ...[...used].filter((name) => name !== "none" && !input.tables.slotRules.some((row) => slotNameOf(row.TypeTag.TagName) === name)).map((name) => issue("drop-ignored", `slot ${name} has no slot rule: its draws are independent`)),
    ],
  };
}

/** The model checked against its schema; a malformed model stops the extract. */
export const parseDropData = (data: DropFile): DropData => DropDataSchema.parse(data);
