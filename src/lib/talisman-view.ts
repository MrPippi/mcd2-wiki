import type { Entry } from "../../shared/schemas";
import type { TalismanLevel } from "../../shared/gear-schema";
import type { Lang } from "./i18n";
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
  /** This level's description values, e.g. "20%", when the game data has them. */
  readonly value?: string;
  /** XP to reach the next level, or "Max Level" at the last one. */
  readonly xp: string;
  readonly companion?: CompanionCells;
}

const times = (value: number): string => `×${roundText(value)}`;

const companionCells = (level: TalismanLevel): CompanionCells | undefined =>
  level.companion
    ? { attack: times(level.companion.attack), defence: times(level.companion.defence), cooldown: times(level.companion.cooldown) }
    : undefined;

/** A talisman's levels for its level table; undefined for other entries or without level data. */
export function talismanLevelsView(lang: Lang, entry: Entry): TalismanLevelRow[] | undefined {
  const levels = entry.category === "talisman" ? talismanData[entry.slug]?.levels : undefined;
  if (!levels || levels.length === 0) return undefined;
  return levels.map((level, i) => {
    const companion = companionCells(level);
    return {
      label: String(i + 1),
      xp: level.xpToNextLevel !== undefined ? roundText(level.xpToNextLevel) : t(lang, "maxLevel"),
      ...(level.values ? { value: level.values.join(" / ") } : {}),
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

/** Whether the talisman's description shows values the game data does not have (as "?"). */
export const hasUnknownValues = (entry: Entry): boolean => entry.category === "talisman" && talismanData[entry.slug]?.valuesUnknown === true;
