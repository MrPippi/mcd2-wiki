import { EMPTY_STATUSES } from "../../../shared/status-schema";
import { DATATABLES_DIR } from "../game-tables";
import { issue } from "../issues";
import { STATUS_TABLE_FILES, buildStatusData, loadStatusTables, validateStatusData } from "../statuses";
import { defineStep } from "../step";
import { bestiaryStep } from "./bestiary";
import { entriesStep } from "./entries";

/** Status page data: DT_StatusDefinition per status entry, its fusions, and the rows that name it. */
export const statusesStep = defineStep({
  name: "statuses",
  needs: { entries: entriesStep, bestiary: bestiaryStep },
  writes: ["statuses.json"],
  async run({ options }, { entries, bestiary }) {
    const tablesRead: string[] = [];
    const tables = await loadStatusTables(options.sourceRoot, (file) => tablesRead.push(file));
    if (!tables) {
      return { value: undefined, issues: [issue("missing-status-tables", `${DATATABLES_DIR}/${STATUS_TABLE_FILES.statuses}.json`)], files: { "statuses.json": EMPTY_STATUSES } };
    }
    const result = buildStatusData(tables, { entries: entries.output.entries, mobSlugs: bestiary.links.tagIndex });
    return { value: undefined, issues: result.issues, files: { "statuses.json": validateStatusData(result.data) }, tablesRead };
  },
});
