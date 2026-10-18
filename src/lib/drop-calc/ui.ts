/** The drop calculator in the browser: choices, a live result table and the address. */
import type { DropFile, DropRow } from "../drop-types";
import { mountPicker, optionArt, pickerParts, type PickerGroup, type PickerParts } from "../item-picker";
import { parseCalcPayload, type CalcItem, type CalcLabel, type CalcPayload } from "./parse";
import { allRows, decodeState, encodeState, formatOdds, narrowRows, narrowing, type CalcState } from "./state";

/** Fired after replaceState so the language links pick up the new query (SiteHeader listens). */
const LOCATION_EVENT = "mcd2:locationchange";

function readPayload(root: HTMLElement): CalcPayload | undefined {
  try {
    return parseCalcPayload(JSON.parse(root.querySelector("[data-drop-json]")?.textContent ?? ""));
  } catch {
    return undefined;
  }
}

const pick = <T extends HTMLElement>(root: HTMLElement, selector: string): T | undefined => root.querySelector<T>(selector) ?? undefined;

function options(select: HTMLSelectElement, entries: readonly (readonly [string, string])[], value: string): void {
  select.replaceChildren(...entries.map(([id, text]) => Object.assign(document.createElement("option"), { value: id, textContent: text, selected: id === value })));
}

const AREA_ICON_SIZE = 24;

function areaIcon(src: string): HTMLImageElement {
  return Object.assign(document.createElement("img"), { className: "drop-area-icon", src, alt: "", width: AREA_ICON_SIZE, height: AREA_ICON_SIZE, loading: "lazy" as const });
}

function nameCell(label: CalcLabel | undefined, fallback: string, unplaced: string): HTMLElement {
  const holder = document.createElement("span");
  if (label?.icon) {
    holder.className = "drop-area";
    holder.append(areaIcon(label.icon));
  }
  if (label?.href) holder.append(Object.assign(document.createElement("a"), { href: label.href, textContent: label.name }));
  else holder.textContent = label?.name ?? fallback;
  if (label?.note) holder.append(" ", Object.assign(document.createElement("span"), { className: "tag", textContent: label.note }));
  if (label?.unplaced) holder.append(" ", Object.assign(document.createElement("span"), { className: "tag warn", textContent: unplaced }));
  return holder;
}

interface Parts {
  readonly itemPick: HTMLButtonElement;
  readonly itemIcon: HTMLElement;
  readonly itemName: HTMLElement;
  readonly picker: PickerParts;
  readonly level: HTMLSelectElement;
  readonly difficulty: HTMLSelectElement;
  readonly rarity: HTMLSelectElement;
  readonly source: HTMLSelectElement;
  readonly area: HTMLSelectElement;
  readonly note: HTMLElement;
  readonly summary: HTMLElement;
  readonly body: HTMLElement;
  readonly region: HTMLElement;
  readonly link: HTMLAnchorElement;
}

function partsOf(root: HTMLElement): Parts | undefined {
  const picker = pickerParts(root.querySelector<HTMLDialogElement>("[data-dialog]"));
  if (!picker) return undefined;
  const found = {
    picker,
    itemPick: pick<HTMLButtonElement>(root, "[data-item-pick]"),
    itemIcon: pick(root, "[data-item-icon]"),
    itemName: pick(root, "[data-item-name]"),
    level: pick<HTMLSelectElement>(root, "[data-level]"),
    difficulty: pick<HTMLSelectElement>(root, "[data-difficulty]"),
    rarity: pick<HTMLSelectElement>(root, "[data-rarity]"),
    source: pick<HTMLSelectElement>(root, "[data-source]"),
    area: pick<HTMLSelectElement>(root, "[data-area]"),
    note: pick(root, "[data-gear-note]"),
    summary: pick(root, "[data-summary]"),
    body: pick(root, "[data-body]"),
    region: pick(root, "[data-region]"),
    link: pick<HTMLAnchorElement>(root, "[data-item-link]"),
  };
  return Object.values(found).every(Boolean) ? (found as Parts) : undefined;
}

function renderRows(parts: Parts, payload: CalcPayload, rows: readonly DropRow[]): void {
  parts.body.replaceChildren(
    ...rows.map((row) => {
      const tr = document.createElement("tr");
      tr.dataset.testid = "drop-row";
      const source = document.createElement("th");
      source.scope = "row";
      source.append(nameCell(payload.sources[row.source], row.source, payload.labels.unplaced));
      const area = document.createElement("td");
      area.append(row.area === "" ? payload.labels.anyArea : nameCell(payload.areas[row.area], row.area, payload.labels.unplaced));
      const chance = Object.assign(document.createElement("td"), { className: "drop-chance", textContent: formatOdds(row.probability) });
      tr.append(source, area, chance);
      return tr;
    }),
  );
}

const nameOf = (id: string, entries: readonly { id: string; name: string }[]): string => entries.find((one) => one.id === id)?.name ?? id;

function summaryOf(payload: CalcPayload, state: CalcState, rows: number): string {
  const item = payload.items.find((one) => one.key === state.item);
  if (!item) return payload.labels.empty;
  if (rows === 0) return payload.labels.none;
  return payload.labels.summary
    .replace("{item}", item.name)
    .replace("{threat}", String(state.level))
    .replace("{difficulty}", nameOf(state.difficulty, payload.difficulties))
    .replace("{rarity}", nameOf(state.rarity, payload.rarities))
    .replace("{count}", String(rows));
}

/** A book's icon sits in the enchantment book frame, like on the build planner. */
const frameOf = (payload: CalcPayload, item: CalcItem): string | undefined => (item.category === "enchantment-book" ? payload.bookFrame : undefined);

/** Every item in the picker, grouped by page category in the site's order. */
const itemGroups = (payload: CalcPayload): PickerGroup[] =>
  payload.categories.map((category) => ({
    label: category.name,
    options: payload.items
      .filter((item) => item.category === category.id)
      .map((item) => ({ key: item.key, name: item.name, search: item.search, icon: item.icon, unique: item.unique === true, frame: frameOf(payload, item) })),
  }));

/** The item button: the chosen item's icon and name, or the prompt. */
function renderItemPick(parts: Parts, payload: CalcPayload, state: CalcState): void {
  const item = payload.items.find((one) => one.key === state.item);
  const art = item ? optionArt({ icon: item.icon, frame: frameOf(payload, item) }) : undefined;
  parts.itemIcon.className = art?.className ?? "picker-icon";
  parts.itemIcon.replaceChildren(...(art ? [...art.childNodes] : []));
  parts.itemPick.dataset.filled = String(item !== undefined);
  parts.itemPick.dataset.unique = String(item?.unique === true);
  parts.itemName.textContent = item?.name ?? payload.labels.pick;
}

/** Shows the state: the menus, the rows, the notes and the address; returns the state with source and area choices that no longer apply cleared. */
function show(parts: Parts, payload: CalcPayload, file: DropFile, chosen: CalcState): CalcState {
  const everything = allRows(file, chosen);
  const { sources, areas } = narrowing(everything);
  const state = { ...chosen, source: sources.includes(chosen.source) ? chosen.source : "", area: areas.includes(chosen.area) ? chosen.area : "" };
  options(parts.source, [["", payload.labels.allSources], ...sources.map((id) => [id, payload.sources[id]?.name ?? id] as const)], state.source);
  options(parts.area, [["", payload.labels.allAreas], ...areas.map((id) => [id, payload.areas[id]?.name ?? id] as const)], state.area);
  const rows = narrowRows(everything, state);
  const item = payload.items.find((one) => one.key === state.item);
  renderItemPick(parts, payload, state);
  renderRows(parts, payload, rows);
  parts.region.hidden = rows.length === 0;
  parts.note.hidden = !(state.rarity !== "any" && item && /^(enchantment-book|talisman)\//.test(item.key));
  parts.link.hidden = !item;
  if (item) Object.assign(parts.link, { href: item.href, textContent: item.name });
  parts.summary.textContent = summaryOf(payload, state, rows.length);
  history.replaceState(history.state, "", `${location.pathname}${encodeState(location.search, state, payload)}${location.hash}`);
  window.dispatchEvent(new Event(LOCATION_EVENT));
  return state;
}

function fillStatic(parts: Parts, payload: CalcPayload, state: CalcState): void {
  options(parts.level, payload.levels.map((level) => [String(level), String(level)] as const), String(state.level));
  options(parts.difficulty, payload.difficulties.map((one) => [one.id, one.name] as const), state.difficulty);
  options(parts.rarity, payload.rarities.map((one) => [one.id, one.name] as const), state.rarity);
}

/** Wires up the calculator; false when the payload or markup is not what the page should have rendered. */
export function mountCalc(root: HTMLElement, file: DropFile): boolean {
  const payload = readPayload(root);
  const parts = partsOf(root);
  if (!payload || !parts) return false;
  let state = decodeState(location.search, payload);
  const set = (change: Partial<CalcState>): void => {
    state = show(parts, payload, file, { ...state, ...change });
  };
  fillStatic(parts, payload, state);
  const openPicker = mountPicker(parts.picker);
  const groups = itemGroups(payload);
  parts.itemPick.addEventListener("click", () =>
    openPicker({
      title: payload.labels.item,
      groups,
      current: state.item || undefined,
      pick: (key) => {
        parts.picker.dialog.close();
        set({ item: key, source: "", area: "" });
        parts.itemPick.focus();
      },
    }),
  );
  parts.level.addEventListener("change", () => set({ level: Number(parts.level.value) }));
  parts.difficulty.addEventListener("change", () => set({ difficulty: parts.difficulty.value }));
  parts.rarity.addEventListener("change", () => set({ rarity: parts.rarity.value as CalcState["rarity"] }));
  parts.source.addEventListener("change", () => set({ source: parts.source.value }));
  parts.area.addEventListener("change", () => set({ area: parts.area.value }));
  set({});
  root.hidden = false;
  return true;
}
