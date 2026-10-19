import { achievementsStep } from "./achievements";
import { affixStep } from "./affix";
import { bestiaryStep } from "./bestiary";
import { describedStep } from "./described";
import { dropsStep } from "./drops";
import { entriesStep } from "./entries";
import { armorEffectsStep, artifactsStep, effectsStep, enchantmentsStep, gameTablesStep, weaponsStep } from "./gear";
import { guidesStep } from "./guides";
import { iconsStep } from "./icons";
import { localesStep } from "./locales";
import { locationsStep } from "./locations";
import { mapStep } from "./map";
import { questMarkersStep } from "./quest-markers";
import { questsStep } from "./quests";
import { soulStormStep } from "./soul-storm";
import { splashStep } from "./splash";
import { spotMarkersStep } from "./spot-markers";
import { talismansStep } from "./talismans";
import { uiAssetsStep } from "./ui-assets";
import { uiStringsStep } from "./ui-strings";
import type { AnyStep } from "../step";

/**
 * Every extraction step. The order of this list is the order of the issues in extract-report.md; a step runs after
 * the steps in its `needs` wherever they sit (the runner works that out and rejects a missing step or a loop).
 * A new data page is one step file plus a line here.
 */
export const EXTRACT_STEPS: readonly AnyStep[] = [
  localesStep,
  entriesStep,
  uiAssetsStep,
  splashStep,
  gameTablesStep,
  weaponsStep,
  artifactsStep,
  armorEffectsStep,
  affixStep,
  enchantmentsStep,
  effectsStep,
  talismansStep,
  describedStep,
  mapStep,
  questMarkersStep,
  spotMarkersStep,
  uiStringsStep,
  iconsStep,
  achievementsStep,
  bestiaryStep,
  soulStormStep,
  guidesStep,
  questsStep,
  locationsStep,
  dropsStep,
];
