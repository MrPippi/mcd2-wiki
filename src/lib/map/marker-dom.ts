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

export function pinElement(marker: PayloadMarker, lang: Lang): HTMLElement {
  if (marker.kind !== "area") {
    const pin = element("span", "map-pin");
    if (marker.icon) pin.append(iconImage(marker.icon, "map-pin-icon"));
    return pin;
  }
  const label = element("span", "map-label");
  if (marker.icon) label.append(iconImage(marker.icon, "map-label-icon"));
  label.append(element("span", "map-label-text", marker.name[lang] ?? ""));
  return label;
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
