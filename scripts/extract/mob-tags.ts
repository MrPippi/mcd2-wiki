/** Gameplay tag helpers for the mob and loot tables. The game spells some tags "Sw." instead of "SW.". */

export const normalizeTag = (tag: string): string => tag.replace(/^sw\./i, "SW.");
export const tagKey = (tag: string): string => normalizeTag(tag).toLowerCase();

export interface TaggedRow {
  readonly TypeTag: { readonly TagName: string };
  readonly Traits?: { readonly GameplayTags?: readonly { readonly TagName: string }[] };
}

/** Every trait tag a row has, directly or through the rows that own its tags: nearest first, no repeats. */
export function traitClosure(row: TaggedRow, rowsByKey: ReadonlyMap<string, TaggedRow>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const queue: TaggedRow[] = [row];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    for (const { TagName } of next.Traits?.GameplayTags ?? []) {
      const key = tagKey(TagName);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(normalizeTag(TagName));
      const owner = rowsByKey.get(key);
      if (owner) queue.push(owner);
    }
  }
  return result;
}
