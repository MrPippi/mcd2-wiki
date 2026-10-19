import { validateOutput } from "../output";
import { defineStep } from "../step";
import { withTalismanDescriptions } from "../talismans";
import { applyEnglishOverrides } from "../text-overrides";
import { entriesStep } from "./entries";
import { talismansStep } from "./talismans";

/** The entries as published (entries.json, armor-sets.json): English overrides applied and talisman descriptions filled in. */
export const describedStep = defineStep({
  name: "described",
  needs: { entries: entriesStep, talismans: talismansStep },
  writes: [],
  run(_context, { entries, talismans }) {
    const { output } = entries;
    return { value: validateOutput(withTalismanDescriptions(applyEnglishOverrides(output.entries), talismans), output.armorSets) };
  },
});
