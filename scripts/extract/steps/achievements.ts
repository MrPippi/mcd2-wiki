import { extractAchievements } from "../achievements";
import { defineStep } from "../step";
import { iconsStep } from "./icons";
import { localesStep } from "./locales";

/** Writes its icons into public/icons, so it needs the icons step. */
export const achievementsStep = defineStep({
  name: "achievements",
  needs: { locales: localesStep, icons: iconsStep },
  writes: ["achievements.json"],
  async run({ options }, { locales }) {
    const achievements = await extractAchievements(options.sourceRoot, options.outRoot, locales);
    return { value: undefined, issues: achievements.issues, files: { "achievements.json": achievements.data } };
  },
});
