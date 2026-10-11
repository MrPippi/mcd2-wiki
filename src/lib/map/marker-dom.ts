/** DOM for map pins, popups and search results, built with textContent so game text is never parsed as HTML. */
import type { PayloadMarker } from "./payload";
import type { Lang } from "../i18n";
import { assetUrl } from "../url";

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function iconImage(path: string, className: string): HTMLImageElement {
  const image = element("img", className);
  image.src = assetUrl(path);
  image.alt = "";
  return image;
}

export interface PinParts {
  readonly className: "map-pin" | "map-label";
  readonly icon?: string;
  readonly text?: string;
}

/** A pin is the kind's icon; an area is its name as plain text, with no icon, so it stays quieter than the pins. */
export function pinParts(marker: PayloadMarker, lang: Lang): PinParts {
  if (marker.kind === "area") return { className: "map-label", text: marker.name[lang] ?? "" };
  return { className: "map-pin", ...(marker.icon ? { icon: marker.icon } : {}) };
}

export function pinElement(marker: PayloadMarker, lang: Lang): HTMLElement {
  const { className, icon, text } = pinParts(marker, lang);
  const pin = element("span", className, text);
  if (icon) pin.append(iconImage(icon, "map-pin-icon"));
  return pin;
}

/** The kind label, unless the name already says it (a rift named 「裂隙」). Popups and search results share this rule. */
export const shownKind = (name: string | undefined, kindLabel: string): string | undefined => (kindLabel === name ? undefined : kindLabel);

export interface PopupTexts {
  readonly kind?: string;
  readonly name: string;
  readonly area?: string;
  readonly note?: string;
}

export function popupTexts(marker: PayloadMarker, lang: Lang, kindLabel: string): PopupTexts {
  const name = marker.name[lang] ?? "";
  const kind = shownKind(name, kindLabel);
  const area = marker.area?.[lang];
  const note = marker.note?.[lang];
  return { ...(kind ? { kind } : {}), name, ...(area ? { area } : {}), ...(note ? { note } : {}) };
}

export const resultText = (marker: PayloadMarker, lang: Lang, kindLabel: string): string =>
  [marker.name[lang], shownKind(marker.name[lang], kindLabel), marker.area?.[lang]].filter(Boolean).join(" · ");

export function popupElement(marker: PayloadMarker, lang: Lang, kindLabel: string): HTMLElement {
  const { kind, name, area, note } = popupTexts(marker, lang, kindLabel);
  const popup = element("div", "map-popup");
  if (kind) popup.append(element("p", "map-popup-kind mono", kind));
  popup.append(element("p", "map-popup-name", name));
  if (area) popup.append(element("p", "map-popup-area", area));
  if (note) popup.append(element("p", "map-popup-note", note));
  return popup;
}

export function resultElement(marker: PayloadMarker, lang: Lang, kindLabel: string): HTMLLIElement {
  const item = element("li", "");
  const button = element("button", "map-result", resultText(marker, lang, kindLabel));
  button.type = "button";
  button.dataset.markerId = marker.id;
  item.append(button);
  return item;
}
