import { z } from "zod";
import { SlugSchema, type Entry } from "../../scripts/extract/schemas";
import { WeaponDataSchema, type EffectFormat, type WeaponData } from "../../scripts/extract/weapon-schema";
import rawOverrides from "../data/fixed-bonus-overrides.json";
import rawWeapons from "../data/weapons.json";
import { findBaseEntry, publishedEntries } from "./data";

/** Weapon stats and effect rules read from the game's DataTables by `npm run extract`. */
export const weaponData: WeaponData = WeaponDataSchema.parse(rawWeapons);

/**
 * Fixed-bonus numbers the DataTables cannot give (they live in ability blueprints), keyed by weapon slug,
 * each with where it was checked.
 */
const ValueOverridesSchema = z.record(SlugSchema, z.object({ value: z.string(), source: z.string() }));
const valueOverrides = ValueOverridesSchema.parse(rawOverrides);

export interface ResolvedWeaponEffects {
  /** Effects the weapon can roll, with their printed tier I/II/III values. */
  readonly compatible: readonly { readonly effect: Entry; readonly values: readonly [string, string, string] }[];
  readonly fixed?: {
    readonly kind: "effect" | "enchantment";
    readonly entry: Entry;
    readonly value?: string;
    /** Whether the entry has a page of its own to link to. */
    readonly linked: boolean;
    /** The value was checked by hand, not read from the game data. */
    readonly manualValue: boolean;
  };
}

const PLACEHOLDER = /<span class="placeholder">\{[^}]*\}<\/span>/g;

/** Game text with its single `{value}` placeholder replaced by `value`; text with none or several stays as it is. */
export function fillPlaceholder(html: string, value: string): string {
  const matches = html.match(PLACEHOLDER) ?? [];
  return matches.length === 1 ? html.replace(PLACEHOLDER, `<span class="value">${value}</span>`) : html;
}

/** Tier I to tier III as one range, e.g. "5%~15%"; a single value when the tiers do not differ. */
export const tierRange = ([low, , high]: readonly [string, string, string]): string => (low === high ? low : `${low}~${high}`);

/** A magnitude the way the game prints it: scaled, offset, as a percentage when the effect says so. */
export function formatMagnitude(value: number, format: EffectFormat | undefined): string {
  if (!format) return String(value);
  const scaled = (value * format.multiplier + format.offset) * (format.percent ? 100 : 1);
  const factor = 10 ** format.maxFractionDigits;
  const rounded = Math.round(scaled * factor) / factor;
  return format.percent ? `${rounded}%` : String(rounded);
}

const published = (category: Entry["category"], slug: string): Entry | undefined =>
  publishedEntries.find((entry) => entry.category === category && entry.slug === slug);

function fixedBonus(weapon: Entry): ResolvedWeaponEffects["fixed"] {
  const fixed = weaponData.weapons[weapon.slug]?.fixed;
  if (!fixed) return undefined;
  // Some fixed enchantments have no page (no icon, or only a book names them): show their text unlinked.
  const page = fixed.kind === "enchantment-book" ? undefined : published(fixed.kind, fixed.slug);
  const entry = page ?? findBaseEntry(fixed.kind, fixed.slug);
  if (!entry) return undefined;
  const override = valueOverrides[weapon.slug];
  const format = weaponData.effectFormats[fixed.slug];
  const value = override?.value ?? (fixed.kind === "effect" && fixed.value !== undefined && format ? formatMagnitude(fixed.value, format) : undefined);
  return {
    kind: fixed.kind === "effect" ? "effect" : "enchantment",
    entry,
    ...(value ? { value } : {}),
    linked: page !== undefined,
    manualValue: override !== undefined,
  };
}

/** A weapon's game effect data joined to the site's entries; undefined when the entry is not a weapon. */
export function weaponEffectsOf(weapon: Entry): ResolvedWeaponEffects | undefined {
  if (weapon.category !== "melee" && weapon.category !== "ranged") return undefined;
  const data = weaponData.weapons[weapon.slug];
  if (!data) return undefined;
  const compatible = data.compatible.flatMap(({ effect, tiers }) => {
    const entry = published("effect", effect);
    const format = weaponData.effectFormats[effect];
    const values = tiers.map((tier) => formatMagnitude(tier, format)) as [string, string, string];
    return entry ? [{ effect: entry, values }] : [];
  });
  const fixed = fixedBonus(weapon);
  return { compatible, ...(fixed ? { fixed } : {}) };
}

/** Published weapons that carry this effect or enchantment as their fixed, non-rerollable bonus. */
export function fixedOn(entry: Entry): Entry[] {
  return publishedEntries.filter((weapon) => {
    const fixed = weaponEffectsOf(weapon)?.fixed;
    return fixed?.linked === true && fixed.entry.category === entry.category && fixed.entry.slug === entry.slug;
  });
}
