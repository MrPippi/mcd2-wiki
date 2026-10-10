/** The map data embedded in a map page: only the languages that page shows (spec §2.6). */
import type { MapMarker, WorldMap } from "../../../scripts/extract/map-schema";
import type { Localized } from "../../../scripts/extract/schemas";
import type { Lang } from "../lang";

/** Text in some languages; the viewer reads only the page language and its comparison language. */
export type SomeLangs = Partial<Localized>;

export interface PayloadMarker extends Omit<MapMarker, "name" | "area" | "note"> {
  readonly name: SomeLangs;
  readonly area?: SomeLangs;
  readonly note?: SomeLangs;
}

export interface PayloadWorld extends Omit<WorldMap, "name" | "markers"> {
  readonly name: SomeLangs;
  readonly markers: readonly PayloadMarker[];
}

const keep = (text: Localized, langs: readonly Lang[]): SomeLangs => Object.fromEntries(langs.map((lang) => [lang, text[lang]]));

const trimMarker = (marker: MapMarker, langs: readonly Lang[]): PayloadMarker => ({
  ...marker,
  name: keep(marker.name, langs),
  ...(marker.area ? { area: keep(marker.area, langs) } : {}),
  ...(marker.note ? { note: keep(marker.note, langs) } : {}),
});

/** A copy of the world with every name, area and note cut down to `langs`. */
export const trimWorld = (world: WorldMap, langs: readonly Lang[]): PayloadWorld => ({
  ...world,
  name: keep(world.name, langs),
  markers: world.markers.map((marker) => trimMarker(marker, langs)),
});
