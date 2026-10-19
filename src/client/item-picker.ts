/** A picker dialog in the browser: icon grid in labelled groups, a filter, and one pick per opening. No imports beyond search folding: page scripts load it. */
import { foldForSearch } from "../../shared/lang";

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
  /** Listed but not selectable, e.g. already compared or worn in another slot. */
  readonly disabled?: boolean;
  /** A short note after the name, e.g. "Added". */
  readonly tag?: string;
}

export interface PickerGroup {
  /** Empty for a dialog with one group: no heading is drawn. */
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
  art.className = option.frame ? "picker-icon is-framed" : "picker-icon";
  art.setAttribute("aria-hidden", "true");
  if (option.icon) art.append(image(option.icon, "picker-art"));
  if (option.icon && option.frame) art.append(image(option.frame, "picker-frame"));
  return art;
}

function optionRow(option: PickerOption, request: PickerRequest): HTMLLIElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "picker-option";
  button.dataset.key = option.key;
  button.disabled = option.disabled === true;
  if (option.unique) button.dataset.unique = "true";
  if (request.current === option.key) button.setAttribute("aria-current", "true");
  const name = Object.assign(document.createElement("span"), { className: "picker-option-name", textContent: option.name });
  button.append(optionArt(option), name);
  if (option.tag) button.append(Object.assign(document.createElement("span"), { className: "picker-option-tag", textContent: option.tag }));
  button.addEventListener("click", () => request.pick(option.key));
  const row = document.createElement("li");
  row.append(button);
  return row;
}

function groupSection(label: string, options: readonly PickerOption[], request: PickerRequest): HTMLElement[] {
  if (options.length === 0) return [];
  const section = document.createElement("section");
  const list = document.createElement("ul");
  list.className = "picker-option-list";
  list.append(...options.map((option) => optionRow(option, request)));
  if (label) section.append(Object.assign(document.createElement("h3"), { className: "picker-option-heading", textContent: label }));
  section.append(list);
  return [section];
}

function showOptions(parts: PickerParts, request: PickerRequest): void {
  const query = foldForSearch(parts.filter.value.trim(), document.documentElement.lang);
  const groups = request.groups.map((group) => ({ ...group, options: group.options.filter((option) => query === "" || option.search.includes(query)) }));
  parts.options.replaceChildren(...groups.flatMap((group) => groupSection(group.label, group.options, request)));
  parts.noResults.hidden = groups.some((group) => group.options.length > 0);
}

/** Finds the parts of an ItemPickerDialog; undefined when one is missing. */
export function pickerParts(dialog: HTMLDialogElement | null): PickerParts | undefined {
  const one = <T extends HTMLElement>(selector: string) => dialog?.querySelector<T>(selector) ?? undefined;
  const parts = {
    dialog: dialog ?? undefined,
    title: one("[data-dialog-title]"),
    filter: one<HTMLInputElement>("[data-filter]"),
    options: one("[data-options]"),
    noResults: one("[data-no-results]"),
    close: one("[data-close]"),
  };
  return Object.values(parts).every(Boolean) ? (parts as PickerParts) : undefined;
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
