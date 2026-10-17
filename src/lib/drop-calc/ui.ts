/** The drop calculator in the browser: choices, a live result table and the address. */
import { foldForSearch } from "../lang";
import type { DropFile } from "../drop-types";
import { parseCalcPayload, type CalcLabel, type CalcPayload } from "./parse";
import { decodeState, encodeState, formatOdds, narrowing, stateRows, type CalcState } from "./state";

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

function nameCell(label: CalcLabel | undefined, fallback: string): HTMLElement {
  const holder = document.createElement("span");
  if (label?.href) holder.append(Object.assign(document.createElement("a"), { href: label.href, textContent: label.name }));
  else holder.textContent = label?.name ?? fallback;
  if (label?.note) holder.append(" ", Object.assign(document.createElement("span"), { className: "tag", textContent: label.note }));
  return holder;
}

interface Parts {
  readonly filter: HTMLInputElement;
  readonly item: HTMLSelectElement;
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
  const found = {
    filter: pick<HTMLInputElement>(root, "[data-filter]"),
    item: pick<HTMLSelectElement>(root, "[data-item]"),
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

function renderRows(parts: Parts, payload: CalcPayload, rows: ReturnType<typeof stateRows>): void {
  parts.body.replaceChildren(
    ...rows.map((row) => {
      const tr = document.createElement("tr");
      tr.dataset.testid = "drop-row";
      const source = document.createElement("th");
      source.scope = "row";
      source.append(nameCell(payload.sources[row.source], row.source));
      const area = document.createElement("td");
      area.append(row.area === "" ? payload.labels.anyArea : nameCell(payload.areas[row.area], row.area));
      const chance = Object.assign(document.createElement("td"), { className: "drop-chance", textContent: formatOdds(row.probability) });
      tr.append(source, area, chance);
      return tr;
    }),
  );
}

/** Wires up the calculator; false when the payload or markup is not what the page should have rendered. */
export function mountCalc(root: HTMLElement, file: DropFile): boolean {
  const payload = readPayload(root);
  const parts = partsOf(root);
  if (!payload || !parts) return false;
  let state: CalcState = decodeState(location.search, payload);
  const locale = document.documentElement.lang;
  const nameOf = (id: string, entries: readonly { id: string; name: string }[]): string => entries.find((one) => one.id === id)?.name ?? id;

  const fillItems = (): void => {
    const query = foldForSearch(parts.filter.value.trim(), locale);
    const shown = payload.items.filter((one) => query === "" || one.search.includes(query));
    options(parts.item, [["", payload.labels.pick], ...shown.map((one) => [one.key, one.name] as const)], state.item);
  };
  const summaryOf = (rows: number): string => {
    const item = payload.items.find((one) => one.key === state.item);
    if (!item) return payload.labels.empty;
    if (rows === 0) return payload.labels.none;
    return payload.labels.summary
      .replace("{item}", item.name)
      .replace("{threat}", String(state.level))
      .replace("{difficulty}", nameOf(state.difficulty, payload.difficulties))
      .replace("{rarity}", nameOf(state.rarity, payload.rarities))
      .replace("{count}", String(rows));
  };
  const update = (): void => {
    const { sources, areas } = narrowing(stateRows(file, { ...state, source: "", area: "" }));
    state = { ...state, source: sources.includes(state.source) ? state.source : "", area: areas.includes(state.area) ? state.area : "" };
    options(parts.source, [["", payload.labels.allSources], ...sources.map((id) => [id, payload.sources[id]?.name ?? id] as const)], state.source);
    options(parts.area, [["", payload.labels.allAreas], ...areas.map((id) => [id, payload.areas[id]?.name ?? id] as const)], state.area);
    const rows = stateRows(file, state);
    const item = payload.items.find((one) => one.key === state.item);
    renderRows(parts, payload, rows);
    parts.region.hidden = rows.length === 0;
    parts.note.hidden = !(state.rarity !== "any" && item && /^(enchantment-book|talisman)\//.test(item.key));
    parts.link.hidden = !item;
    if (item) {
      parts.link.href = item.href;
      parts.link.textContent = item.name;
    }
    parts.summary.textContent = summaryOf(rows.length);
    history.replaceState(history.state, "", `${location.pathname}${encodeState(location.search, state, payload)}${location.hash}`);
    window.dispatchEvent(new Event(LOCATION_EVENT));
  };
  const set = (change: Partial<CalcState>): void => {
    state = { ...state, ...change };
    update();
  };

  options(parts.level, payload.levels.map((level) => [String(level), String(level)] as const), String(state.level));
  options(parts.difficulty, payload.difficulties.map((one) => [one.id, one.name] as const), state.difficulty);
  options(parts.rarity, payload.rarities.map((one) => [one.id, one.name] as const), state.rarity);
  fillItems();
  parts.filter.addEventListener("input", fillItems);
  parts.item.addEventListener("change", () => set({ item: parts.item.value, source: "", area: "" }));
  parts.level.addEventListener("change", () => set({ level: Number(parts.level.value) }));
  parts.difficulty.addEventListener("change", () => set({ difficulty: parts.difficulty.value }));
  parts.rarity.addEventListener("change", () => set({ rarity: parts.rarity.value as CalcState["rarity"] }));
  parts.source.addEventListener("change", () => set({ source: parts.source.value }));
  parts.area.addEventListener("change", () => set({ area: parts.area.value }));
  update();
  root.hidden = false;
  return true;
}
