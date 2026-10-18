/** The weapon comparison in the browser: the add button, the table, the address and the copy button. */
import { addWeapon, bestColumns, compareSearch, decodeCompare, MAX_WEAPONS, removeWeapon } from "./code";
import { parseComparePayload, type ComparePayload, type CompareWeapon } from "./parse";
import { mountPicker, pickerParts, type PickerGroup, type PickerParts } from "../item-picker";

/** Fired after replaceState so the language links pick up the new query (SiteHeader listens). */
const LOCATION_EVENT = "mcd2:locationchange";
const ICON_SIZE = 40;

interface Parts {
  readonly add: HTMLButtonElement;
  readonly count: HTMLElement;
  readonly picker: PickerParts;
  readonly scroll: HTMLElement;
  readonly head: HTMLElement;
  readonly body: HTMLElement;
  readonly empty: HTMLElement;
  readonly notice: HTMLElement;
  readonly status: HTMLElement;
  readonly url: HTMLInputElement;
}

function readPayload(root: HTMLElement): ComparePayload | undefined {
  try {
    return parseComparePayload(JSON.parse(root.querySelector("[data-weapon-compare-json]")?.textContent ?? ""));
  } catch {
    return undefined; // not JSON: the caller reports it like any other bad payload
  }
}

function partsOf(root: HTMLElement): Parts | undefined {
  const one = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector) ?? undefined;
  const picker = pickerParts(root.querySelector<HTMLDialogElement>("[data-dialog]"));
  const parts = {
    add: one<HTMLButtonElement>("[data-add]"),
    count: one("[data-count]"),
    scroll: one("[data-scroll]"),
    head: one("[data-head]"),
    body: one("[data-body]"),
    empty: one("[data-empty]"),
    notice: one("[data-notice]"),
    status: one("[data-status]"),
    url: one<HTMLInputElement>("[data-url]"),
  };
  return picker && Object.values(parts).every(Boolean) ? ({ ...parts, picker } as Parts) : undefined;
}

/** Melee then ranged; weapons already compared are listed but cannot be added again. */
function weaponGroups(payload: ComparePayload, slugs: readonly string[]): PickerGroup[] {
  const option = (weapon: CompareWeapon) => {
    const added = slugs.includes(weapon.slug);
    return { key: weapon.slug, name: weapon.name, search: weapon.search, icon: weapon.icon, unique: weapon.unique, disabled: added, tag: added ? payload.labels.added : undefined };
  };
  const { labels, weapons } = payload;
  return [
    { label: labels.melee, options: weapons.filter((weapon) => weapon.kind === "melee").map(option) },
    { label: labels.ranged, options: weapons.filter((weapon) => weapon.kind === "ranged").map(option) },
  ];
}

const cell = (tag: "th" | "td", text = ""): HTMLTableCellElement => {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
};

/** A weapon's column head: icon and name linking to its page, and the button that takes it out of the comparison. */
function weaponHead(weapon: CompareWeapon, index: number, clear: string): HTMLTableCellElement {
  const head = cell("th");
  head.scope = "col";
  head.dataset.slug = weapon.slug;
  const link = document.createElement("a");
  link.href = weapon.href;
  link.className = "compare-weapon";
  if (weapon.unique) link.dataset.unique = "true";
  if (weapon.icon) {
    const image = document.createElement("img");
    image.src = weapon.icon;
    image.alt = "";
    image.width = ICON_SIZE;
    image.height = ICON_SIZE;
    link.append(image);
  }
  const name = document.createElement("span");
  name.textContent = weapon.name;
  link.append(name);
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "compare-remove";
  remove.dataset.remove = String(index);
  remove.setAttribute("aria-label", `${clear}: ${weapon.name}`);
  remove.textContent = "×";
  const holder = document.createElement("div");
  holder.className = "compare-head-cell";
  holder.append(link, remove);
  head.append(holder);
  return head;
}

function statRow(label: string, weapons: readonly CompareWeapon[], key: string, better: "high" | "low" | "none", bestLabel: string): HTMLTableRowElement | undefined {
  const cells = weapons.map((weapon) => weapon.cells[key]);
  if (cells.every((found) => found === undefined)) return undefined;
  const best = new Set(bestColumns(cells.map((found) => found?.value), better));
  const row = document.createElement("tr");
  const head = cell("th", label);
  head.scope = "row";
  row.append(head);
  cells.forEach((found, index) => {
    const data = cell("td", found?.text ?? "—");
    if (best.has(index)) {
      data.dataset.best = "true";
      const marker = document.createElement("span");
      marker.className = "sr-only";
      marker.textContent = ` (${bestLabel})`;
      data.append(marker);
    }
    row.append(data);
  });
  return row;
}

function listRow(label: string, values: readonly (readonly string[])[]): HTMLTableRowElement | undefined {
  if (values.every((list) => list.length === 0)) return undefined;
  const row = document.createElement("tr");
  const head = cell("th", label);
  head.scope = "row";
  row.append(head);
  for (const list of values) {
    const data = cell("td");
    if (list.length === 0) data.textContent = "—";
    else {
      const items = document.createElement("ul");
      items.className = "compare-list";
      items.append(...list.map((text) => Object.assign(document.createElement("li"), { textContent: text })));
      data.append(items);
    }
    row.append(data);
  }
  return row;
}

function render(parts: Parts, payload: ComparePayload, slugs: readonly string[]): void {
  const weapons = slugs.flatMap((slug) => payload.weapons.find((weapon) => weapon.slug === slug) ?? []);
  parts.empty.hidden = weapons.length > 0;
  parts.scroll.hidden = weapons.length === 0;
  const headRow = document.createElement("tr");
  const corner = cell("th", payload.labels.stat);
  corner.scope = "col";
  headRow.append(corner, ...weapons.map((weapon, index) => weaponHead(weapon, index, payload.labels.clear)));
  parts.head.replaceChildren(headRow);
  const { labels } = payload;
  const rows = [
    ...payload.rows.map((row) => statRow(row.label, weapons, row.key, row.better, labels.best)),
    listRow(labels.builtIn, weapons.map((weapon) => (weapon.fixed ? [weapon.fixed] : []))),
    listRow(labels.effects, weapons.map((weapon) => weapon.effects)),
  ];
  parts.body.replaceChildren(...rows.flatMap((row) => row ?? []));
}

/** The add button: hidden once the comparison is full, with how many places are used. */
function renderAdd(parts: Parts, slugs: readonly string[]): void {
  parts.add.hidden = slugs.length >= MAX_WEAPONS;
  parts.count.textContent = `${slugs.length} / ${MAX_WEAPONS}`;
}

function syncUrl(slugs: readonly string[]): void {
  history.replaceState(history.state, "", `${location.pathname}${compareSearch(location.search, slugs)}${location.hash}`);
  window.dispatchEvent(new Event(LOCATION_EVENT));
}

/** Sets a live region's text, clearing it first so the same message is announced again. */
function announce(element: HTMLElement, text: string): void {
  element.textContent = "";
  if (text) requestAnimationFrame(() => (element.textContent = text));
}

async function copyLink(parts: Parts, payload: ComparePayload): Promise<void> {
  try {
    await navigator.clipboard.writeText(location.href);
    parts.url.hidden = true;
    announce(parts.status, payload.labels.copied);
  } catch (error) {
    console.error("weapon compare: copy failed", error);
    announce(parts.status, payload.labels.copyFailed);
    parts.url.value = location.href;
    parts.url.hidden = false;
    parts.url.select();
  }
}

/** Wires up the comparison; false when the payload or markup is not what the page should have rendered. */
export function mountCompare(root: HTMLElement): boolean {
  const payload = readPayload(root);
  const parts = partsOf(root);
  if (!payload || !parts) return false;
  const decoded = decodeCompare(location.search, new Set(payload.weapons.map((weapon) => weapon.slug)));
  let slugs: readonly string[] = decoded.slugs;
  const show = (next: readonly string[]) => {
    slugs = next;
    renderAdd(parts, slugs);
    render(parts, payload, slugs);
  };
  const change = (next: readonly string[]) => {
    show(next);
    syncUrl(slugs);
    parts.notice.hidden = true;
    parts.url.hidden = true;
    parts.status.textContent = "";
  };
  if (decoded.dropped > 0) syncUrl(slugs);
  show(slugs);
  const openPicker = mountPicker(parts.picker);
  parts.add.addEventListener("click", () =>
    openPicker({
      title: payload.labels.add,
      groups: weaponGroups(payload, slugs),
      pick: (slug) => {
        parts.picker.dialog.close();
        change(addWeapon(slugs, slug));
        // The add button hides once the comparison is full: then focus the new weapon's link instead.
        (parts.add.hidden ? parts.head.querySelector<HTMLElement>(`th[data-slug="${slug}"] a`) : parts.add)?.focus();
      },
    }),
  );
  // The head is rebuilt on every change, so remove clicks are delegated.
  parts.head.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-remove]") : null;
    if (!button?.dataset.remove) return;
    change(removeWeapon(slugs, Number(button.dataset.remove)));
    parts.add.focus(); // the column and its button are gone
  });
  root.querySelector("[data-copy]")?.addEventListener("click", () => void copyLink(parts, payload));
  root.hidden = false;
  if (decoded.dropped > 0) {
    parts.notice.hidden = false;
    announce(parts.notice, payload.labels.dropped.replace("{n}", () => String(decoded.dropped)));
  }
  return true;
}
