/** Status page data from `npm run extract` and the pure helpers that turn a status into rows and links. Server-side only. */
import type { Category } from "../../shared/config";
import type { Mob } from "../../shared/mob-schema";
import type { Localized } from "../../shared/schemas";
import {
  STATUS_CHANCE_ATTRIBUTES,
  StatusDataSchema,
  type StatusAttribute,
  type StatusData,
  type StatusInfo,
  type StatusModifier,
  type StatusSource,
} from "../../shared/status-schema";
import rawData from "../data/statuses.json";
import { findEntry } from "./data";
import { categoryLabel, t, type Lang, type UiKey } from "./i18n";
import { findMob, formatChance, mobHref } from "./mobs";
import { roundText, secondsText } from "./units";
import { entryHref } from "./url";

/** Status data from `npm run extract`, validated at build time. */
export const statusData: StatusData = StatusDataSchema.parse(rawData);

const BY_SLUG = new Map(statusData.statuses.map((status) => [status.slug, status]));

export const findStatus = (slug: string): StatusInfo | undefined => BY_SLUG.get(slug);

const ATTRIBUTE_LABEL: Readonly<Record<StatusAttribute, UiKey>> = {
  movementSpeed: "statMovementSpeed",
  meleeAttackSpeed: "statMeleeAttackSpeed",
  rangedAttackSpeed: "statRangedAttackSpeed",
  damage: "statusAttrDamage",
  damageBonus: "statusAttrDamageBonus",
  damageTaken: "statusAttrDamageTaken",
  critChance: "statusAttrCritChance",
  critMultiplier: "statusAttrCritMultiplier",
  deflectChance: "soulAttrDeflectChance",
  artifactCooldown: "statusAttrArtifactCooldown",
  artifactDamage: "statusAttrArtifactDamage",
  soulGathering: "statusAttrSoulGathering",
};

const ALIGNMENT_LABEL: Readonly<Record<NonNullable<StatusInfo["alignment"]>, UiKey>> = {
  positive: "statusPositive",
  negative: "statusNegative",
  neutral: "statusNeutral",
};

const MINUS = "−";

/** One modifier as the page prints it: ×0.7, +0.5, −0.5, or +100% for a chance. */
export function formatStatusModifier(modifier: StatusModifier, lang: Lang): string {
  if (modifier.op === "multiply") return `×${roundText(modifier.value)}`;
  const magnitude = Math.abs(modifier.value);
  const text = STATUS_CHANCE_ATTRIBUTES.includes(modifier.attribute) ? formatChance(magnitude, lang) : roundText(magnitude);
  return modifier.value < 0 ? `${MINUS}${text}` : `+${text}`;
}

export interface StatusRow {
  /** Stable id for tests. */
  readonly id: string;
  readonly label: string;
  readonly value: string;
}

/** The facts row block: type, default duration, stacking, then each modifier. */
export function statusRows(status: StatusInfo, lang: Lang): StatusRow[] {
  return [
    ...(status.alignment ? [{ id: "alignment", label: t(lang, "statusAlignment"), value: t(lang, ALIGNMENT_LABEL[status.alignment]) }] : []),
    {
      id: "duration",
      label: t(lang, "statusDuration"),
      value: status.duration === null ? t(lang, "statusDurationInfinite") : secondsText(lang, status.duration),
    },
    ...(status.nonStacking ? [{ id: "stacking", label: t(lang, "statusStacking"), value: t(lang, "statusNonStacking") }] : []),
    ...status.modifiers.map((modifier) => ({
      id: `attr:${modifier.attribute}:${modifier.op}`,
      label: t(lang, ATTRIBUTE_LABEL[modifier.attribute]),
      value: formatStatusModifier(modifier, lang),
    })),
  ];
}

export interface StatusLink {
  readonly kind: StatusSource["kind"] | "status";
  readonly label: string;
  readonly href: string;
  readonly name: Localized;
  readonly icon?: string;
  readonly category?: Category;
  readonly variant?: "normal" | "unique";
  /** A mob source, drawn with its portrait. */
  readonly mob?: Mob;
}

/** A source or fused status as a link with its icon; undefined when its page is gone. */
export function statusLink(lang: Lang, kind: StatusLink["kind"], slug: string): StatusLink | undefined {
  if (kind === "mob") {
    const mob = findMob(slug);
    return mob ? { kind, label: t(lang, "mobs"), href: mobHref(lang, mob.slug), name: mob.name, mob } : undefined;
  }
  const category: Category = kind;
  const entry = findEntry(category, slug);
  return entry
    ? {
        kind,
        label: categoryLabel(category, lang),
        href: entryHref(lang, entry),
        name: entry.name,
        ...(entry.icon ? { icon: entry.icon } : {}),
        category,
        variant: entry.variant,
      }
    : undefined;
}

export const statusSourceLinks = (lang: Lang, status: StatusInfo): StatusLink[] =>
  status.sources.flatMap((source) => statusLink(lang, source.kind, source.slug) ?? []);
