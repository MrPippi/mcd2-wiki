import path from "node:path";
import { extractBestiary } from "../bestiary";
import { defineStep } from "../step";
import { entriesStep } from "./entries";
import { iconsStep } from "./icons";
import { localesStep } from "./locales";
import { mapStep } from "./map";

/** Mobs and loot sources; the portraits are published under public/, so it runs after the icons. */
export const bestiaryStep = defineStep({
  name: "bestiary",
  needs: { locales: localesStep, entries: entriesStep, map: mapStep, icons: iconsStep },
  writes: ["mobs.json", "loot-sources.json"],
  async run({ options }, { locales, entries, map }) {
    const bestiary = await extractBestiary({
      sourceRoot: options.sourceRoot,
      outRoot: options.outRoot,
      locales,
      entries: entries.output.entries,
      map: map.data,
      overrideDir: options.mobPortraitOverrideDir ?? path.join(path.dirname(options.overridesPath), "mob-portrait-overrides"),
    });
    return {
      value: bestiary,
      issues: bestiary.issues,
      files: { "mobs.json": bestiary.mobs, "loot-sources.json": bestiary.sources },
      tablesRead: bestiary.tablesRead,
    };
  },
});
