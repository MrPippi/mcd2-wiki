import type { MapMarker } from "../../../scripts/extract/map-schema";
import { MARKER_KINDS, type MarkerKind } from "./kinds";

const DEFAULT_LIMIT = 20;

const normalize = (text: string): string => text.trim().toLocaleLowerCase();

const searchableText = (marker: MapMarker): string[] =>
  [marker.name.zh, marker.name.en, marker.area?.zh, marker.area?.en]
    .filter((text): text is string => text !== undefined)
    .map(normalize);

/** Markers whose name or area contains the query, in their original order. */
export function searchMarkers(markers: readonly MapMarker[], query: string, limit = DEFAULT_LIMIT): MapMarker[] {
  const needle = normalize(query);
  if (needle === "") return [];
  return markers.filter((marker) => searchableText(marker).some((text) => text.includes(needle))).slice(0, limit);
}

export const countByKind = (markers: readonly MapMarker[]): Record<MarkerKind, number> =>
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
