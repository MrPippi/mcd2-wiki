import type { Lang } from "../i18n";
import { compareLang, lowerFor } from "../lang";
import type { PayloadMarker } from "./payload";
import { MARKER_KINDS, type MarkerKind } from "./kinds";

const DEFAULT_LIMIT = 20;

const normalize = (text: string, lang: Lang): string => lowerFor(text.trim(), lang);

/** Names and areas in the page language and its comparison language, lowercased by the page language's rules. */
const searchableText = (marker: PayloadMarker, lang: Lang): string[] =>
  [lang, compareLang(lang)]
    .flatMap((l) => [marker.name[l], marker.area?.[l]])
    .filter((text): text is string => text !== undefined)
    .map((text) => normalize(text, lang));

/** Markers whose name or area contains the query, in their original order. */
export function searchMarkers<M extends PayloadMarker>(markers: readonly M[], query: string, lang: Lang, limit = DEFAULT_LIMIT): M[] {
  const needle = normalize(query, lang);
  if (needle === "") return [];
  return markers.filter((marker) => searchableText(marker, lang).some((text) => text.includes(needle))).slice(0, limit);
}

export const countByKind = (markers: readonly PayloadMarker[]): Record<MarkerKind, number> =>
  Object.fromEntries(MARKER_KINDS.map((kind) => [kind, markers.filter((marker) => marker.kind === kind).length])) as Record<
    MarkerKind,
    number
  >;

const isKind = (value: unknown): value is MarkerKind =>
  typeof value === "string" && (MARKER_KINDS as readonly string[]).includes(value);

/** Hidden kinds saved in storage; anything unreadable means nothing is hidden. */
export function parseHiddenKinds(raw: string | null): Set<MarkerKind> {
  if (!raw) return new Set();
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? new Set(value.filter(isKind)) : new Set();
  } catch {
    return new Set();
  }
}

export const serializeHiddenKinds = (hidden: ReadonlySet<MarkerKind>): string =>
  JSON.stringify(MARKER_KINDS.filter((kind) => hidden.has(kind)));

export function withKind(hidden: ReadonlySet<MarkerKind>, kind: MarkerKind, visible: boolean): Set<MarkerKind> {
  return new Set([...hidden].filter((other) => other !== kind).concat(visible ? [] : [kind]));
}
