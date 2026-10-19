import { existsSync } from "node:fs";
import path from "node:path";
import { DATATABLES_DIR } from "../game-tables";
import { issue } from "../issues";
import { buildMapData, type MapResult } from "../map";
import { loadMapTables } from "../map-tables";
import { defineStep } from "../step";
import { localesStep } from "./locales";

/** World map markers; with no region table in source-data the map is left empty and reported. */
export const mapStep = defineStep({
  name: "map",
  needs: { locales: localesStep },
  writes: [],
  async run({ options }, { locales }) {
    const tables = await loadMapTables(options.sourceRoot);
    const map: MapResult = tables
      ? buildMapData(tables, locales, (relative) => existsSync(path.join(options.sourceRoot, ...relative.split("/"))))
      : { data: { worlds: [], legend: {} }, icons: [], areaName: () => undefined, issues: [issue("missing-map-tables", `${DATATABLES_DIR}/DT_WorldRegionMapData.json`)] };
    return { value: map, issues: map.issues };
  },
});
