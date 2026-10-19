import { extractLocations } from "../locations";
import { defineStep } from "../step";
import { bestiaryStep } from "./bestiary";
import { iconsStep } from "./icons";
import { localesStep } from "./locales";
import { mapStep } from "./map";
import { questsStep } from "./quests";

/** Areas and bosses; it publishes the area icons, so it runs after the icons. */
export const locationsStep = defineStep({
  name: "locations",
  needs: { locales: localesStep, map: mapStep, bestiary: bestiaryStep, quests: questsStep, icons: iconsStep },
  writes: ["locations.json"],
  async run({ options }, { locales, map, bestiary, quests }) {
    const locations = await extractLocations({
      sourceRoot: options.sourceRoot,
      outRoot: options.outRoot,
      locales,
      map: map.data,
      mobs: bestiary.mobs,
      quests,
      sources: bestiary.sources,
    });
    return { value: undefined, issues: locations.issues, files: { "locations.json": locations.data }, tablesRead: locations.tablesRead };
  },
});
