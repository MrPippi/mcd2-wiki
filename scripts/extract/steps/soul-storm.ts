import { extractSoulStorm } from "../soul-storm";
import { defineStep, siblingOfOverrides } from "../step";
import { bestiaryStep } from "./bestiary";
import { localesStep } from "./locales";
import { mapStep } from "./map";
import { uiAssetsStep } from "./ui-assets";

export const soulStormStep = defineStep({
  name: "soul-storm",
  needs: { locales: localesStep, map: mapStep, bestiary: bestiaryStep, uiAssets: uiAssetsStep },
  writes: ["soul-storm.json"],
  async run({ options }, { locales, map, bestiary, uiAssets }) {
    const soulStorm = await extractSoulStorm({
      sourceRoot: options.sourceRoot,
      locales,
      map: map.data,
      links: bestiary.links,
      icons: uiAssets.soulStormIcons,
      statusPath: options.soulStormStatusPath ?? siblingOfOverrides(options, "soul-storm-status.json"),
    });
    return { value: undefined, issues: soulStorm.issues, files: { "soul-storm.json": soulStorm.data }, tablesRead: soulStorm.tablesRead };
  },
});
