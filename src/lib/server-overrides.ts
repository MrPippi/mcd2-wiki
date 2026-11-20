/**
 * Values the game's servers changed without a client update (e.g. 1.1.4.0), so `npm run extract` cannot see them:
 * hand-written in src/server-overrides.json and applied on top of the extracted data. Each records the value the game
 * files hold (`was`); when the files stop holding it, the build fails so the override is rechecked or removed.
 * Server-side only.
 */
import { z } from "zod";
import type { GuidesData } from "../../shared/guides-schema";
import { STAT_KEYS, type Mob } from "../../shared/mob-schema";
import rawOverrides from "../server-overrides.json";

type Caps = NonNullable<GuidesData["caps"]>;
const CAP_KEYS = ["emeralds", "echoShards", "level"] as const satisfies readonly (keyof Caps)[];

const changed = <T extends { value: number; was: number }>(one: T): boolean => one.value !== one.was;
const Base = {
  value: z.number(),
  /** What the game files hold. */
  was: z.number(),
  /** The update that changed it on the servers. */
  version: z.string().regex(/^[0-9][0-9A-Za-z._-]*$/),
};
const CapOverrideSchema = z.object({ key: z.enum(CAP_KEYS), ...Base }).refine(changed, "an override must change the value");
const MobOverrideSchema = z.object({ mob: z.string().min(1), key: z.enum(STAT_KEYS), ...Base }).refine(changed, "an override must change the value");

export const ServerOverridesSchema = z.object({ caps: z.array(CapOverrideSchema), mobStats: z.array(MobOverrideSchema) });
export type ServerOverrides = z.infer<typeof ServerOverridesSchema>;
export type CapOverride = ServerOverrides["caps"][number];
export type MobOverride = ServerOverrides["mobStats"][number];

export const serverOverrides: ServerOverrides = ServerOverridesSchema.parse(rawOverrides);

/** The extracted value must still be the one the override was written against. */
function checkWas(where: string, extracted: number, one: { value: number; was: number; version: string }): void {
  if (extracted === one.value) throw new Error(`server override ${where}: the game data is already ${one.value}; remove the override`);
  if (extracted !== one.was) {
    throw new Error(`server override ${where}: expected ${one.was} in the game data, found ${extracted}; recheck the ${one.version} override`);
  }
}

/** The caps with the server's values; the input is left as is. */
export function applyCapOverrides(caps: Caps, overrides: ServerOverrides = serverOverrides): Caps {
  return overrides.caps.reduce<Caps>((result, one) => {
    checkWas(`caps.${one.key}`, result[one.key], one);
    return { ...result, [one.key]: one.value };
  }, caps);
}

function overrideMob(mob: Mob, list: readonly MobOverride[]): Mob {
  const stats = list.reduce<Mob["stats"]>((result, one) => {
    const stat = result.find((s) => s.key === one.key);
    if (!stat) throw new Error(`server override ${one.mob}.${one.key}: the mob has no ${one.key} stat`);
    checkWas(`${one.mob}.${one.key}`, stat.value, one);
    return result.map((s) => (s.key === one.key ? { ...s, value: one.value } : s));
  }, mob.stats);
  return { ...mob, stats };
}

/** The mobs with the server's stats; mobs without overrides are passed through, the input is left as is. */
export function applyMobOverrides(mobs: readonly Mob[], overrides: ServerOverrides = serverOverrides): Mob[] {
  const missing = overrides.mobStats.find((one) => !mobs.some((mob) => mob.slug === one.mob));
  if (missing) throw new Error(`server override ${missing.mob}.${missing.key}: no mob with that slug`);
  return mobs.map((mob) => {
    const list = overrides.mobStats.filter((one) => one.mob === mob.slug);
    return list.length === 0 ? mob : overrideMob(mob, list);
  });
}

export const capOverride = (key: keyof Caps, overrides: ServerOverrides = serverOverrides): CapOverride | undefined =>
  overrides.caps.find((one) => one.key === key);

export const mobOverrides = (slug: string, overrides: ServerOverrides = serverOverrides): MobOverride[] =>
  overrides.mobStats.filter((one) => one.mob === slug);
