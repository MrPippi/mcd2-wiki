/** Small hand-made area and progression rows in the game's export shape, for the location extraction tests. */
import type { LocationAreaRow, ProgressionRow } from "../../scripts/extract/location-tables";

export const AREA_ICON = (file: string) => `/OreUI/UI/Icons/Location/AreaIcons/${file}.${file}`;
export const MAP_PIN = "/SpicewoodUI/Spicewood/UI/Texture/WorldMap/Icons/T_UI_Icon_DeepDarkEntrance.T_UI_Icon_DeepDarkEntrance";

export interface AreaOptions {
  /** Name key in DT_AreaDefinition.csv; null for a row without a name. */
  readonly key?: string | null;
  readonly icon?: string;
  readonly progression?: string;
}

export function locationRow(name: string, typeTag: string, options: AreaOptions = {}): LocationAreaRow {
  const key = options.key === undefined ? name : options.key;
  return {
    Name: name,
    TypeTag: { TagName: typeTag },
    ...(key === null ? {} : { TypeTextData: { Texts: { '(TagName="SW.TextEntry.Name")': { Text: `LOCTABLE("DT_AreaDefinition.csv", "${key}")` } } } }),
    AreaIcon: options.icon ?? "None",
    AreaDefinition: { ProgressionDefinition: { TagName: options.progression ?? "None" } },
  };
}

export const progressionRow = (typeTag: string, level: number): ProgressionRow => ({ TypeTag: { TagName: typeTag }, ProgressionData: { PlayerLevel: level } });
