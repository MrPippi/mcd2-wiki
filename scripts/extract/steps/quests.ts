import { extractQuests } from "../quests";
import { defineStep } from "../step";
import { bestiaryStep } from "./bestiary";
import { localesStep } from "./locales";
import { mapStep } from "./map";

export const questsStep = defineStep({
  name: "quests",
  needs: { locales: localesStep, map: mapStep, bestiary: bestiaryStep },
  writes: ["quests.json"],
  async run({ options }, { locales, map, bestiary }) {
    const quests = await extractQuests({
      sourceRoot: options.sourceRoot,
      locales,
      sources: bestiary.sources,
      links: bestiary.links,
      mobs: bestiary.mobs,
      map: map.data,
    });
    return { value: quests.data, issues: quests.issues, files: { "quests.json": quests.data }, tablesRead: quests.tablesRead };
  },
});
