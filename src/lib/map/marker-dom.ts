/** DOM for map pins, popups and search results, built with textContent so game text is never parsed as HTML. */
import type { MapMarker } from "../../../scripts/extract/map-schema";
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

export function pinElement(marker: MapMarker, lang: Lang): HTMLElement {
  if (marker.kind !== "area") {
    const pin = element("span", "map-pin");
    if (marker.icon) pin.append(iconImage(marker.icon, "map-pin-icon"));
    return pin;
  }
  const label = element("span", "map-label");
  if (marker.icon) label.append(iconImage(marker.icon, "map-label-icon"));
  label.append(element("span", "map-label-text", marker.name[lang]));
  return label;
}

export function popupElement(marker: MapMarker, lang: Lang, kindLabel: string): HTMLElement {
  const popup = element("div", "map-popup");
  popup.append(element("p", "map-popup-kind mono", kindLabel), element("p", "map-popup-name", marker.name[lang]));
  if (marker.area) popup.append(element("p", "map-popup-area", marker.area[lang]));
  if (marker.note) popup.append(element("p", "map-popup-note", marker.note[lang]));
  return popup;
}

export function resultElement(marker: MapMarker, lang: Lang, kindLabel: string): HTMLLIElement {
  const item = element("li", "");
  const kind = kindLabel === marker.name[lang] ? undefined : kindLabel;
  const button = element("button", "map-result", [marker.name[lang], kind, marker.area?.[lang]].filter(Boolean).join(" · "));
  button.type = "button";
  button.dataset.markerId = marker.id;
  item.append(button);
  return item;
}
