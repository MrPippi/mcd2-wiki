import type { Lang } from "../i18n";
import { compareLang, searchFold } from "../lang";
import type { PayloadMarker } from "./payload";
import { FILTER_KINDS, MARKER_KINDS, type FilterKind, type MarkerKind } from "./kinds";

const DEFAULT_LIMIT = 20;

/** Names and areas in the page language and its comparison language, each folded by its own language's rules. */
const searchableText = (marker: PayloadMarker, lang: Lang): string[] =>
  [lang, compareLang(lang)].flatMap((l) =>
    [marker.name[l], marker.area?.[l]].filter((text): text is string => text !== undefined).map((text) => searchFold(text, l)),
  );

/** Markers whose name or area contains the query, in their original order. */
export function searchMarkers<M extends PayloadMarker>(markers: readonly M[], query: string, lang: Lang, limit = DEFAULT_LIMIT): M[] {
  const needle = searchFold(query.trim(), lang);
  if (needle === "") return [];
  return markers.filter((marker) => searchableText(marker, lang).some((text) => text.includes(needle))).slice(0, limit);
}

export const countByKind = (markers: readonly PayloadMarker[]): Record<MarkerKind, number> =>
  Object.fromEntries(MARKER_KINDS.map((kind) => [kind, markers.filter((marker) => marker.kind === kind).length])) as Record<
    MarkerKind,
    number
  >;

const isFilterKind = (value: unknown): value is FilterKind => FILTER_KINDS.some((kind) => kind === value);

/** Hidden kinds saved in storage; anything unreadable means nothing is hidden, and area names are never hidden. */
export function parseHiddenKinds(raw: string | null): Set<FilterKind> {
  if (!raw) return new Set();
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? new Set(value.filter(isFilterKind)) : new Set();
  } catch {
    return new Set();
  }
}

export const serializeHiddenKinds = (hidden: ReadonlySet<FilterKind>): string =>
  JSON.stringify(FILTER_KINDS.filter((kind) => hidden.has(kind)));

export function withKind(hidden: ReadonlySet<FilterKind>, kind: FilterKind, visible: boolean): Set<FilterKind> {
  return new Set([...hidden].filter((other) => other !== kind).concat(visible ? [] : [kind]));
}
