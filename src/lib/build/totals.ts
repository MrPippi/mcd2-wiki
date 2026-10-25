/** The build's effects and enchantments gathered across its slots, with a sum for effects that appear more than once. Loaded by the browser. */
import { formatMagnitude } from "../effect-format";
import type { BuildOption, BuildPayload, EffectFormatOption } from "./parse";
import { BUILD_SLOTS, EFFECT_SLOT_KEYS, ENCHANT_SLOT_KEYS, type Build, type EffectPick, type Effects, type Enchants, type EnchantTier, type SlotKey } from "./slots";

/** One slot's share of an effect or enchantment. */
export interface TotalPart {
  readonly slot: SlotKey;
  /** The picked tier; a built-in effect has none. */
  readonly tier?: EnchantTier;
  /** The printed value; undefined when the data has none. */
  readonly value?: string;
  readonly builtIn?: true;
}

export interface TotalRow {
  readonly slug: string;
  readonly name: string;
  readonly icon?: string;
  readonly href: string;
  readonly parts: readonly TotalPart[];
  /** Effects on two or more slots whose values are all known: the values added up. */
  readonly sum?: string;
}

export interface BuildTotals {
  readonly effects: readonly TotalRow[];
  readonly enchants: readonly TotalRow[];
}

interface RawPart extends TotalPart {
  /** The raw magnitude, for the sum. */
  readonly raw?: number;
}

/** The printed values added up: each raw magnitude scaled and offset as the game prints it (formatMagnitude), then summed. */
export function sumMagnitudes(raws: readonly number[], format: EffectFormatOption | undefined): string {
  if (!format) return String(raws.reduce((sum, raw) => sum + raw, 0));
  const shown = raws.reduce((sum, raw) => sum + (raw * format.multiplier + format.offset) * (format.percent ? 100 : 1), 0);
  const factor = 10 ** format.maxFractionDigits;
  const rounded = Math.round(shown * factor) / factor;
  return format.percent ? `${rounded}%` : String(rounded);
}

const itemIn = (payload: BuildPayload, build: Build, key: SlotKey): BuildOption | undefined => {
  const slot = BUILD_SLOTS.find((candidate) => candidate.key === key);
  const slug = build[key];
  return slot && slug !== undefined ? payload.pools[slot.pool].find((option) => option.slug === slug) : undefined;
};

/** The built-in effect and the picked effects on one slot's item, as effect-list positions with their parts. */
function slotEffects(payload: BuildPayload, item: BuildOption, key: SlotKey, picks: readonly EffectPick[]): { index: number; part: RawPart }[] {
  const fixed = item.fixed;
  const builtIn =
    fixed?.effect === true && fixed.index !== undefined
      ? [{ index: fixed.index, part: { slot: key, builtIn: true as const, ...(fixed.value !== undefined ? { raw: fixed.value, value: formatMagnitude(fixed.value, payload.effects[fixed.index]?.format) } : {}) } }]
      : [];
  const picked = picks.flatMap((pick) => {
    const at = (item.effects ?? []).findIndex((index) => payload.effects[index]?.slug === pick.slug);
    if (at < 0) return [];
    const index = item.effects![at]!;
    const tierSet = item.effectTiers?.[at];
    const raw = tierSet === undefined ? undefined : payload.tierSets[tierSet]?.[pick.tier - 1];
    return [{ index, part: { slot: key, tier: pick.tier, ...(raw !== undefined ? { raw, value: formatMagnitude(raw, payload.effects[index]?.format) } : {}) } }];
  });
  return [...builtIn, ...picked];
}

const stripRaw = ({ raw: _raw, ...part }: RawPart): TotalPart => part;

function effectRows(payload: BuildPayload, build: Build, effects: Effects): TotalRow[] {
  const found = EFFECT_SLOT_KEYS.flatMap((key) => {
    const item = itemIn(payload, build, key);
    return item ? slotEffects(payload, item, key, effects[key] ?? []) : [];
  });
  const order = [...new Set(found.map((one) => one.index))];
  return order.flatMap((index) => {
    const option = payload.effects[index];
    if (!option) return [];
    const parts = found.filter((one) => one.index === index).map((one) => one.part);
    const raws = parts.flatMap((part) => (part.raw === undefined ? [] : [part.raw]));
    const sum = parts.length > 1 && raws.length === parts.length ? sumMagnitudes(raws, option.format) : undefined;
    return [{ slug: option.slug, name: option.name, ...(option.icon ? { icon: option.icon } : {}), href: option.href, parts: parts.map(stripRaw), ...(sum !== undefined ? { sum } : {}) }];
  });
}

function enchantRows(payload: BuildPayload, build: Build, enchants: Enchants): TotalRow[] {
  const found = ENCHANT_SLOT_KEYS.flatMap((key) => {
    const pick = build[key] === undefined ? undefined : enchants[key];
    const option = pick ? payload.enchantments.find((candidate) => candidate.slug === pick.slug) : undefined;
    if (!pick || !option) return [];
    const values = option.tiers[pick.tier - 1];
    return [{ option, part: { slot: key, tier: pick.tier, ...(values && values.length > 0 ? { value: values.join(" / ") } : {}) } }];
  });
  const order = [...new Set(found.map((one) => one.option))];
  return order.map((option) => ({
    slug: option.slug,
    name: option.name,
    ...(option.icon ? { icon: option.icon } : {}),
    href: option.href,
    parts: found.filter((one) => one.option === option).map((one) => one.part),
  }));
}

export const buildTotals = (payload: BuildPayload, build: Build, effects: Effects, enchants: Enchants): BuildTotals => ({
  effects: effectRows(payload, build, effects),
  enchants: enchantRows(payload, build, enchants),
});
