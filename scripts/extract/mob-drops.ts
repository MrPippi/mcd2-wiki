/** How many drops each mob rolls per loot slot, from the mob loot rows (most specific row wins per slot). */
import { issue, type Issue } from "./issues";
import { hasPoolTags, slotsOf } from "./loot-slots";
import type { LootRow } from "./loot-tables";
import { LOOT_SLOT_KEYS, type MobDrop } from "./mob-schema";
import { tagKey } from "./mob-tags";
import type { MobDraft } from "./mobs";

const NO_LOOT = tagKey("SW.Trait.CannotDropLoot");
const FIXED_ORDER = ["SW.Trait.Boss", "SW.Trait.MiniBoss", "SW.Mob.Default.SoulStated", "SW.Mob.Default.Hostile"].map(tagKey);

function candidateRows(tags: readonly string[], closure: readonly string[], rows: readonly LootRow[]): LootRow[] {
  const byKey = new Map<string, LootRow>();
  for (const row of rows) if (!byKey.has(tagKey(row.TypeTag.TagName))) byKey.set(tagKey(row.TypeTag.TagName), row);
  const closureKeys = closure.map(tagKey);
  // The fixed tier tags are ordered last (step 3) even when the closure lists them early: the real closures list
  // Hostile before MiniBoss. A Soul Corrupted miniboss therefore uses the MiniBoss row (1 + 4 @ 25%), not SoulStated.
  const ordered = [
    ...tags.map(tagKey),
    ...closureKeys.filter((key) => !FIXED_ORDER.includes(key)),
    ...FIXED_ORDER.filter((key) => closureKeys.includes(key)),
  ];
  return [...new Set(ordered)].flatMap((key) => byKey.get(key) ?? []);
}

/** undefined = no loot row found; [] = rows exist but nothing drops (CannotDropLoot or empty slots). */
export function resolveDrops(tags: readonly string[], closure: readonly string[], rows: readonly LootRow[]): MobDrop[] | undefined {
  if (closure.some((tag) => tagKey(tag) === NO_LOOT)) return [];
  const candidates = candidateRows(tags, closure, rows);
  if (candidates.length === 0) return undefined;
  const perRow = candidates.map(slotsOf);
  return LOOT_SLOT_KEYS.flatMap((key): MobDrop[] => {
    const defined = perRow.flatMap((slots) => slots.get(key) ?? []);
    // A table-only row (0 guaranteed + 0 rolls) must not hide the counts of a lower row.
    const at = defined.findIndex((value) => value.NumberOfGuaranteedDrops > 0 || value.NumberOfRandomRolls > 0);
    const slot = defined[at];
    if (slot === undefined) return [];
    const ownList = defined.slice(0, at + 1).some(hasPoolTags);
    const pool = ownList ? "own" : slot.InheritParentDropTable ? "area" : "none";
    return [{ slot: key, guaranteed: slot.NumberOfGuaranteedDrops, rolls: slot.NumberOfRandomRolls, chancePerRoll: slot.DropChancePerRoll, pool }];
  });
}

/** Fills both the normal and the Soul Corrupted drops. Returns new drafts; the input is untouched. */
export function attachDrops(drafts: readonly MobDraft[], mobRows: readonly LootRow[]): { drafts: MobDraft[]; issues: Issue[] } {
  const issues: Issue[] = [];
  const result = drafts.map((draft): MobDraft => {
    const normal = resolveDrops(draft.tags, draft.closure, mobRows);
    if (normal === undefined) issues.push(issue("mob-loot-unresolved", draft.mob.slug));
    const soul = draft.soul === undefined ? undefined : resolveDrops(draft.soul.tags, draft.soul.closure, mobRows);
    const soulCorrupted = draft.mob.soulCorrupted === undefined ? undefined : { ...draft.mob.soulCorrupted, drops: soul ?? [] };
    return { ...draft, mob: { ...draft.mob, drops: normal ?? [], ...(soulCorrupted ? { soulCorrupted } : {}) } };
  });
  return { drafts: result, issues };
}
