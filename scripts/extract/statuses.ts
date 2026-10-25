/**
 * Status page data: per status entry, DT_StatusDefinition's alignment, stacking, default duration and attribute
 * modifiers, the fusions DT_StatusFusionDefinition defines, and the artifacts, enchantments, effects and mobs whose
 * rows name the status.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Entry } from "../../shared/schemas";
import {
  StatusDataSchema,
  type StatusAttribute,
  type StatusData,
  type StatusFusion,
  type StatusInfo,
  type StatusModifier,
  type StatusSource,
  type StatusSourceKind,
} from "../../shared/status-schema";
import { DATATABLES_DIR } from "./game-tables";
import { entryIndex, locId } from "./game-rows";
import { ExtractError, formatZodIssue, issue, type Issue } from "./issues";
import { tagKey } from "./mob-tags";
import { readDataTable } from "./table-reader";

export const STATUS_TABLE_FILES = {
  statuses: "DT_StatusDefinition",
  fusions: "DT_StatusFusionDefinition",
} as const;

/** The tables whose rows can name a status, and the page kind each links to. */
export const SOURCE_TABLES: Readonly<Record<string, StatusSourceKind>> = {
  DT_ItemDefinitionArtifact: "artifact",
  DT_EnchantmentDefinition: "enchantment",
  DT_EffectDefinition: "effect",
  DT_EffectTemplateDefinition: "effect",
  DT_MobType1Definition: "mob",
  DT_MobType2Definition: "mob",
  DT_MobType3Definition: "mob",
};

const STATUS_PREFIX = "SW.Status.";
// A status's own loc key: SW_Status_<entry id>_SW_TextEntry_Name.
const STATUS_LOC_ID = /"SW_Status_(.+?)_SW_TextEntry_(?:Name|Description)"/i;
// Tag lists that are not the status itself: the parents of a tag, and statuses a mob's perception ignores.
const SKIPPED_KEYS: ReadonlySet<string> = new Set(["ParentTags", "IgnoreActorsWithTags"]);

/** Game attribute names → site keys. A modifier on any other attribute (Health, Souls: per-tick damage) is reported and left out. */
export const STATUS_ATTRIBUTE_KEYS: Readonly<Record<string, StatusAttribute>> = {
  MovementSpeedMultiplier: "movementSpeed",
  MeleeAttackSpeed: "meleeAttackSpeed",
  RangedAttackSpeed: "rangedAttackSpeed",
  BaseDamageMultiplier: "damage",
  BaseDamageBonus: "damageBonus",
  BaseDamageResistanceMultiplier: "damageTaken",
  CriticalHitChance: "critChance",
  CriticalHitMultiplier: "critMultiplier",
  ProjectileDeflectChance: "deflectChance",
  ArtifactCooldownMultiplier: "artifactCooldown",
  ArtifactDamageMultiplier: "artifactDamage",
  SoulGathering: "soulGathering",
};

// MultiplyAdditive and MultiplyCompound only differ in how several multipliers on one attribute stack; one modifier is ×value either way.
const OPS: Readonly<Record<string, StatusModifier["op"]>> = { MultiplyAdditive: "multiply", MultiplyCompound: "multiply", AddBase: "add" };

const ALIGNMENTS = { "SW.Status.Alignment.Positive": "positive", "SW.Status.Alignment.Negative": "negative", "SW.Status.Alignment.Neutral": "neutral" } as const;
const NON_STACKING = "SW.Status.NonStacking";

const Tag = z.looseObject({ TagName: z.string() });
const TagList = z.looseObject({ GameplayTags: z.array(Tag).optional() });
const TextData = z.looseObject({ Texts: z.record(z.string(), z.looseObject({ Text: z.string() })) }).optional();
const Modifier = z.looseObject({
  Attribute: z.looseObject({ AttributeName: z.string() }),
  ModifierOp: z.string(),
  ModifierMagnitude: z.looseObject({
    MagnitudeCalculationType: z.string(),
    ScalableFloatMagnitude: z.looseObject({ Value: z.number() }).optional(),
  }),
});

export const StatusRowSchema = z.looseObject({
  Name: z.string(),
  TypeTag: Tag,
  TypeTextData: TextData,
  Traits: TagList.optional(),
  StatusData: z.looseObject({ DefaultDuration: z.number() }),
  GameplayEffect: z.looseObject({ Modifiers: z.array(Modifier).optional() }),
});
export type StatusRow = z.infer<typeof StatusRowSchema>;

export const FusionRowSchema = z.looseObject({
  Name: z.string(),
  TypeTag: Tag,
  FusionDefinitions: z.looseObject({
    PossibleFusions: z.array(TagList),
    bIsNegativeFusion: z.boolean(),
    StatusImmunityDuration: z.number(),
  }),
});
export type FusionRow = z.infer<typeof FusionRowSchema>;

/** A row of a source table: its name, texts and type tag, plus everything else to scan for status tags. */
export interface SourceRow {
  readonly table: string;
  readonly row: { readonly Name: string; readonly TypeTag?: { TagName: string }; readonly TypeTextData?: z.infer<typeof TextData> } & Record<string, unknown>;
}

export interface StatusTables {
  readonly statuses: readonly StatusRow[];
  readonly fusions: readonly FusionRow[];
  readonly sources: readonly SourceRow[];
}

export interface StatusInput {
  readonly entries: readonly Entry[];
  /** Mob tag key → bestiary slug. */
  readonly mobSlugs: ReadonlyMap<string, string>;
}

const statusLocId = (texts: StatusRow["TypeTextData"]): string | undefined =>
  Object.values(texts?.Texts ?? {})
    .map((entry) => STATUS_LOC_ID.exec(entry.Text)?.[1])
    .find((id) => id !== undefined);

/** Every SW.Status.* tag a row names, outside parent-tag lists and perception filters. */
export function statusTagsIn(value: unknown): string[] {
  if (typeof value === "string") return value.startsWith(STATUS_PREFIX) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(statusTagsIn);
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => (SKIPPED_KEYS.has(key) ? [] : statusTagsIn(child)));
}

/** The modifiers the page can show; the rest are reported. */
function modifiersOf(row: StatusRow, issues: Issue[]): StatusModifier[] {
  return (row.GameplayEffect.Modifiers ?? []).flatMap((modifier) => {
    const name = modifier.Attribute.AttributeName;
    const attribute = STATUS_ATTRIBUTE_KEYS[name];
    const op = OPS[modifier.ModifierOp];
    const value = modifier.ModifierMagnitude.ScalableFloatMagnitude?.Value;
    if (modifier.ModifierMagnitude.MagnitudeCalculationType !== "ScalableFloat" || value === undefined || op === undefined || attribute === undefined) {
      issues.push(issue("status-ignored", `${row.Name}: ${name} ${modifier.ModifierOp} ${modifier.ModifierMagnitude.MagnitudeCalculationType}`));
      return [];
    }
    return [{ attribute, op, value }];
  });
}

/** Maps a status tag to the status entry slug it belongs to, walking up the tag (SW.Status.Slowed.Slime → Slowed). */
function statusResolver(rows: readonly StatusRow[], entries: readonly Entry[]) {
  const find = entryIndex(entries);
  const slugByTag = new Map(
    rows.flatMap((row) => {
      const entry = find("status", statusLocId(row.TypeTextData));
      return entry ? [[row.TypeTag.TagName, entry.slug] as const] : [];
    }),
  );
  return (tag: string): string | undefined => {
    for (let current = tag; current.startsWith(STATUS_PREFIX); current = current.slice(0, current.lastIndexOf("."))) {
      const slug = slugByTag.get(current);
      if (slug) return slug;
    }
    return undefined;
  };
}

const EFFECT_PREFIX = "SW.Effect.";
const TemplateRef = z.looseObject({ TemplateData: z.looseObject({ Effect: Tag }) });

/** An effect template's effect id (SW.Effect.StatusOnHit.Strength → StatusOnHit_Strength); undefined for other rows. */
const templateEffectId = (row: SourceRow["row"]): string | undefined => {
  const parsed = TemplateRef.safeParse(row);
  const tag = parsed.success ? parsed.data.TemplateData.Effect.TagName : undefined;
  return tag?.startsWith(EFFECT_PREFIX) ? tag.slice(EFFECT_PREFIX.length).replace(/\./g, "_") : undefined;
};

/** The page a source row links to: an entry by its template's effect, loc id or row name (Unique rows fall back to the plain one), or a bestiary mob. */
function sourceLinker(input: StatusInput) {
  const find = entryIndex(input.entries);
  return ({ table, row }: SourceRow): StatusSource | undefined => {
    const kind = SOURCE_TABLES[table];
    if (kind === "mob") {
      const slug = row.TypeTag ? input.mobSlugs.get(tagKey(row.TypeTag.TagName)) : undefined;
      return slug ? { kind, slug } : undefined;
    }
    const id = templateEffectId(row) ?? locId(row.TypeTextData) ?? row.Name.replace(/\./g, "_");
    const entry = find(kind, id) ?? find(kind, id.replace(/_Unique$/i, ""));
    return entry ? { kind, slug: entry.slug } : undefined;
  };
}

function fusionsBySlug(fusions: readonly FusionRow[], resolve: (tag: string) => string | undefined, issues: Issue[]): Map<string, StatusFusion[]> {
  const bySlug = new Map<string, StatusFusion[]>();
  for (const row of fusions) {
    const { PossibleFusions, bIsNegativeFusion, StatusImmunityDuration } = row.FusionDefinitions;
    for (const pair of PossibleFusions) {
      const slugs = (pair.GameplayTags ?? []).map((tag) => resolve(tag.TagName));
      if (slugs.length !== 2 || slugs.some((slug) => slug === undefined)) {
        issues.push(issue("status-ignored", `${row.Name}: fusion of ${(pair.GameplayTags ?? []).map((tag) => tag.TagName).join(" + ")}`));
        continue;
      }
      const [a, b] = slugs as [string, string];
      const base = { result: row.Name, negative: bIsNegativeFusion, immunity: StatusImmunityDuration };
      bySlug.set(a, [...(bySlug.get(a) ?? []), { with: b, ...base }]);
      bySlug.set(b, [...(bySlug.get(b) ?? []), { with: a, ...base }]);
    }
  }
  return bySlug;
}

function sourcesBySlug(tables: StatusTables, input: StatusInput, resolve: (tag: string) => string | undefined, issues: Issue[]): Map<string, StatusSource[]> {
  const link = sourceLinker(input);
  const bySlug = new Map<string, Map<string, StatusSource>>();
  for (const source of tables.sources) {
    const slugs = new Set(statusTagsIn(source.row).flatMap((tag) => resolve(tag) ?? []));
    if (slugs.size === 0) continue;
    const target = link(source);
    if (!target) {
      issues.push(issue("status-source-unlinked", `${source.table}: ${source.row.Name}`));
      continue;
    }
    for (const slug of slugs) {
      const found = bySlug.get(slug) ?? new Map<string, StatusSource>();
      bySlug.set(slug, found.set(`${target.kind}:${target.slug}`, target));
    }
  }
  return new Map([...bySlug].map(([slug, found]) => [slug, [...found.values()]]));
}

const alignmentOf = (row: StatusRow): StatusInfo["alignment"] =>
  (row.Traits?.GameplayTags ?? []).map((tag) => ALIGNMENTS[tag.TagName as keyof typeof ALIGNMENTS]).find((value) => value !== undefined);

export function buildStatusData(tables: StatusTables, input: StatusInput): { data: StatusData; issues: Issue[] } {
  const issues: Issue[] = [];
  const find = entryIndex(input.entries);
  const resolve = statusResolver(tables.statuses, input.entries);
  const fusions = fusionsBySlug(tables.fusions, resolve, issues);
  const sources = sourcesBySlug(tables, input, resolve, issues);
  const statuses = tables.statuses.flatMap((row): StatusInfo[] => {
    const entry = find("status", statusLocId(row.TypeTextData));
    if (!entry) return [];
    const alignment = alignmentOf(row);
    return [{
      slug: entry.slug,
      ...(alignment ? { alignment } : {}),
      nonStacking: (row.Traits?.GameplayTags ?? []).some((tag) => tag.TagName === NON_STACKING),
      duration: row.StatusData.DefaultDuration < 0 ? null : row.StatusData.DefaultDuration,
      modifiers: modifiersOf(row, issues),
      fusions: fusions.get(entry.slug) ?? [],
      sources: sources.get(entry.slug) ?? [],
    }];
  });
  return { data: { statuses: [...statuses].sort((a, b) => a.slug.localeCompare(b.slug)) }, issues };
}

const parseRows = <T>(schema: z.ZodType<T>, rows: unknown[], label: string): T[] => {
  const parsed = z.array(schema).safeParse(rows);
  if (!parsed.success) throw new ExtractError(`資料表 ${label} 不符合預期：${formatZodIssue(parsed.error.issues[0])}`);
  return parsed.data;
};

const SourceRowSchema = z.looseObject({ Name: z.string(), TypeTag: Tag.optional(), TypeTextData: TextData });

/** Reads the status, fusion and source tables; undefined when source-data has no DataTables folder or no status table. */
export async function loadStatusTables(sourceRoot: string, onRead: (file: string) => void): Promise<StatusTables | undefined> {
  const dir = path.join(sourceRoot, ...DATATABLES_DIR.split("/"));
  if (!existsSync(path.join(dir, `${STATUS_TABLE_FILES.statuses}.json`))) return undefined;
  const statuses = parseRows(StatusRowSchema, await readDataTable(dir, STATUS_TABLE_FILES.statuses, { onRead }), STATUS_TABLE_FILES.statuses);
  const fusions = parseRows(FusionRowSchema, await readDataTable(dir, STATUS_TABLE_FILES.fusions, { onRead, optional: true }), STATUS_TABLE_FILES.fusions);
  const sources = await Promise.all(
    Object.keys(SOURCE_TABLES).map(async (table) =>
      parseRows(SourceRowSchema, await readDataTable(dir, table, { onRead, optional: true, dropBase: true }), table).map((row) => ({ table, row: row as SourceRow["row"] })),
    ),
  );
  return { statuses, fusions, sources: sources.flat() };
}

export function validateStatusData(data: StatusData): StatusData {
  const parsed = StatusDataSchema.safeParse(data);
  if (!parsed.success) throw new ExtractError(`狀態資料 statuses.json 不符合格式：${formatZodIssue(parsed.error.issues[0])}`);
  return parsed.data;
}
