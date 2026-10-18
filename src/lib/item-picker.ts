/** A picker dialog in the browser: icon grid in labelled groups, a filter, and one pick per opening. No imports beyond search folding: page scripts load it. */
import { foldForSearch } from "./lang";

const ICON_SIZE = 40;

export interface PickerOption {
  readonly key: string;
  readonly name: string;
  /** Folded names the filter matches against. */
  readonly search: string;
  readonly icon?: string;
  /** Unique gear: the orange slot border. */
  readonly unique?: boolean;
  /** Enchantment books: the frame image drawn over the icon instead of the square slot. */
  readonly frame?: string;
}

export interface PickerGroup {
  readonly label: string;
  readonly options: readonly PickerOption[];
}

export interface PickerParts {
  readonly dialog: HTMLDialogElement;
  readonly title: HTMLElement;
  readonly filter: HTMLInputElement;
  readonly options: HTMLElement;
  readonly noResults: HTMLElement;
  readonly close: HTMLElement;
}

export interface PickerRequest {
  readonly title: string;
  readonly groups: readonly PickerGroup[];
  /** Marked as the current choice; still selectable. */
  readonly current?: string;
  readonly pick: (key: string) => void;
}

const image = (src: string, className: string): HTMLImageElement =>
  Object.assign(document.createElement("img"), { src, alt: "", width: ICON_SIZE, height: ICON_SIZE, loading: "lazy" as const, className });

/** The option's art: the icon in the square slot, or behind its frame image. */
export function optionArt(option: Pick<PickerOption, "icon" | "frame">): HTMLSpanElement {
  const art = document.createElement("span");
  art.className = option.frame ? "compare-icon is-framed" : "compare-icon";
  art.setAttribute("aria-hidden", "true");
  if (option.icon) art.append(image(option.icon, "picker-art"));
  if (option.icon && option.frame) art.append(image(option.frame, "picker-frame"));
  return art;
}

function optionRow(option: PickerOption, request: PickerRequest): HTMLLIElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "compare-option";
  button.dataset.key = option.key;
  if (option.unique) button.dataset.unique = "true";
  if (request.current === option.key) button.setAttribute("aria-current", "true");
  const name = Object.assign(document.createElement("span"), { className: "compare-option-name", textContent: option.name });
  button.append(optionArt(option), name);
  button.addEventListener("click", () => request.pick(option.key));
  const row = document.createElement("li");
  row.append(button);
  return row;
}

function groupSection(label: string, options: readonly PickerOption[], request: PickerRequest): HTMLElement[] {
  if (options.length === 0) return [];
  const section = document.createElement("section");
  const heading = Object.assign(document.createElement("h3"), { className: "compare-option-heading", textContent: label });
  const list = document.createElement("ul");
  list.className = "compare-option-list";
  list.append(...options.map((option) => optionRow(option, request)));
  section.append(heading, list);
  return [section];
}

function showOptions(parts: PickerParts, request: PickerRequest): void {
  const query = foldForSearch(parts.filter.value.trim(), document.documentElement.lang);
  const groups = request.groups.map((group) => ({ ...group, options: group.options.filter((option) => query === "" || option.search.includes(query)) }));
  parts.options.replaceChildren(...groups.flatMap((group) => groupSection(group.label, group.options, request)));
  parts.noResults.hidden = groups.some((group) => group.options.length > 0);
}

/** Wires the close button, backdrop click and live filtering; returns the function that opens the dialog for a request. */
export function mountPicker(parts: PickerParts): (request: PickerRequest) => void {
  let request: PickerRequest | undefined;
  const { dialog, filter } = parts;
  parts.close.addEventListener("click", () => dialog.close());
  // The body fills the dialog, so only the backdrop has the dialog as target; a drag that starts inside never closes it.
  let pressedBackdrop = false;
  dialog.addEventListener("pointerdown", (event) => (pressedBackdrop = event.target === dialog));
  dialog.addEventListener("click", (event) => {
    if (pressedBackdrop && event.target === dialog) dialog.close();
  });
  filter.addEventListener("input", () => {
    if (request) showOptions(parts, request);
  });
  return (next) => {
    request = next;
    parts.title.textContent = next.title;
    filter.value = "";
    showOptions(parts, next);
    parts.options.scrollTop = 0;
    dialog.showModal();
    parts.options.querySelector('[aria-current="true"]')?.scrollIntoView({ block: "nearest" });
    filter.focus();
  };
}
