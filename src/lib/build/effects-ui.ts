/** Effects in the build page's browser script: which an item can roll, keeping a build valid, and the effect rows. */
import { ROMAN } from "./card";
import { effectCap, type EffectRules } from "./code";
import type { BuildOption, BuildPayload, EffectOption } from "./parse";
import { BUILD_SLOTS, EFFECT_SLOT_KEYS, ENCHANT_TIERS, type Build, type EffectPick, type Effects, type EffectSlotKey, type SlotKey } from "./slots";

const ICON_SIZE = 28;

export const isEffectSlot = (key: SlotKey): key is EffectSlotKey => (EFFECT_SLOT_KEYS as readonly SlotKey[]).includes(key);

const itemOption = (payload: BuildPayload, key: EffectSlotKey, slug: string): BuildOption | undefined => {
  const slot = BUILD_SLOTS.find((candidate) => candidate.key === key);
  return slot ? payload.pools[slot.pool].find((option) => option.slug === slug) : undefined;
};

/** The effects the item in `key` can roll, in the payload's order. */
export function rollable(payload: BuildPayload, key: EffectSlotKey, item: string | undefined): EffectOption[] {
  const option = item === undefined ? undefined : itemOption(payload, key, item);
  return (option?.effects ?? []).flatMap((index) => payload.effects[index] ?? []);
}

/** Places left for picked effects on the item in `key`. */
export const capFor = (payload: BuildPayload, key: EffectSlotKey, item: string | undefined): number =>
  effectCap(item !== undefined && itemOption(payload, key, item)?.fixed?.effect === true);

export function effectRulesOf(payload: BuildPayload): EffectRules {
  return {
    allowed: (key, item) => new Set(rollable(payload, key, item).map((effect) => effect.slug)),
    builtIn: (key, item) => itemOption(payload, key, item)?.fixed?.effect === true,
  };
}

/** Effects still valid for each slot's item: rollable by it, and within its cap. */
export function keptEffects(payload: BuildPayload, build: Build, effects: Effects): Effects {
  return Object.fromEntries(
    EFFECT_SLOT_KEYS.flatMap((key) => {
      const item = build[key];
      const allowed = new Set(rollable(payload, key, item).map((effect) => effect.slug));
      const picks = (effects[key] ?? []).filter((pick) => allowed.has(pick.slug)).slice(0, capFor(payload, key, item));
      return picks.length > 0 ? [[key, picks]] : [];
    }),
  ) as Effects;
}

/** One picked effect: name (linked), level select, remove button. Events are handled by the list's owner. */
function effectRow(pick: EffectPick, option: EffectOption, labels: BuildPayload["labels"]): HTMLLIElement {
  const row = document.createElement("li");
  row.className = "build-effect";
  row.dataset.effect = pick.slug;
  const icon = document.createElement("span");
  icon.className = "build-icon build-icon-small";
  icon.setAttribute("aria-hidden", "true");
  if (option.icon) {
    const image = document.createElement("img");
    image.src = option.icon;
    image.alt = "";
    image.width = ICON_SIZE;
    image.height = ICON_SIZE;
    icon.append(image);
  }
  const name = document.createElement("a");
  name.className = "build-effect-name";
  name.href = option.href;
  name.textContent = option.name;
  const tier = document.createElement("select");
  tier.className = "build-tier";
  tier.dataset.effectTier = pick.slug;
  tier.setAttribute("aria-label", `${labels.tier}: ${option.name}`);
  for (const value of ENCHANT_TIERS) tier.append(new Option(ROMAN[value], String(value), false, value === pick.tier));
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "build-clear";
  remove.dataset.effectRemove = pick.slug;
  remove.setAttribute("aria-label", `${labels.removeEffect}: ${option.name}`);
  remove.textContent = "×";
  row.append(icon, name, tier, remove);
  return row;
}

/** The effect area under a slot: shown once the slot holds an item that rolls effects. */
export function renderEffects(element: HTMLElement, payload: BuildPayload, key: EffectSlotKey, item: string | undefined, picks: readonly EffectPick[]): void {
  const area = element.querySelector<HTMLElement>("[data-effects]");
  const list = area?.querySelector<HTMLElement>("[data-effect-list]");
  const add = area?.querySelector<HTMLElement>("[data-add-effect]");
  if (!area || !list || !add) return;
  const options = rollable(payload, key, item);
  area.hidden = options.length === 0;
  const bySlug = new Map(options.map((option) => [option.slug, option]));
  list.replaceChildren(...picks.flatMap((pick) => {
    const option = bySlug.get(pick.slug);
    return option ? [effectRow(pick, option, payload.labels)] : [];
  }));
  list.hidden = picks.length === 0;
  add.hidden = picks.length >= capFor(payload, key, item);
}

/** "Sharpness III · Looting I" for the image. */
export const effectsLine = (payload: BuildPayload, picks: readonly EffectPick[]): string =>
  picks.flatMap((pick) => {
    const option = payload.effects.find((effect) => effect.slug === pick.slug);
    return option ? [`${option.name} ${ROMAN[pick.tier]}`] : [];
  }).join(" · ");
