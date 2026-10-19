import { MapDataSchema, type MapData } from "../../../shared/map-schema";
import rawMap from "../../data/map.json";

/** World maps from `npm run extract`, validated at build time. */
export const mapData: MapData = MapDataSchema.parse(rawMap);

/** Published icon path per marker kind, for the filter swatches. */
export const legend: MapData["legend"] = mapData.legend;

export const markerTotal = (data: MapData = mapData): number => data.worlds.reduce((sum, world) => sum + world.markers.length, 0);
