/**
 * The game's update log: hand-written summaries of the official notes (src/game-updates.json, newest first) and the
 * data changes `npm run game-diff` recorded when the site moved to a new game version. Server-side only.
 */
import { z } from "zod";
import { GameChangesSchema, type DiffSource, type VersionChanges } from "../../shared/game-changes-schema";
import type { Lang } from "../../shared/lang";
import { htmlLang } from "../../shared/lang";
import rawChanges from "../data/game-changes.json";
import rawUpdates from "../game-updates.json";
import { GAME_VERSION } from "./game-version";
import type { UiKey } from "./ui-strings";

export const CHANGE_KINDS = ["new", "changed", "fixed"] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];

const ChangeSchema = z.object({
  kind: z.enum(CHANGE_KINDS),
  /** Path under the language of a site page the change is about, e.g. "quests/ca09". */
  link: z.string().regex(/^[a-z0-9-]+(\/[a-z0-9-]+)*$/).optional(),
  zh: z.string().min(1),
  en: z.string().min(1),
});
export type Change = z.infer<typeof ChangeSchema>;

const UpdateSchema = z.object({
  version: z.string().regex(/^[0-9][0-9A-Za-z._-]*$/),
  /** The build number, for a version the game shipped twice. */
  build: z.string().regex(/^[0-9]+$/).optional(),
  date: z.iso.date(),
  platforms: z.array(z.string().min(1)).min(1),
  /** The official notes or announcement. */
  source: z.url({ protocol: /^https$/ }),
  changes: z.array(ChangeSchema).min(1),
});
export type GameUpdate = z.infer<typeof UpdateSchema>;

/** Updates must be newest first, one per date, so the page needs no sorting. */
export const GameUpdatesSchema = z
  .array(UpdateSchema)
  .min(1)
  .refine((updates) => updates.every((update, i) => i === 0 || update.date < (updates[i - 1]?.date ?? "")), "updates must be newest first, one per date");

export const gameUpdates: readonly GameUpdate[] = GameUpdatesSchema.parse(rawUpdates);
const gameChanges: readonly VersionChanges[] = GameChangesSchema.parse(rawChanges);

export const CHANGE_KIND_KEY: Readonly<Record<ChangeKind, UiKey>> = { new: "changelogNew", changed: "changelogChanged", fixed: "changelogFixed" };
export const DIFF_STATUS_KEY = { added: "changelogNew", removed: "changelogRemoved", changed: "changelogChanged" } as const satisfies Record<string, UiKey>;
export const DIFF_SOURCE_KEY: Readonly<Record<DiffSource, UiKey>> = {
  items: "changelogSourceItems",
  weapons: "changelogSourceWeapons",
  enchantments: "categoryEnchantment",
  artifacts: "categoryArtifact",
  talismans: "categoryTalisman",
  mobs: "mobs",
  soulEnchantments: "soulEnchantments",
};

/** The anchor of an update on the page: its version, plus the build when the version shipped twice. */
export const updateAnchor = (update: GameUpdate): string => `v${update.version}${update.build ? `-${update.build}` : ""}`;

/**
 * Where the site's data stands against an update: "current" for the newest update of the version the site was
 * extracted from, "ahead" for any update after it, otherwise undefined.
 */
export function dataStatus(updates: readonly GameUpdate[], update: GameUpdate, version: string = GAME_VERSION): "current" | "ahead" | undefined {
  const current = updates.findIndex((one) => one.version === version);
  const index = updates.indexOf(update);
  if (current < 0 || index < 0) return undefined;
  if (index === current) return "current";
  return index < current ? "ahead" : undefined;
}

/** The recorded data changes into an update's version, if the site has them. */
export const dataChangesFor = (update: GameUpdate, changes: readonly VersionChanges[] = gameChanges): VersionChanges | undefined =>
  changes.find((one) => one.to === update.version && one.groups.length > 0);

/**
 * A change's text in `lang`. Only Traditional Chinese and English are written; every other language shows the
 * English text (the site's fallback for text without a checked translation), marked with its language.
 */
export const changeText = (change: Change, lang: Lang): { text: string; lang: Lang } =>
  lang === "zh" ? { text: change.zh, lang: "zh" } : { text: change.en, lang: "en" };

/** A date in `lang`'s long form; the date is a calendar day, so it is formatted in UTC. */
export const updateDate = (date: string, lang: Lang): string =>
  new Intl.DateTimeFormat(htmlLang(lang), { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
