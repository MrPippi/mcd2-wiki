/** DOM for map pins, popups and search results, built with textContent so game text is never parsed as HTML. */
import type { PayloadMarker } from "./payload";
import type { Lang } from "../i18n";
import { assetUrl, href } from "../url";

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

/** A kind's own note (a storm generator spot) shows when the marker has none of its own. */
export function popupTexts(marker: PayloadMarker, lang: Lang, kindLabel: string, kindNote?: string): PopupTexts {
  const name = marker.name[lang] ?? "";
  const kind = shownKind(name, kindLabel);
  const area = marker.area?.[lang];
  const note = marker.note?.[lang] ?? kindNote;
  return { ...(kind ? { kind } : {}), name, ...(area ? { area } : {}), ...(note ? { note } : {}) };
}

export const resultText = (marker: PayloadMarker, lang: Lang, kindLabel: string): string =>
  [marker.name[lang], shownKind(marker.name[lang], kindLabel), marker.area?.[lang]].filter(Boolean).join(" · ");

export interface PopupQuest {
  readonly title: string;
  readonly href: string;
}

export interface PopupLinks {
  /** The name links straight to its quest when the pin is that one quest's spot. */
  readonly nameHref?: string;
  /** Otherwise the quests are listed under the name. */
  readonly list: PopupQuest[];
}

export function popupLinks(marker: PayloadMarker, lang: Lang): PopupLinks {
  // A talisman chest names its talisman, which the name links to.
  if (marker.entry) return { nameHref: href(lang, marker.entry.category, marker.entry.slug), list: [] };
  const quests = (marker.quests ?? []).map((quest) => ({ title: quest.title[lang] ?? "", href: href(lang, "quests", quest.slug) }));
  const [only] = quests;
  if (quests.length === 1 && only.title === marker.name[lang]) return { nameHref: only.href, list: [] };
  return { list: quests };
}

function link(text: string, url: string): HTMLAnchorElement {
  const anchor = element("a", "", text);
  anchor.href = url;
  return anchor;
}

export function popupElement(marker: PayloadMarker, lang: Lang, kindLabel: string, kindNote?: string): HTMLElement {
  const { kind, name, area, note } = popupTexts(marker, lang, kindLabel, kindNote);
  const { nameHref, list } = popupLinks(marker, lang);
  const popup = element("div", "map-popup");
  if (kind) popup.append(element("p", "map-popup-kind mono", kind));
  const nameLine = element("p", "map-popup-name");
  nameLine.append(nameHref ? link(name, nameHref) : document.createTextNode(name));
  popup.append(nameLine);
  if (area) popup.append(element("p", "map-popup-area", area));
  if (note) popup.append(element("p", "map-popup-note", note));
  if (list.length > 0) {
    const items = element("ul", "map-popup-quests");
    items.append(
      ...list.map((quest) => {
        const item = element("li", "");
        item.append(link(quest.title, quest.href));
        return item;
      }),
    );
    popup.append(items);
  }
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
