/** The weapon picker dialog: icon grid grouped melee/ranged and a filter; it adds one weapon to the comparison. */
import { foldForSearch } from "../lang";
import type { ComparePayload, CompareWeapon } from "./parse";

const ICON_SIZE = 40;

export interface PickerParts {
  readonly dialog: HTMLDialogElement;
  readonly title: HTMLElement;
  readonly filter: HTMLInputElement;
  readonly options: HTMLElement;
  readonly noResults: HTMLElement;
}

/** What the open dialog is picking for. */
export interface PickerRequest {
  readonly title: string;
  /** A weapon to mark as current: marked, still selectable. */
  readonly current?: string;
  /** Weapons already compared, by slug, with the tag to show: listed but not selectable. */
  readonly taken: ReadonlyMap<string, string>;
  readonly pick: (slug: string) => void;
}

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

function optionButton(weapon: CompareWeapon, request: PickerRequest): HTMLLIElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "compare-option";
  button.dataset.slug = weapon.slug;
  if (weapon.unique) button.dataset.unique = "true";
  const art = document.createElement("span");
  art.className = "compare-icon";
  art.append(...iconImage(weapon.icon));
  const name = document.createElement("span");
  name.className = "compare-option-name";
  name.textContent = weapon.name;
  button.append(art, name);
  const takenBy = request.taken.get(weapon.slug);
  if (takenBy !== undefined) {
    button.disabled = true;
    const tag = document.createElement("span");
    tag.className = "compare-option-tag";
    tag.textContent = takenBy;
    button.append(tag);
  }
  if (request.current === weapon.slug) button.setAttribute("aria-current", "true");
  button.addEventListener("click", () => request.pick(weapon.slug));
  const row = document.createElement("li");
  row.append(button);
  return row;
}

function group(label: string, weapons: readonly CompareWeapon[], request: PickerRequest): HTMLElement[] {
  if (weapons.length === 0) return [];
  const section = document.createElement("section");
  section.className = "compare-option-group";
  const heading = document.createElement("h3");
  heading.className = "compare-option-heading";
  heading.textContent = label;
  const list = document.createElement("ul");
  list.className = "compare-option-list";
  list.append(...weapons.map((weapon) => optionButton(weapon, request)));
  section.append(heading, list);
  return [section];
}

/** Redraws the options for the filter's current text. */
export function showOptions(parts: PickerParts, payload: ComparePayload, request: PickerRequest): void {
  const query = foldForSearch(parts.filter.value.trim(), document.documentElement.lang);
  const shown = payload.weapons.filter((weapon) => query === "" || weapon.search.includes(query));
  const { labels } = payload;
  parts.options.replaceChildren(
    ...group(labels.melee, shown.filter((weapon) => weapon.kind === "melee"), request),
    ...group(labels.ranged, shown.filter((weapon) => weapon.kind === "ranged"), request),
  );
  parts.noResults.hidden = shown.length > 0;
}

export function openPicker(parts: PickerParts, payload: ComparePayload, request: PickerRequest): void {
  parts.title.textContent = request.title;
  parts.filter.value = "";
  showOptions(parts, payload, request);
  parts.options.scrollTop = 0;
  parts.dialog.showModal();
  parts.filter.focus();
}

/** Close button, backdrop click and live filtering; `current` supplies the open request. */
export function wirePicker(parts: PickerParts, payload: ComparePayload, current: () => PickerRequest | undefined, close: HTMLElement): void {
  const { dialog, filter } = parts;
  close.addEventListener("click", () => dialog.close());
  // The body fills the dialog, so only the backdrop has the dialog as target; a drag that starts inside never closes it.
  let pressedBackdrop = false;
  dialog.addEventListener("pointerdown", (event) => (pressedBackdrop = event.target === dialog));
  dialog.addEventListener("click", (event) => {
    if (pressedBackdrop && event.target === dialog) dialog.close();
  });
  filter.addEventListener("input", () => {
    const request = current();
    if (request) showOptions(parts, payload, request);
  });
}
