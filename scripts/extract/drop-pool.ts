/**
 * Weighted item pools. A loot slot's DropTable lists tags with a weight and an operation; a tag names one item, an armor set,
 * or a property every member item has. The rules below are what the 1.1.2 data supports (the third-party drop baseline for
 * threat 20 agrees with them in every cell):
 * - a Set or Add weight is split equally among the member items of its tag, a Multiply applies to each member as it is;
 * - along one chain of rows a later Set replaces the item's earlier ops, Add sums and Multiply multiplies on top of it;
 * - pools of different rows or contexts merge per item: the largest Set, the sum of the Adds, the product of the Multiplies;
 * - an item's weight is max(0, (Set + Add) * Multiply); a tag that names no item (a currency) is an entry of its own, which
 *   keeps its weight in the pool although the site has no page for it.
 */
import { tagKey } from "./mob-tags";

export type OpName = "set" | "add" | "multiply";

export interface Op {
  readonly tag: string;
  readonly weight: number;
  readonly op: OpName;
}

/** What the ops of one pool say about one item. */
export interface State {
  readonly set: number | undefined;
  readonly add: number;
  readonly multiply: number;
}

/** Item id (the lower-cased item tag, or "~" plus the lower-cased tag of something without a page) → its ops. */
export type Pool = ReadonlyMap<string, State>;

/** The ids of the items a tag names; empty when it names none. */
export type MembersOf = (tag: string) => readonly string[];

const FRESH: State = { set: undefined, add: 0, multiply: 1 };

const nameOf = (op: Op, membersOf: MembersOf): readonly string[] => {
  const members = membersOf(op.tag);
  return members.length > 0 ? members : [`~${tagKey(op.tag)}`];
};

function applyOne(state: State, op: Op, share: number): State {
  switch (op.op) {
    case "set":
      return { ...FRESH, set: op.weight / share };
    case "add":
      return { ...state, add: state.add + op.weight / share };
    case "multiply":
      return { ...state, multiply: state.multiply * op.weight };
  }
}

/** The pool after the ops, in order. */
export function applyOps(pool: Pool, ops: readonly Op[], membersOf: MembersOf): Pool {
  return ops.reduce<Pool>((current, op) => {
    const ids = nameOf(op, membersOf);
    const next = new Map(current);
    for (const id of ids) next.set(id, applyOne(current.get(id) ?? FRESH, op, ids.length));
    return next;
  }, pool);
}

/** One pool from several: per item the largest Set, the sum of the Adds, the product of the Multiplies. */
export function mergePools(pools: readonly Pool[]): Pool {
  return pools.reduce<Pool>((merged, pool) => {
    const next = new Map(merged);
    for (const [id, state] of pool) {
      const known = merged.get(id);
      const set = known?.set === undefined ? state.set : state.set === undefined ? known.set : Math.max(known.set, state.set);
      next.set(id, known ? { set, add: known.add + state.add, multiply: known.multiply * state.multiply } : state);
    }
    return next;
  }, new Map());
}

export const weightOf = (state: State): number => Math.max(0, ((state.set ?? 0) + state.add) * state.multiply);

/** The items that can be drawn, with their weight. */
export function poolWeights(pool: Pool): [string, number][] {
  return [...pool].map(([id, state]): [string, number] => [id, weightOf(state)]).filter(([, weight]) => weight > 0);
}
