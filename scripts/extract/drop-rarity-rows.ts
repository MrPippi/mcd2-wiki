/**
 * The rarity rows (DT_RarityChanceDefinition) a drop matches, as the ops the site combines with the threat factors
 * (src/lib/drop-rarity.ts). A row applies when its TypeTag is a tag of the drop's context (the source, its area, their parents);
 * a row's own traits lead on to further rows, which is how every area, mob and the player reach the Default weights. The
 * player is always part of the context, and the difficulty row is added on top when one is chosen. Rows that set the weight
 * of None (talismans, books, currencies) change nothing for gear, so None is left out.
 */
import { tagKey } from "./mob-tags";
import type { RarityIndex, RarityOp, RarityOpName } from "../../src/lib/drop-types";

export interface RarityRow {
  readonly TypeTag: { readonly TagName: string };
  readonly Traits?: { readonly GameplayTags?: readonly { readonly TagName: string }[] };
  readonly TagList: {
    readonly Tags?: readonly { readonly TypeTag: { readonly TagName: string }; readonly Weight: number; readonly Operation: string }[];
  };
}

const PLAYER = "SW.Player";
const RARITY_TAGS: readonly string[] = ["sw.rarity.common", "sw.rarity.rare", "sw.rarity.special", "sw.rarity.unique"];
const OPERATIONS: Readonly<Record<string, RarityOpName>> = { set: "s", add: "a", multiply: "m" };
const OP_ORDER: readonly RarityOpName[] = ["s", "a", "m"];

/** The rows for the tags and, through their traits, the rows those lead to; each row once. */
function reachedRows(tags: readonly string[], rows: readonly RarityRow[]): RarityRow[] {
  const byKey = new Map(rows.map((one) => [tagKey(one.TypeTag.TagName), one] as const));
  const seen = new Set<string>();
  const found: RarityRow[] = [];
  const queue = [...tags];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    const key = tagKey(next);
    const one = byKey.get(key);
    if (seen.has(key) || !one) continue;
    seen.add(key);
    found.push(one);
    queue.push(...(one.Traits?.GameplayTags ?? []).map((trait) => trait.TagName));
  }
  return found;
}

function opsOfRows(found: readonly RarityRow[]): RarityOp[] {
  const ops = found.flatMap((one) =>
    (one.TagList.Tags ?? []).flatMap((entry): RarityOp[] => {
      const rarity = RARITY_TAGS.indexOf(tagKey(entry.TypeTag.TagName));
      const op = OPERATIONS[entry.Operation.toLowerCase()];
      return rarity === -1 || op === undefined ? [] : [[rarity as RarityIndex, op, entry.Weight]];
    }),
  );
  return ops.sort((a, b) => a[0] - b[0] || OP_ORDER.indexOf(a[1]) - OP_ORDER.indexOf(b[1]) || a[2] - b[2]);
}

/** The rarity ops of a drop whose context holds these tags (the player is always in it). */
export const contextRarityOps = (contextTags: readonly string[], rows: readonly RarityRow[]): RarityOp[] =>
  opsOfRows(reachedRows([PLAYER, ...contextTags], rows));

/** The rarity ops a difficulty adds, from the row with its tag. */
export const difficultyRarityOps = (difficultyTag: string, rows: readonly RarityRow[]): RarityOp[] =>
  opsOfRows(reachedRows([difficultyTag], rows));
