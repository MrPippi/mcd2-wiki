/**
 * Recommended player level by story stage (DT_ProgressionDefinition PlayerLevel). A stage is named only when its tag marks
 * the start of an area (SW.Progression.<Area>.Start, or .FirstVisit for the town) and that area has a name in the game
 * text (DT_AreaDefinition); other stages (Outpost, WitchT3, Maw, ...) have no clean name and are left out and reported.
 */
import type { Stage } from "../../shared/guides-schema";
import type { GuideTables } from "./guides-tables";
import { rowText, type Locales } from "./guides-texts";
import { issue, type Issue } from "./issues";

const PROGRESSION = "SW.Progression.";
const AREA = "SW.Area.";
const AREA_START = new Set(["start", "firstvisit"]);
const NAME = "SW.TextEntry.Name";

/** SW.Progression.Plains.A1.Start → SW.Area.Plains.A1; undefined for a stage that is not an area's start. */
export function stageAreaTag(tag: string): string | undefined {
  if (!tag.startsWith(PROGRESSION)) return undefined;
  const parts = tag.slice(PROGRESSION.length).split(".");
  const last = parts.at(-1)?.toLowerCase();
  return parts.length >= 2 && last !== undefined && AREA_START.has(last) ? `${AREA}${parts.slice(0, -1).join(".")}` : undefined;
}

function stageOf(tables: GuideTables, locales: Locales, row: GuideTables["progression"][number]): { stage?: Stage; issues: Issue[] } {
  const unnamed = { issues: [issue("guides-stage-unnamed", `${row.Name} (${row.TypeTag.TagName})`)] };
  const areaTag = stageAreaTag(row.TypeTag.TagName);
  const area = areaTag ? tables.areas.find((candidate) => candidate.TypeTag.TagName.toLowerCase() === areaTag.toLowerCase()) : undefined;
  if (!area) return unnamed;
  const name = rowText(locales, area.TypeTextData, NAME);
  return name.text ? { stage: { id: row.Name, level: row.ProgressionData.PlayerLevel, name: name.text }, issues: [] } : { issues: [...unnamed.issues, ...name.issues] };
}

export function buildStages(tables: GuideTables, locales: Locales): { stages: Stage[]; issues: Issue[] } {
  const built = tables.progression.map((row) => stageOf(tables, locales, row));
  return { stages: built.flatMap((one) => (one.stage ? [one.stage] : [])), issues: built.flatMap((one) => one.issues) };
}
