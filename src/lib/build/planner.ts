/** The build page in the browser: slots, the picker dialog, the URL and the share buttons. */
import { foldForSearch } from "../lang";
import { buildSearch, decodeBuild, type Pools } from "./code";
import { drawCard, type CardTheme } from "./draw";
import { parseBuildPayload, type BuildOption, type BuildPayload } from "./parse";
import { BUILD_SLOTS, byPool, type Build, type BuildSlot, type SlotKey } from "./slots";

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
  readonly disabled: boolean;
  readonly pick: () => void;
}

/** The live planner: its payload, elements and the current build. */
interface Planner {
  readonly root: HTMLElement;
  readonly payload: BuildPayload;
  readonly parts: Parts;
  readonly slots: ReadonlyMap<SlotKey, HTMLElement>;
  build: Build;
  choices: readonly Choice[];
}

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

function renderSlot(element: HTMLElement, option: BuildOption | undefined, choose: string): void {
  element.querySelector("[data-icon]")?.replaceChildren(...iconImage(option?.icon));
  const name = element.querySelector<HTMLElement>("[data-name]");
  if (name) name.textContent = option?.name ?? choose;
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
  art.className = "build-icon";
  art.append(...iconImage(choice.icon));
  const name = document.createElement("span");
  name.className = "build-option-name";
  name.textContent = choice.name;
  button.append(art, name);
  if (choice.disabled) {
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

function render(planner: Planner): void {
  for (const slot of BUILD_SLOTS) renderSlot(planner.slots.get(slot.key)!, optionFor(planner.payload, slot, planner.build[slot.key]), planner.payload.labels.choose);
}

/** Writes the build into the address (other parameters kept) and tells the language links. */
function syncUrl(planner: Planner): void {
  history.replaceState(history.state, "", `${location.pathname}${buildSearch(location.search, planner.build)}${location.hash}`);
  window.dispatchEvent(new Event(LOCATION_EVENT));
}

function update(planner: Planner, next: Build): void {
  planner.build = next;
  render(planner);
  syncUrl(planner);
  showNotice(planner, "");
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
  planner.root.querySelector("[data-reset]")?.addEventListener("click", () => update(planner, {}));
  planner.root.querySelector("[data-copy]")?.addEventListener("click", () => void copyLink(planner));
  planner.root.querySelector("[data-download]")?.addEventListener("click", () => void download(planner));
}

/** Wires up the planner; false when the payload or markup is not what the page should have rendered. */
export function mountPlanner(root: HTMLElement): boolean {
  const payload = readPayload(root);
  const parts = partsOf(root);
  const slots = slotsOf(root);
  if (!payload || !parts || !slots) return false;
  const decoded = decodeBuild(location.search, poolsOf(payload));
  const planner: Planner = { root, payload, parts, slots, build: decoded.build, choices: [] };
  wireSlots(planner);
  wireDialog(planner);
  wireShare(planner);
  render(planner);
  // Drop what could not be read from the address, so the language links do not carry it on.
  if (decoded.unsupported || decoded.dropped > 0) syncUrl(planner);
  root.hidden = false;
  if (decoded.unsupported) showNotice(planner, payload.labels.unsupported);
  else if (decoded.dropped > 0) showNotice(planner, payload.labels.dropped.replace("{n}", () => String(decoded.dropped)));
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
  const { parts, payload, build } = planner;
  parts.url.hidden = true;
  parts.status.textContent = "";
  try {
    const picked = Object.fromEntries(
      BUILD_SLOTS.flatMap((slot) => {
        const option = optionFor(payload, slot, build[slot.key]);
        return option ? [[slot.key, option]] : [];
      }),
    );
    const address = `${location.origin}${location.pathname}`;
    const blob = await drawCard({ title: payload.labels.cardTitle, labels: payload.labels, picked, address, theme: themeOf() });
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
