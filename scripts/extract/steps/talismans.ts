import { TalismanDataSchema } from "../gear-schema";
import { defineStep } from "../step";
import { loadTalismanTables } from "../talisman-tables";
import { buildTalismanData } from "../talismans";
import { entriesStep } from "./entries";
import { gameTablesStep } from "./gear";

export const talismansStep = defineStep({
  name: "talismans",
  needs: { entries: entriesStep, tables: gameTablesStep },
  writes: ["talismans.json"],
  async run({ options }, { entries, tables }) {
    const talismanTables = await loadTalismanTables(options.sourceRoot);
    const talismans = tables && talismanTables ? buildTalismanData(entries.output.entries, talismanTables, tables.effects) : { data: {}, issues: [] };
    return { value: talismans.data, issues: talismans.issues, files: { "talismans.json": TalismanDataSchema.parse(talismans.data) } };
  },
});
