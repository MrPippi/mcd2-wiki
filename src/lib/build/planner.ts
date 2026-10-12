/** The build page in the browser: slots, the picker dialog, the URL and the share buttons. */
import { foldForSearch } from "../lang";
import { decodeBuild, encodeBuild, type Pools } from "./code";
import { drawCard, type CardTheme } from "./draw";
import { parseBuildPayload, type BuildOption, type BuildPayload, type BuildSet } from "./parse";
import { BUILD_SLOTS, POOL_KEYS, type Build, type BuildSlot, type SlotKey } from "./slots";

const FILE_NAME = "mcd2-build.png";
/** Keeps the image URL alive long enough for the download to start. */
const REVOKE_MS = 10_000;
/** Fired after replaceState so the language links pick up the new query (SiteHeader listens). */
const LOCATION_EVENT = "mcd2:locationchange";

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

const poolsOf = (payload: BuildPayload): Pools =>
  Object.fromEntries(POOL_KEYS.map((pool) => [pool, new Set(payload.pools[pool].map((option) => option.slug))])) as unknown as Pools;

const optionFor = (payload: BuildPayload, slot: BuildSlot, slug: string | undefined): BuildOption | undefined =>
  slug === undefined ? undefined : payload.pools[slot.pool].find((option) => option.slug === slug);

function iconImage(option: BuildOption): HTMLImageElement | undefined {
  if (!option.icon) return undefined;
  const image = document.createElement("img");
  image.src = option.icon;
  image.alt = "";
  image.width = 48;
  image.height = 48;
  image.loading = "lazy";
  return image;
}

function renderSlot(element: HTMLElement, option: BuildOption | undefined, payload: BuildPayload): void {
  const icon = element.querySelector<HTMLElement>("[data-icon]");
  const name = element.querySelector<HTMLElement>("[data-name]");
  const link = element.querySelector<HTMLAnchorElement>("[data-link]");
  const linkName = element.querySelector<HTMLElement>("[data-link-name]");
  const clear = element.querySelector<HTMLElement>("[data-clear]");
  const image = option ? iconImage(option) : undefined;
  icon?.replaceChildren(...(image ? [image] : []));
  if (name) name.textContent = option?.name ?? payload.labels.choose;
  element.dataset.filled = String(option !== undefined);
  element.dataset.unique = String(option?.unique === true);
  if (link && linkName) {
    link.hidden = !option?.href;
    if (option?.href) link.href = option.href;
    linkName.textContent = option?.name ?? "";
  }
  if (clear) clear.hidden = option === undefined;
}

function choiceRow(choice: Choice, equipped: string): HTMLLIElement {
  const row = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "build-option";
  button.dataset.choice = choice.key;
  button.disabled = choice.disabled;
  if (choice.unique) button.dataset.unique = "true";
  const art = document.createElement("span");
  art.className = "build-icon";
  const image = choice.icon ? iconImage({ slug: choice.key, name: choice.name, search: "", icon: choice.icon }) : undefined;
  if (image) art.append(image);
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
  row.append(button);
  return row;
}

/** Wires up the planner; false when the payload or markup is not what the page should have rendered. */
export function mountPlanner(root: HTMLElement): boolean {
  const payload = readPayload(root);
  const parts = partsOf(root);
  if (!payload || !parts) return false;
  const pools = poolsOf(payload);
  const slotElements = new Map(BUILD_SLOTS.map((slot) => [slot.key, root.querySelector<HTMLElement>(`[data-slot="${slot.key}"]`)]));
  if ([...slotElements.values()].some((element) => !element)) return false;

  const decoded = decodeBuild(location.search, pools);
  let build: Build = decoded.build;
  let choices: Choice[] = [];

  const showNotice = (text: string): void => {
    parts.notice.textContent = text;
    parts.notice.hidden = text === "";
  };
  if (decoded.unsupported) showNotice(payload.labels.unsupported);
  else if (decoded.dropped > 0) showNotice(payload.labels.dropped.replace("{n}", () => String(decoded.dropped)));

  const render = (): void => {
    for (const slot of BUILD_SLOTS) renderSlot(slotElements.get(slot.key)!, optionFor(payload, slot, build[slot.key]), payload);
  };

  const syncUrl = (): void => {
    const query = encodeBuild(build);
    history.replaceState(history.state, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
    window.dispatchEvent(new Event(LOCATION_EVENT));
    parts.url.hidden = true;
    parts.status.textContent = "";
  };

  const update = (next: Build): void => {
    build = next;
    render();
    syncUrl();
  };

  const without = (key: SlotKey): Build => Object.fromEntries(Object.entries(build).filter(([slot]) => slot !== key)) as Build;

  const showChoices = (): void => {
    const query = foldForSearch(parts.filter.value.trim(), document.documentElement.lang);
    const shown = choices.filter((choice) => query === "" || choice.search.includes(query));
    parts.options.replaceChildren(...shown.map((choice) => choiceRow(choice, payload.labels.equipped)));
    parts.empty.hidden = shown.length > 0;
  };

  const openDialog = (title: string, next: Choice[]): void => {
    choices = next;
    parts.dialogTitle.textContent = title;
    parts.filter.value = "";
    showChoices();
    parts.dialog.showModal();
    parts.filter.focus();
  };

  const slotChoices = (slot: BuildSlot): Choice[] => {
    const taken = new Set(BUILD_SLOTS.filter((other) => other.pool === slot.pool && other.key !== slot.key).flatMap((other) => build[other.key] ?? []));
    return payload.pools[slot.pool].map((option) => ({
      key: option.slug,
      name: option.name,
      search: option.search,
      icon: option.icon,
      unique: option.unique,
      disabled: taken.has(option.slug),
      pick: () => {
        parts.dialog.close();
        update({ ...build, [slot.key]: option.slug });
      },
    }));
  };

  const setChoices = (): Choice[] =>
    payload.sets.map((set: BuildSet) => {
      const helmet = payload.pools.helmet.find((option) => option.slug === set.pieces.helmet);
      return {
        key: set.slug,
        name: set.name,
        search: set.search,
        icon: helmet?.icon,
        disabled: false,
        pick: () => {
          parts.dialog.close();
          update({ ...build, ...set.pieces });
        },
      };
    });

  for (const slot of BUILD_SLOTS) {
    const element = slotElements.get(slot.key)!;
    const label = element.querySelector(".build-slot-label")?.textContent ?? slot.key;
    element.querySelector("[data-pick]")?.addEventListener("click", () => openDialog(label, slotChoices(slot)));
    element.querySelector("[data-clear]")?.addEventListener("click", () => update(without(slot.key)));
  }
  root.querySelector("[data-open-sets]")?.addEventListener("click", () => openDialog(payload.labels.wholeSet, setChoices()));
  root.querySelector("[data-close]")?.addEventListener("click", () => parts.dialog.close());
  parts.dialog.addEventListener("click", (event) => {
    if (event.target === parts.dialog) parts.dialog.close(); // a click on the backdrop
  });
  parts.filter.addEventListener("input", showChoices);
  root.querySelector("[data-reset]")?.addEventListener("click", () => {
    showNotice("");
    update({});
  });
  root.querySelector("[data-copy]")?.addEventListener("click", () => void copyLink(parts, payload));
  root.querySelector("[data-download]")?.addEventListener("click", () => void download(parts, payload, build));

  render();
  root.hidden = false;
  return true;
}

async function copyLink(parts: Parts, payload: BuildPayload): Promise<void> {
  try {
    await navigator.clipboard.writeText(location.href);
    parts.status.textContent = payload.labels.copied;
    parts.url.hidden = true;
  } catch (error) {
    console.error("build planner: copy failed", error);
    parts.status.textContent = payload.labels.copyFailed;
    parts.url.value = location.href;
    parts.url.hidden = false;
    parts.url.select();
  }
}

function themeOf(): CardTheme {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    paper: read("--paper", "#f4f1ea"),
    plate: read("--plate", "#e8e3d8"),
    ink: read("--ink", "#1a1a1a"),
    muted: read("--muted", "#6b6b6b"),
    accent: read("--accent", "#b5452a"),
    rule: read("--rule", "#c9c2b3"),
    display: read("--font-display", "serif"),
    body: read("--font-body", "sans-serif"),
  };
}

async function download(parts: Parts, payload: BuildPayload, build: Build): Promise<void> {
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
    parts.status.textContent = payload.labels.downloadFailed;
  }
}
