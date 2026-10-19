import { BRAND_SOURCES, FRAME_SOURCES, UI_ICON_SOURCES } from "../../../shared/config";
import { SOUL_STORM_ICON_SOURCES } from "../soul-storm";
import { defineStep } from "../step";
import { planAssets } from "../ui-assets";

/** The fixed UI art (frames, category icons, brand, Soul Storm icons) published next to the entry icons. */
export const uiAssetsStep = defineStep({
  name: "ui-assets",
  needs: {},
  writes: ["frames.json", "category-icons.json", "brand.json"],
  run({ options }) {
    const frames = planAssets(options.sourceRoot, options.outRoot, FRAME_SOURCES, "frames", "missing-frame");
    const uiIcons = planAssets(options.sourceRoot, options.outRoot, UI_ICON_SOURCES, "ui", "missing-ui-icon");
    const brand = planAssets(options.sourceRoot, options.outRoot, BRAND_SOURCES, "brand", "missing-brand");
    const soulStormIcons = planAssets(options.sourceRoot, options.outRoot, SOUL_STORM_ICON_SOURCES, "soul-storm", "missing-ui-icon");
    return {
      value: { copies: [...frames.copies, ...uiIcons.copies, ...brand.copies, ...soulStormIcons.copies], soulStormIcons: soulStormIcons.paths },
      issues: [...frames.issues, ...uiIcons.issues, ...brand.issues, ...soulStormIcons.issues],
      files: { "frames.json": frames.paths, "category-icons.json": uiIcons.paths, "brand.json": brand.paths },
    };
  },
});
