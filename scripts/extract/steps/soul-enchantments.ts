import { readGuidesStatus } from "../guides";
import { extractSoulEnchantments } from "../soul-enchantments";
import { defineStep, siblingOfOverrides } from "../step";
import { bestiaryStep } from "./bestiary";
import { iconsStep } from "./icons";
import { localesStep } from "./locales";
import { questsStep } from "./quests";

/** Soul enchantments; it publishes the family icons, so it runs after the icons. Its "unconfirmed" flag lives in guides-status.json. */
export const soulEnchantmentsStep = defineStep({
  name: "soul-enchantments",
  needs: { locales: localesStep, bestiary: bestiaryStep, quests: questsStep, icons: iconsStep },
  writes: ["soul-enchantments.json"],
  async run({ options }, { locales, bestiary, quests }) {
    const status = await readGuidesStatus(options.guidesStatusPath ?? siblingOfOverrides(options, "guides-status.json"));
    const result = await extractSoulEnchantments({
      sourceRoot: options.sourceRoot,
      outRoot: options.outRoot,
      locales,
      mobSlugs: bestiary.links.tagIndex,
      quests,
      verified: status.soulEnchantmentLevels,
    });
    return { value: undefined, issues: result.issues, files: { "soul-enchantments.json": result.data }, tablesRead: result.tablesRead };
  },
});
