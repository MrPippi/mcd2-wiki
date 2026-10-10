import { MapDataSchema, type MapData } from "../../../scripts/extract/map-schema";
import rawMap from "../../data/map.json";

/** World maps from `npm run extract`, validated at build time. */
export const mapData: MapData = MapDataSchema.parse(rawMap);

export const markerTotal = (data: MapData = mapData): number => data.worlds.reduce((sum, world) => sum + world.markers.length, 0);
