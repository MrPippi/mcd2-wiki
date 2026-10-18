/** The build page in the browser: slots, the picker dialog, the URL and the share buttons. */
import { foldForSearch } from "../lang";
import { ROMAN } from "./card";
import { buildSearch, decodeBuild, type DecodedBuild, type EnchantPools, type Pools } from "./code";
import { drawCard, type CardTheme } from "./draw";
import { effectRulesOf, effectsLine, isEffectSlot, keptEffects, renderEffects, rollable } from "./effects-ui";
import { parseBuildPayload, type BuildOption, type BuildPayload, type EnchantOption } from "./parse";
import {
  BUILD_SLOTS,
  byPool,
  EFFECT_SLOT_KEYS,
  ENCHANT_SLOT_KEYS,
  ENCHANT_TIERS,
  type Build,
  type Effects,
  type EffectSlotKey,
  type BuildSlot,
  type Enchants,
  type EnchantSlotKey,
  type SlotKey,
} from "./slots";

const FILE_NAME = "mcd2-build.png";
/** Keeps the image URL alive long enough for the download to start. */
const REVOKE_MS = 10_000;
/** Fired after replaceState so the language links pick up the new query (SiteHeader listens). */
const LOCATION_EVENT = "mcd2:locationchange";
const ICON_SIZE = 48;

interface Parts {
  readonly notice: HTMLElement;
  readonly status: HTMLElement;
  readonly url: HTMLInputElement;
  readonly dialog: HTMLDialogElement;
  readonly dialogTitle: HTMLElement;
  readonly filter: HTMLInputElement;
  readonly options: HTMLElement;
  readonly empty: HTMLElement;
}

/** A row in the picker: an item for a slot, or a whole armor set. */
interface Choice {
  readonly key: string;
  readonly name: string;
  readonly search: string;
  readonly icon?: string;
  readonly unique?: true;
  /** Enchantments: the icon sits in the game's book frame (this URL) instead of the square slot box. */
  readonly book?: string;
  readonly disabled: boolean;
  /** Already in the slot being picked for: marked, still selectable. */
  readonly current?: boolean;
  readonly pick: () => void;
}

/** The live planner: its payload, elements and the current build. */
interface Planner {
  readonly root: HTMLElement;
  readonly payload: BuildPayload;
  readonly parts: Parts;
  readonly slots: ReadonlyMap<SlotKey, HTMLElement>;
  build: Build;
  enchants: Enchants;
  effects: Effects;
  choices: readonly Choice[];
}

const isEnchantSlot = (key: SlotKey): key is EnchantSlotKey => (ENCHANT_SLOT_KEYS as readonly SlotKey[]).includes(key);

function readPayload(root: HTMLElement): BuildPayload | undefined {
  try {
    return parseBuildPayload(JSON.parse(root.querySelector("[data-build-json]")?.textContent ?? ""));
  } catch {
    return undefined; // not JSON: the caller reports it like any other bad payload
  }
}

function partsOf(root: HTMLElement): Parts | undefined {
  const get = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector) ?? undefined;
  const parts = {
    notice: get("[data-notice]"),
    status: get("[data-status]"),
    url: get<HTMLInputElement>("[data-url]"),
    dialog: get<HTMLDialogElement>("[data-dialog]"),
    dialogTitle: get("[data-dialog-title]"),
    filter: get<HTMLInputElement>("[data-filter]"),
    options: get("[data-options]"),
    empty: get("[data-empty]"),
  };
  return Object.values(parts).every(Boolean) ? (parts as Parts) : undefined;
}

function slotsOf(root: HTMLElement): ReadonlyMap<SlotKey, HTMLElement> | undefined {
  const found = BUILD_SLOTS.map((slot) => [slot.key, root.querySelector<HTMLElement>(`[data-slot="${slot.key}"]`)] as const);
  return found.every(([, element]) => element) ? new Map(found as (readonly [SlotKey, HTMLElement])[]) : undefined;
}

const poolsOf = (payload: BuildPayload): Pools => byPool((pool) => new Set(payload.pools[pool].map((option) => option.slug)));

const enchantPoolsOf = (payload: BuildPayload): EnchantPools =>
  Object.fromEntries(
    ENCHANT_SLOT_KEYS.map((key): [EnchantSlotKey, ReadonlySet<string>] => [key, new Set(enchantsFor(payload, key).map((option) => option.slug))]),
  ) as Record<EnchantSlotKey, ReadonlySet<string>>;

const enchantsFor = (payload: BuildPayload, key: EnchantSlotKey): EnchantOption[] => payload.enchantments.filter((option) => option.slots.includes(key));

const enchantOption = (payload: BuildPayload, slug: string | undefined): EnchantOption | undefined =>
  slug === undefined ? undefined : payload.enchantments.find((option) => option.slug === slug);

const optionFor = (payload: BuildPayload, slot: BuildSlot, slug: string | undefined): BuildOption | undefined =>
  slug === undefined ? undefined : payload.pools[slot.pool].find((option) => option.slug === slug);

function iconImage(src: string | undefined): HTMLImageElement[] {
  if (!src) return [];
  const image = document.createElement("img");
  image.src = src;
  image.alt = "";
  image.width = ICON_SIZE;
  image.height = ICON_SIZE;
  image.loading = "lazy";
  return [image];
}

/** An enchantment icon behind the book frame's diamond window; the frame is an <img> so extensions that strip backgrounds keep it. */
function bookArt(src: string | undefined, frame: string | undefined): HTMLImageElement[] {
  const icon = iconImage(src);
  if (icon.length === 0 || !frame) return icon;
  const art = document.createElement("img");
  art.className = "build-book-frame";
  art.src = frame;
  art.alt = "";
  art.width = ICON_SIZE;
  art.height = ICON_SIZE;
  art.loading = "lazy";
  return [...icon, art];
}

function renderSlot(element: HTMLElement, option: BuildOption | undefined, payload: BuildPayload): void {
  element.querySelector("[data-icon]")?.replaceChildren(...iconImage(option?.icon));
  const name = element.querySelector<HTMLElement>("[data-name]");
  if (name) name.textContent = option?.name ?? payload.labels.choose;
  const fixed = element.querySelector<HTMLElement>("[data-fixed]");
  if (fixed) {
    fixed.hidden = !option?.fixed;
    fixed.textContent = option?.fixed ? payload.labels.builtIn.replace("{name}", () => option.fixed?.name ?? "") : "";
  }
  element.dataset.filled = String(option !== undefined);
  element.dataset.unique = String(option?.unique === true);
  const link = element.querySelector<HTMLAnchorElement>("[data-link]");
  const linkName = element.querySelector<HTMLElement>("[data-link-name]");
  if (link && linkName) {
    link.hidden = option === undefined;
    if (option) link.href = option.href;
    linkName.textContent = option?.name ?? "";
  }
  const clear = element.querySelector<HTMLElement>("[data-clear]");
  if (clear) clear.hidden = option === undefined;
}

function choiceRow(choice: Choice, equipped: string): HTMLLIElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "build-option";
  button.disabled = choice.disabled;
  if (choice.unique) button.dataset.unique = "true";
  const art = document.createElement("span");
  art.className = choice.book ? "build-icon build-icon-book" : "build-icon";
  art.append(...(choice.book ? bookArt(choice.icon, choice.book) : iconImage(choice.icon)));
  const name = document.createElement("span");
  name.className = "build-option-name";
  name.textContent = choice.name;
  button.append(art, name);
  if (choice.current) button.setAttribute("aria-current", "true");
  if (choice.disabled || choice.current) {
    const tag = document.createElement("span");
    tag.className = "build-option-tag";
    tag.textContent = equipped;
    button.append(tag);
  }
  button.addEventListener("click", choice.pick);
  const row = document.createElement("li");
  row.append(button);
  return row;
}

/** Sets a live region's text, clearing it first so the same message is announced again. */
function announce(element: HTMLElement, text: string): void {
  element.textContent = "";
  if (text) requestAnimationFrame(() => (element.textContent = text));
}

const showNotice = (planner: Planner, text: string): void => {
  planner.parts.notice.textContent = text;
  planner.parts.notice.hidden = text === "";
};

/** The enchantment row under a gear slot: shown once the slot holds an item. */
function renderEnchant(element: HTMLElement, filled: boolean, pick: Enchants[EnchantSlotKey], payload: BuildPayload, frame: string | undefined): void {
  const row = element.querySelector<HTMLElement>("[data-enchant]");
  if (!row) return;
  row.hidden = !filled;
  const option = enchantOption(payload, pick?.slug);
  row.querySelector("[data-enchant-icon]")?.replaceChildren(...bookArt(option?.icon, frame));
  const name = row.querySelector<HTMLElement>("[data-enchant-name]");
  if (name) name.textContent = option?.name ?? payload.labels.addEnchant;
  row.dataset.filled = String(option !== undefined);
  const tier = row.querySelector<HTMLSelectElement>("[data-tier]");
  if (tier) {
    tier.hidden = option === undefined;
    tier.value = String(pick?.tier ?? ENCHANT_TIERS[0]);
  }
  const clear = row.querySelector<HTMLElement>("[data-enchant-clear]");
  if (clear) clear.hidden = option === undefined;
}

function render(planner: Planner): void {
  for (const slot of BUILD_SLOTS) {
    const element = planner.slots.get(slot.key)!;
    renderSlot(element, optionFor(planner.payload, slot, planner.build[slot.key]), planner.payload);
    if (isEffectSlot(slot.key)) renderEffects(element, planner.payload, slot.key, planner.build[slot.key], planner.effects[slot.key] ?? []);
    if (isEnchantSlot(slot.key)) renderEnchant(element, planner.build[slot.key] !== undefined, planner.enchants[slot.key], planner.payload, planner.root.dataset.bookFrame);
  }
}

/** Writes the build into the address (other parameters kept) and tells the language links. */
function syncUrl(planner: Planner): void {
  const search = buildSearch(location.search, planner.build, { gameVersion: planner.payload.gameVersion, enchants: planner.enchants, effects: planner.effects });
  history.replaceState(history.state, "", `${location.pathname}${search}${location.hash}`);
  window.dispatchEvent(new Event(LOCATION_EVENT));
}

/** Enchantments whose slot still holds an item: emptying a slot takes its enchantment off with it. */
const keptEnchants = (build: Build, enchants: Enchants): Enchants =>
  Object.fromEntries(Object.entries(enchants).filter(([key]) => build[key as EnchantSlotKey] !== undefined)) as Enchants;

function update(planner: Planner, next: Build, enchants: Enchants = planner.enchants, effects: Effects = planner.effects): void {
  planner.build = next;
  planner.enchants = keptEnchants(next, enchants);
  planner.effects = keptEffects(planner.payload, next, effects);
  render(planner);
  syncUrl(planner);
  // Effects the new item cannot roll, or past its cap, fall away: say how many instead of dropping them silently.
  const count = (all: Effects) => Object.values(all).reduce((sum, picks) => sum + (picks?.length ?? 0), 0);
  const lost = count(effects) - count(planner.effects);
  showNotice(planner, lost > 0 ? planner.payload.labels.dropped.replace("{n}", () => String(lost)) : "");
  planner.parts.url.hidden = true;
  planner.parts.status.textContent = "";
}

const without = (build: Build, key: SlotKey): Build => Object.fromEntries(Object.entries(build).filter(([slot]) => slot !== key)) as Build;

function showChoices(planner: Planner): void {
  const { parts, payload } = planner;
  const query = foldForSearch(parts.filter.value.trim(), document.documentElement.lang);
  const shown = planner.choices.filter((choice) => query === "" || choice.search.includes(query));
  parts.options.replaceChildren(...shown.map((choice) => choiceRow(choice, payload.labels.equipped)));
  parts.empty.hidden = shown.length > 0;
}

function openDialog(planner: Planner, title: string, choices: readonly Choice[]): void {
  planner.choices = choices;
  planner.parts.dialogTitle.textContent = title;
  planner.parts.filter.value = "";
  showChoices(planner);
  planner.parts.dialog.showModal();
  planner.parts.filter.focus();
}

/** Picks from the dialog, then hands focus back to the slot the change landed in. */
function choose(planner: Planner, next: Build, focusSlot: SlotKey): void {
  planner.parts.dialog.close();
  update(planner, next);
  planner.slots.get(focusSlot)?.querySelector<HTMLElement>("[data-pick]")?.focus();
}

function slotChoices(planner: Planner, slot: BuildSlot): Choice[] {
  const { build, payload } = planner;
  const taken = new Set(BUILD_SLOTS.filter((other) => other.pool === slot.pool && other.key !== slot.key).flatMap((other) => build[other.key] ?? []));
  return payload.pools[slot.pool].map((option) => ({
    key: option.slug,
    name: option.name,
    search: option.search,
    icon: option.icon,
    unique: option.unique,
    disabled: taken.has(option.slug),
    current: build[slot.key] === option.slug,
    pick: () => choose(planner, { ...planner.build, [slot.key]: option.slug }, slot.key),
  }));
}

function setChoices(planner: Planner): Choice[] {
  const { payload } = planner;
  return payload.sets.map((set) => ({
    key: set.slug,
    name: set.name,
    search: set.search,
    icon: payload.pools.helmet.find((option) => option.slug === set.pieces.helmet)?.icon,
    disabled: false,
    pick: () => choose(planner, { ...planner.build, ...set.pieces }, "helmet"),
  }));
}

function enchantChoices(planner: Planner, key: EnchantSlotKey): Choice[] {
  return enchantsFor(planner.payload, key).map((option) => ({
    key: option.slug,
    name: option.name,
    search: option.search,
    icon: option.icon,
    book: planner.root.dataset.bookFrame,
    disabled: false,
    current: planner.enchants[key]?.slug === option.slug,
    pick: () => {
      planner.parts.dialog.close();
      const tier = planner.enchants[key]?.tier ?? ENCHANT_TIERS[0];
      update(planner, planner.build, { ...planner.enchants, [key]: { slug: option.slug, tier } });
      planner.slots.get(key)?.querySelector<HTMLElement>("[data-enchant-pick]")?.focus();
    },
  }));
}

function wireEnchant(planner: Planner, key: EnchantSlotKey, element: HTMLElement): void {
  const pick = element.querySelector<HTMLElement>("[data-enchant-pick]");
  const label = element.querySelector(".build-slot-label")?.textContent ?? key;
  pick?.addEventListener("click", () => openDialog(planner, `${planner.payload.labels.enchant}: ${label}`, enchantChoices(planner, key)));
  const tier = element.querySelector<HTMLSelectElement>("[data-tier]");
  tier?.addEventListener("change", () => {
    const current = planner.enchants[key];
    const next = ENCHANT_TIERS.find((value) => String(value) === tier.value);
    if (current && next) update(planner, planner.build, { ...planner.enchants, [key]: { ...current, tier: next } });
  });
  element.querySelector("[data-enchant-clear]")?.addEventListener("click", () => {
    const { [key]: _removed, ...rest } = planner.enchants;
    update(planner, planner.build, rest);
    pick?.focus(); // the remove button just hid itself
  });
}

/** Picks for adding an effect, or with `replacing`, for swapping that picked effect in place (its level is kept). */
function effectChoices(planner: Planner, key: EffectSlotKey, replacing?: string): Choice[] {
  const current = planner.effects[key] ?? [];
  const picked = new Set(current.map((pick) => pick.slug));
  const nextPicks = (slug: string) =>
    replacing === undefined
      ? [...current, { slug, tier: ENCHANT_TIERS[0] }]
      : current.map((pick) => (pick.slug === replacing ? { ...pick, slug } : pick));
  return rollable(planner.payload, key, planner.build[key]).map((option) => ({
    key: option.slug,
    name: option.name,
    search: option.search,
    icon: option.icon,
    disabled: picked.has(option.slug) && option.slug !== replacing,
    current: option.slug === replacing || undefined,
    pick: () => {
      planner.parts.dialog.close();
      update(planner, planner.build, planner.enchants, { ...planner.effects, [key]: nextPicks(option.slug) });
      const slot = planner.slots.get(key);
      const added = slot?.querySelector<HTMLElement>(`[data-effect-tier="${option.slug}"]`);
      (added ?? slot?.querySelector<HTMLElement>("[data-add-effect]"))?.focus();
    },
  }));
}

/** Level changes and removals on a slot's effect list (rows are rebuilt on every render, so events are delegated). */
function wireEffects(planner: Planner, key: EffectSlotKey, element: HTMLElement): void {
  const add = element.querySelector<HTMLElement>("[data-add-effect]");
  const label = element.querySelector(".build-slot-label")?.textContent ?? key;
  add?.addEventListener("click", () => openDialog(planner, `${planner.payload.labels.effect}: ${label}`, effectChoices(planner, key)));
  const list = element.querySelector<HTMLElement>("[data-effect-list]");
  list?.addEventListener("change", (event) => {
    const select = event.target instanceof HTMLSelectElement ? event.target : undefined;
    const tier = ENCHANT_TIERS.find((value) => String(value) === select?.value);
    if (!select?.dataset.effectTier || !tier) return;
    const picks = (planner.effects[key] ?? []).map((pick) => (pick.slug === select.dataset.effectTier ? { ...pick, tier } : pick));
    update(planner, planner.build, planner.enchants, { ...planner.effects, [key]: picks });
    element.querySelector<HTMLElement>(`[data-effect-tier="${select.dataset.effectTier}"]`)?.focus();
  });
  list?.addEventListener("click", (event) => {
    const change = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-effect-change]") : null;
    if (change?.dataset.effectChange) {
      openDialog(planner, `${planner.payload.labels.effect}: ${label}`, effectChoices(planner, key, change.dataset.effectChange));
      return;
    }
    const button = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-effect-remove]") : null;
    if (!button?.dataset.effectRemove) return;
    const picks = (planner.effects[key] ?? []).filter((pick) => pick.slug !== button.dataset.effectRemove);
    update(planner, planner.build, planner.enchants, { ...planner.effects, [key]: picks });
    add?.focus(); // the row and its button are gone
  });
}

function wireSlots(planner: Planner): void {
  for (const slot of BUILD_SLOTS) {
    const element = planner.slots.get(slot.key)!;
    const pick = element.querySelector<HTMLElement>("[data-pick]");
    const label = element.querySelector(".build-slot-label")?.textContent ?? slot.key;
    pick?.addEventListener("click", () => openDialog(planner, label, slotChoices(planner, slot)));
    element.querySelector("[data-clear]")?.addEventListener("click", () => {
      update(planner, without(planner.build, slot.key));
      pick?.focus(); // the clear button just hid itself
    });
    if (isEffectSlot(slot.key)) wireEffects(planner, slot.key, element);
    if (isEnchantSlot(slot.key)) wireEnchant(planner, slot.key, element);
  }
  planner.root.querySelector("[data-open-sets]")?.addEventListener("click", () => openDialog(planner, planner.payload.labels.wholeSet, setChoices(planner)));
}

function wireDialog(planner: Planner): void {
  const { dialog, filter } = planner.parts;
  planner.root.querySelector("[data-close]")?.addEventListener("click", () => dialog.close());
  // The body fills the dialog, so only the backdrop has the dialog as target; a drag that starts inside never closes it.
  let pressedBackdrop = false;
  dialog.addEventListener("pointerdown", (event) => (pressedBackdrop = event.target === dialog));
  dialog.addEventListener("click", (event) => {
    if (pressedBackdrop && event.target === dialog) dialog.close();
  });
  filter.addEventListener("input", () => showChoices(planner));
}

function wireShare(planner: Planner): void {
  planner.root.querySelector("[data-reset]")?.addEventListener("click", () => update(planner, {}, {}, {}));
  planner.root.querySelector("[data-copy]")?.addEventListener("click", () => void copyLink(planner));
  planner.root.querySelector("[data-download]")?.addEventListener("click", () => void download(planner));
}

/** What the reader should know about the build the address opened. */
function loadNotices(payload: BuildPayload, decoded: DecodedBuild): string[] {
  const { labels } = payload;
  if (decoded.unsupported) return [labels.unsupported];
  const old = decoded.gameVersion !== undefined && decoded.gameVersion !== payload.gameVersion;
  return [
    ...(old ? [labels.oldVersion.replace("{old}", () => decoded.gameVersion ?? "").replace("{current}", () => payload.gameVersion)] : []),
    ...(decoded.dropped > 0 ? [labels.dropped.replace("{n}", () => String(decoded.dropped))] : []),
  ];
}

/** Wires up the planner; false when the payload or markup is not what the page should have rendered. */
export function mountPlanner(root: HTMLElement): boolean {
  const payload = readPayload(root);
  const parts = partsOf(root);
  const slots = slotsOf(root);
  if (!payload || !parts || !slots) return false;
  const decoded = decodeBuild(location.search, poolsOf(payload), enchantPoolsOf(payload), effectRulesOf(payload));
  const planner: Planner = { root, payload, parts, slots, build: decoded.build, enchants: decoded.enchants, effects: decoded.effects, choices: [] };
  wireSlots(planner);
  wireDialog(planner);
  wireShare(planner);
  render(planner);
  // Drop what could not be read from the address, so the language links do not carry it on.
  if (decoded.unsupported || decoded.dropped > 0) syncUrl(planner);
  root.hidden = false;
  showNotice(planner, loadNotices(payload, decoded).join(" "));
  return true;
}

async function copyLink(planner: Planner): Promise<void> {
  const { parts, payload } = planner;
  try {
    await navigator.clipboard.writeText(location.href);
    parts.url.hidden = true;
    announce(parts.status, payload.labels.copied);
  } catch (error) {
    console.error("build planner: copy failed", error);
    announce(parts.status, payload.labels.copyFailed);
    parts.url.value = location.href;
    parts.url.hidden = false;
    parts.url.select();
  }
}

/** The site's colours and fonts, so the image matches the theme in use; a missing token is an error. */
function themeOf(): CardTheme {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string): string => {
    const value = style.getPropertyValue(name).trim();
    if (!value) throw new Error(`missing design token ${name}`);
    return value;
  };
  return {
    paper: read("--paper"),
    plate: read("--plate"),
    ink: read("--ink"),
    muted: read("--muted"),
    accent: read("--accent"),
    rule: read("--rule"),
    display: read("--font-display"),
    body: read("--font-body"),
  };
}

async function download(planner: Planner): Promise<void> {
  const { parts, payload, build, enchants } = planner;
  parts.url.hidden = true;
  parts.status.textContent = "";
  try {
    const picked = Object.fromEntries(
      BUILD_SLOTS.flatMap((slot) => {
        const option = optionFor(payload, slot, build[slot.key]);
        return option ? [[slot.key, option]] : [];
      }),
    );
    const rolled = Object.fromEntries(
      EFFECT_SLOT_KEYS.flatMap((key) => {
        const line = effectsLine(payload, planner.effects[key] ?? []);
        return line ? [[key, line]] : [];
      }),
    );
    const enchanted = Object.fromEntries(
      ENCHANT_SLOT_KEYS.flatMap((key) => {
        const pick = enchants[key];
        const option = enchantOption(payload, pick?.slug);
        return option && pick ? [[key, `${option.name} ${ROMAN[pick.tier]}`]] : [];
      }),
    );
    const address = `${location.origin}${location.pathname}`;
    const version = payload.labels.gameVersion.replace("{version}", () => payload.gameVersion);
    const blob = await drawCard({ title: payload.labels.cardTitle, labels: payload.labels, picked, enchanted, rolled, address, version, theme: themeOf() });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = FILE_NAME;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), REVOKE_MS);
  } catch (error) {
    console.error("build planner: image failed", error);
    announce(parts.status, payload.labels.downloadFailed);
  }
}
