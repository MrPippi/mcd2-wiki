import { buildAffixModels } from "../affix-models";
import { AffixDataSchema, type AffixData } from "../../../shared/affix-schema";
import { defineStep } from "../step";
import { entriesStep } from "./entries";
import { gameTablesStep } from "./gear";
import { guidesStep } from "./guides";

const NO_AFFIX: AffixData = { levels: [], tierFactors: [], models: {}, items: {} };

/** The effect-odds models; they use the guides' threat curves and rarity tiers. */
export const affixStep = defineStep({
  name: "affix",
  needs: { entries: entriesStep, tables: gameTablesStep, guides: guidesStep },
  writes: ["affix-models.json"],
  run(_context, { entries, tables, guides }) {
    const affix = tables
      ? buildAffixModels(entries.output.entries, tables, guides.threat, guides.rarity.tiers)
      : { data: NO_AFFIX, issues: [] };
    return { value: undefined, issues: affix.issues, files: { "affix-models.json": AffixDataSchema.parse(affix.data) } };
  },
});
