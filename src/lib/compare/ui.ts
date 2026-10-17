/** The weapon comparison in the browser: column pickers, the table, the address and the copy button. */
import { bestColumns, compareSearch, decodeCompare, placeWeapon, removeWeapon } from "./code";
import { parseComparePayload, type ComparePayload, type CompareWeapon } from "./parse";
import { iconImage, openPicker, wirePicker, type PickerParts, type PickerRequest } from "./picker";

/** Fired after replaceState so the language links pick up the new query (SiteHeader listens). */
const LOCATION_EVENT = "mcd2:locationchange";
const ICON_SIZE = 40;

interface Parts {
  /** One per column, in order. */
  readonly columns: readonly HTMLElement[];
  readonly picker: PickerParts;
  readonly close: HTMLElement;
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
  const columns = [...root.querySelectorAll<HTMLElement>("[data-pick]")];
  const picker = {
    dialog: one<HTMLDialogElement>("[data-dialog]"),
    title: one("[data-dialog-title]"),
    filter: one<HTMLInputElement>("[data-filter]"),
    options: one("[data-options]"),
    noResults: one("[data-no-results]"),
  };
  const parts = {
    close: one("[data-close]"),
    scroll: one("[data-scroll]"),
    head: one("[data-head]"),
    body: one("[data-body]"),
    empty: one("[data-empty]"),
    notice: one("[data-notice]"),
    status: one("[data-status]"),
    url: one<HTMLInputElement>("[data-url]"),
  };
  const complete = columns.length > 0 && [...Object.values(parts), ...Object.values(picker)].every(Boolean);
  return complete ? ({ ...parts, columns, picker } as Parts) : undefined;
}

const cell = (tag: "th" | "td", text = ""): HTMLTableCellElement => {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
};

function weaponHead(weapon: CompareWeapon): HTMLTableCellElement {
  const head = cell("th");
  head.scope = "col";
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
  head.append(link);
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
  headRow.append(corner, ...weapons.map(weaponHead));
  parts.head.replaceChildren(headRow);
  const { labels } = payload;
  const rows = [
    ...payload.rows.map((row) => statRow(row.label, weapons, row.key, row.better, labels.best)),
    listRow(labels.builtIn, weapons.map((weapon) => (weapon.fixed ? [weapon.fixed] : []))),
    listRow(labels.effects, weapons.map((weapon) => weapon.effects)),
  ];
  parts.body.replaceChildren(...rows.flatMap((row) => row ?? []));
}

/** The column buttons: icon and name of the weapon each holds, or the prompt when empty. */
function renderColumns(parts: Parts, payload: ComparePayload, slugs: readonly string[]): void {
  parts.columns.forEach((column, index) => {
    const weapon = payload.weapons.find((found) => found.slug === slugs[index]);
    column.dataset.slug = weapon?.slug ?? "";
    column.dataset.filled = String(weapon !== undefined);
    column.dataset.unique = String(weapon?.unique === true);
    column.querySelector("[data-icon]")?.replaceChildren(...iconImage(weapon?.icon));
    const name = column.querySelector<HTMLElement>("[data-name]");
    if (name) name.textContent = weapon?.name ?? payload.labels.pick;
    const clear = column.querySelector<HTMLElement>("[data-clear]");
    if (clear) clear.hidden = weapon === undefined;
  });
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

const columnLabel = (payload: ComparePayload, index: number): string => payload.labels.column.replace("{n}", () => String(index + 1));

/** Wires up the comparison; false when the payload or markup is not what the page should have rendered. */
export function mountCompare(root: HTMLElement): boolean {
  const payload = readPayload(root);
  const parts = partsOf(root);
  if (!payload || !parts) return false;
  const decoded = decodeCompare(location.search, new Set(payload.weapons.map((weapon) => weapon.slug)));
  let slugs: readonly string[] = decoded.slugs;
  let request: PickerRequest | undefined;
  const show = (next: readonly string[]) => {
    slugs = next;
    renderColumns(parts, payload, slugs);
    render(parts, payload, slugs);
  };
  const change = (next: readonly string[], focusColumn: number) => {
    show(next);
    syncUrl(slugs);
    parts.notice.hidden = true;
    parts.url.hidden = true;
    parts.status.textContent = "";
    // Picks pack to the left, so focus the column the weapon landed in, or the first empty one.
    parts.columns[Math.min(focusColumn, slugs.length, parts.columns.length - 1)]?.querySelector<HTMLElement>("[data-pick-open]")?.focus();
  };
  if (decoded.dropped > 0) syncUrl(slugs);
  show(slugs);
  parts.columns.forEach((column, index) => {
    column.querySelector("[data-pick-open]")?.addEventListener("click", () => {
      const taken = new Map(slugs.flatMap((slug, other) => (other === index ? [] : [[slug, columnLabel(payload, other)] as const])));
      request = {
        title: columnLabel(payload, index),
        current: slugs[index],
        taken,
        pick: (slug) => {
          parts.picker.dialog.close();
          const next = placeWeapon(slugs, index, slug);
          change(next, next.indexOf(slug));
        },
      };
      openPicker(parts.picker, payload, request);
    });
    column.querySelector("[data-clear]")?.addEventListener("click", () => change(removeWeapon(slugs, index), index));
  });
  wirePicker(parts.picker, payload, () => request, parts.close);
  root.querySelector("[data-copy]")?.addEventListener("click", () => void copyLink(parts, payload));
  root.hidden = false;
  if (decoded.dropped > 0) {
    parts.notice.hidden = false;
    announce(parts.notice, payload.labels.dropped.replace("{n}", () => String(decoded.dropped)));
  }
  return true;
}
