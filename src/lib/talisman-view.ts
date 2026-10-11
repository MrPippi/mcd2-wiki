import type { Entry, Localized } from "../../scripts/extract/schemas";
import type { TalismanLevel } from "../../scripts/extract/gear-schema";
import { fillPlaceholders } from "./gear-values";
import type { Lang } from "./i18n";
import { mapLocalized } from "./lang";
import { talismanData } from "./talisman-data";
import { t } from "./ui-strings";
import { roundText, secondsText } from "./units";

export interface CompanionCells {
  readonly attack: string;
  readonly defence: string;
  readonly cooldown: string;
}

export interface TalismanLevelRow {
  /** The level number, 1–3. */
  readonly label: string;
  /** The description filled with this level's values, when the talisman shows an effect's description. */
  readonly text?: Localized;
  /** XP to reach the next level, or "Max Level" at the last one. */
  readonly xp: string;
  readonly companion?: CompanionCells;
}

const times = (value: number): string => `×${roundText(value)}`;

const companionCells = (level: TalismanLevel): CompanionCells | undefined =>
  level.companion
    ? { attack: times(level.companion.attack), defence: times(level.companion.defence), cooldown: times(level.companion.cooldown) }
    : undefined;

const filled = (entry: Entry, values: readonly string[] | undefined): Localized | undefined =>
  entry.description && values ? mapLocalized(entry.description, (html, lang) => fillPlaceholders(html, values, lang)) : undefined;

/** A talisman's levels for its level table; undefined for other entries or without level data. */
export function talismanLevelsView(lang: Lang, entry: Entry): TalismanLevelRow[] | undefined {
  const levels = entry.category === "talisman" ? talismanData[entry.slug]?.levels : undefined;
  if (!levels || levels.length === 0) return undefined;
  return levels.map((level, i) => {
    const text = filled(entry, level.values);
    const companion = companionCells(level);
    return {
      label: String(i + 1),
      xp: level.xpToNextLevel !== undefined ? roundText(level.xpToNextLevel) : t(lang, "maxLevel"),
      ...(text ? { text } : {}),
      ...(companion ? { companion } : {}),
    };
  });
}

/** A companion talisman's base cooldown with its unit; undefined for other talismans. */
export function companionCooldown(lang: Lang, entry: Entry): string | undefined {
  const seconds = entry.category === "talisman" ? talismanData[entry.slug]?.cooldownSeconds : undefined;
  return seconds === undefined ? undefined : secondsText(lang, seconds);
}

/** Whether the talisman is one of the game's secret talismans. */
export const isSecretTalisman = (entry: Entry): boolean => entry.category === "talisman" && talismanData[entry.slug]?.secret === true;
