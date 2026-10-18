/**
 * Regular mobs. Every regular hostile mob shares one loot row (SW.Mob.Default.Hostile), and a Soul Corrupted one another
 * (SW.Mob.Default.SoulStated); both draw from the pool of the area they are in, so the odds depend on the area and not on the
 * mob. They are planned as a few sources with one context per area, not one source per mob: the Geomancer is the one mob whose
 * row changes the pool (its artifacts weigh double), so it has its own sources.
 */
import { poolWeights } from "./drop-pool";
import { profileOfSpecs, type ProfileContext, type RawProfile, type SlotSpec } from "./drop-profile";
import { closureOf } from "./drop-slots";
import type { Place, Planned, Planning, PlanInput } from "./drop-sources";
import { issue, type Issue } from "./issues";
import type { Mob, MobDrop } from "./mob-schema";
import { tagKey } from "./mob-tags";

const HOSTILE_TAG = "SW.Mob.Default.Hostile";
const SOUL_TAG = "SW.Mob.Default.SoulStated";
const GEOMANCER = "Geomancer";
const GEOMANCER_TAG = "SW.Mob.Geomancer";
const PIGGY_BANK = "PiggyBank";
const REGULAR_KINDS: ReadonlySet<string> = new Set(["regular", "variant"]);

/** The nearest place (area with a drop pool) an area is, or is below; undefined when no pool is in its chain. */
export function nearestPlace(areaTag: string, places: readonly Place[], parents: (tag: string) => readonly string[]): Place | undefined {
  return closureOf([areaTag], parents).flatMap((tag) => places.filter((place) => tagKey(place.tag) === tag))[0];
}

/** The item slot of a mob state that draws at least once from a pool the area decides, as a spec. */
const itemSpecOf = (drops: readonly MobDrop[]): SlotSpec | undefined => {
  const drop = drops.find((one) => one.slot === "item" && one.pool !== "own" && (one.guaranteed > 0 || one.rolls > 0));
  return drop && { slot: "item", guaranteed: drop.guaranteed, rolls: drop.rolls, chance: drop.chancePerRoll };
};

const signature = (spec: SlotSpec): string => `${spec.guaranteed}+${spec.rolls}@${spec.chance}`;

interface Group {
  readonly id: string;
  /** Rarity tags, and the rows whose pool changes are merged into the area's pool. */
  readonly tags: readonly string[];
  readonly poolTags: readonly string[];
  readonly spec: SlotSpec;
  /** The area tags the group's mobs are found in. */
  readonly areas: readonly string[];
}

interface Kind {
  readonly id: string;
  readonly label: string;
  readonly tags: readonly string[];
  readonly poolTags: readonly string[];
  readonly from: (mobs: readonly Mob[]) => readonly Mob[];
  readonly drops: (mob: Mob) => readonly MobDrop[];
}

const isRegular = (mob: Mob): boolean => REGULAR_KINDS.has(mob.kind) && mob.id !== PIGGY_BANK && mob.id !== GEOMANCER;
const normalDrops = (mob: Mob): readonly MobDrop[] => mob.drops;
const soulDrops = (mob: Mob): readonly MobDrop[] => mob.soulCorrupted?.drops ?? [];

const KINDS: readonly Kind[] = [
  { id: "regular:Hostile", label: "regular mobs", tags: [HOSTILE_TAG], poolTags: [], from: (mobs) => mobs.filter(isRegular), drops: normalDrops },
  { id: "regular:SoulStated", label: "Soul Corrupted mobs", tags: [SOUL_TAG, HOSTILE_TAG], poolTags: [], from: (mobs) => mobs.filter(isRegular), drops: soulDrops },
  { id: "regular:Geomancer", label: "Geomancer", tags: [HOSTILE_TAG, GEOMANCER_TAG], poolTags: [GEOMANCER_TAG], from: (mobs) => mobs.filter((mob) => mob.id === GEOMANCER), drops: normalDrops },
  { id: "regular:Geomancer:soul", label: "Soul Corrupted Geomancer", tags: [SOUL_TAG, HOSTILE_TAG, GEOMANCER_TAG], poolTags: [GEOMANCER_TAG], from: (mobs) => mobs.filter((mob) => mob.id === GEOMANCER), drops: soulDrops },
];

/** One group of a kind: the counts most of its mobs agree on (the mobs that differ are reported) and the areas those mobs are in. */
function groupOf(kind: Kind, mobs: readonly Mob[]): { group?: Group; issues: Issue[] } {
  const have = kind.from(mobs).flatMap((mob) => {
    const spec = itemSpecOf(kind.drops(mob));
    return spec ? [{ mob, spec }] : [];
  });
  const votes = new Map<string, number>();
  for (const { spec } of have) votes.set(signature(spec), (votes.get(signature(spec)) ?? 0) + 1);
  const top = [...votes].sort((a, b) => b[1] - a[1])[0];
  if (!top) return { issues: [] };
  const agreeing = have.filter(({ spec }) => signature(spec) === top[0]);
  const odd = have.length - agreeing.length;
  return {
    group: { id: kind.id, tags: kind.tags, poolTags: kind.poolTags, spec: agreeing[0].spec, areas: [...new Set(agreeing.flatMap(({ mob }) => mob.areas.map((area) => area.areaId)))] },
    issues: odd > 0 ? [issue("drop-ignored", `${kind.id}: ${odd} of ${have.length} ${kind.label} differ from the item slot ${top[0]}; those counts are not used`)] : [],
  };
}

/** Whether two areas give the same item pool (a sub-area is covered by its parent place only if it does). */
const samePool = (context: ProfileContext, a: string, b: string): boolean => {
  const weights = (tag: string): string => JSON.stringify(poolWeights(context.resolver.resolve(tag, "item")?.pool ?? new Map()));
  return weights(a) === weights(b);
};

/** Regular mobs and their Soul Corrupted state: per group one source, one context per place with a drop pool. */
export function planRegular(input: PlanInput, context: ProfileContext, places: { areas: readonly Place[] }): Planning {
  const built = KINDS.map((kind) => groupOf(kind, input.mobs.mobs));
  const issues: Issue[] = built.flatMap((one) => one.issues);
  const planned = built.flatMap(({ group }): Planned[] => {
    if (!group) return [];
    const mapped = group.areas.map((area) => ({ area, place: nearestPlace(area, places.areas, context.parents) }));
    issues.push(...mapped.filter((one) => !one.place).map((one) => issue("drop-ignored", `${group.id}: ${one.area} has no drop pool, its mobs are not covered there`)));
    issues.push(...mapped.filter((one) => one.place && !samePool(context, one.area, one.place.tag)).map((one) => issue("drop-ignored", `${group.id}: ${one.area} does not give the pool of ${one.place?.tag}`)));
    const found = [...new Map(mapped.flatMap((one) => (one.place ? [[one.place.id, one.place] as const] : []))).values()];
    const profiles = found.map((place) => [place.id, profileOfSpecs(context, [group.spec], place.tag, group.tags, group.poolTags)] as const);
    issues.push(...[...new Set(profiles.flatMap(([, profile]) => profile.skipped))].map((reason) => issue("drop-ignored", `${group.id}: slot left out, ${reason}`)));
    const contexts: (readonly [string, RawProfile])[] = profiles.filter(([, profile]) => profile.slots.length > 0);
    return contexts.length > 0 ? [{ id: group.id, kind: "regular", contexts }] : [];
  });
  return { planned, issues };
}
