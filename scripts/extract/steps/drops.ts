import { DropDataSchema } from "../../../shared/drop-schema";
import { extractDrops } from "../drops";
import { defineStep } from "../step";
import { bestiaryStep } from "./bestiary";
import { entriesStep } from "./entries";
import { guidesStep } from "./guides";
import { questsStep } from "./quests";

export const dropsStep = defineStep({
  name: "drops",
  needs: { entries: entriesStep, guides: guidesStep, bestiary: bestiaryStep, quests: questsStep },
  writes: ["drop-models.json"],
  async run({ options }, { entries, guides, bestiary, quests }) {
    const drops = await extractDrops({
      sourceRoot: options.sourceRoot,
      entries: entries.output.entries,
      threat: guides.threat,
      sources: bestiary.sources,
      quests,
      mobs: bestiary.mobs,
      tagIndex: bestiary.links.tagIndex,
    });
    return { value: undefined, issues: drops.issues, files: { "drop-models.json": DropDataSchema.parse(drops.data) }, tablesRead: drops.tablesRead };
  },
});
