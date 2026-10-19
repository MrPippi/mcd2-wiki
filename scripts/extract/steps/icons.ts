import path from "node:path";
import { copyIcons } from "../output";
import { defineStep } from "../step";
import { entriesStep } from "./entries";
import { mapStep } from "./map";
import { uiAssetsStep } from "./ui-assets";

/**
 * Publishes every icon into public/icons, which it clears first. A step that writes there too (achievements, mob portraits,
 * area icons) lists this step in `needs`, so it runs after the clearing.
 */
export const iconsStep = defineStep({
  name: "icons",
  needs: { entries: entriesStep, uiAssets: uiAssetsStep, map: mapStep },
  writes: [],
  async run({ options }, { entries, uiAssets, map }) {
    const mapIcons = map.icons.map((icon) => ({
      from: path.join(options.sourceRoot, ...icon.from.split("/")),
      to: path.join(options.outRoot, "public", ...icon.published.split("/")),
    }));
    await copyIcons([...entries.copies, ...uiAssets.copies, ...mapIcons], path.join(options.outRoot, "public", "icons"));
    return { value: undefined };
  },
});
