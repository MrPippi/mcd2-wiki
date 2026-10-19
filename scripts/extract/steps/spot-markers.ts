import { existsSync } from "node:fs";
import path from "node:path";
import type { Entry } from "../schemas";
import { loadGuideTables } from "../guides-tables";
import { issue } from "../issues";
import type { MapResult } from "../map";
import type { MapData } from "../map-schema";
import { MapDataSchema } from "../map-schema";
import { addSpotMarkers, chestTalismans, loadMapSpots, type SpotMarkersResult } from "../map-spots";
import { defineStep } from "../step";
import { entriesStep } from "./entries";
import { mapStep } from "./map";
import { questMarkersStep } from "./quest-markers";

/** Storm generator slots, talisman chests and dungeon doors, placed on the map that already has the quest pins. */
async function addSpots(sourceRoot: string, map: MapResult, base: MapData, entries: readonly Entry[]): Promise<SpotMarkersResult> {
  // No map at all: the missing region table is already reported.
  if (base.worlds.length === 0) return { data: base, issues: [] };
  const spots = await loadMapSpots(sourceRoot);
  if (!spots) return { data: base, issues: [issue("missing-map-tables", "MapSpots/map-spots.json")] };
  const { tables } = await loadGuideTables(sourceRoot);
  return addSpotMarkers(base, {
    spots,
    areaName: map.areaName,
    talismans: chestTalismans(tables, entries),
    iconExists: (relative) => existsSync(path.join(sourceRoot, ...relative.split("/"))),
  });
}

/** Writes map.json: the map with the quest pins and then the spot markers. */
export const spotMarkersStep = defineStep({
  name: "spot-markers",
  needs: { map: mapStep, questMarkers: questMarkersStep, entries: entriesStep },
  writes: ["map.json"],
  async run({ options }, { map, questMarkers, entries }) {
    const spotMap = await addSpots(options.sourceRoot, map, questMarkers, entries.output.entries);
    return { value: undefined, issues: spotMap.issues, files: { "map.json": MapDataSchema.parse(spotMap.data) } };
  },
});
