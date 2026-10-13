/** Builds src/data/guides.json: the mechanics guides' numbers and the game's own texts, plus the hand-kept "unconfirmed" flags. */
import path from "node:path";
import { buildEnchantCosts, maxEnchantmentLevel } from "./guides-enchanting";
import { buildStages } from "./guides-progression";
import { buildDropWeights, buildRarityTiers } from "./guides-rarity";
import { GuidesDataSchema, GuidesStatusSchema, type GuidesData, type GuidesStatus } from "./guides-schema";
import { loadGuideTables, type GuideTables } from "./guides-tables";
import { buildSecretTalismans } from "./guides-talismans";
import { buildGuideTexts, type Locales } from "./guides-texts";
import { buildCaps, buildMerchant, buildVendors } from "./guides-vendors";
import { ExtractError, formatZodIssue, issue, type Issue } from "./issues";
import { readJsonFile } from "./read-json";
import type { Entry } from "./schemas";

export interface GuidesInput {
  readonly sourceRoot: string;
  readonly locales: Locales;
  readonly entries: readonly Entry[];
  readonly statusPath: string;
}

export interface GuidesResult {
  readonly data: GuidesData;
  readonly issues: Issue[];
  readonly tablesRead: readonly string[];
}

/** The hand-kept status file; a missing or malformed file stops the extract, naming the file. */
export async function readGuidesStatus(statusPath: string): Promise<GuidesStatus> {
  const name = path.basename(statusPath);
  const raw = await readJsonFile(statusPath, name);
  if (raw === undefined) throw new ExtractError(`找不到攻略狀態檔 ${name}：${statusPath}`);
  const parsed = GuidesStatusSchema.safeParse(raw);
  if (!parsed.success) throw new ExtractError(`攻略狀態檔 ${name} 格式不符：${parsed.error.issues.map(formatZodIssue).join("；")}`);
  return parsed.data;
}

function buildData(tables: GuideTables, input: GuidesInput, status: GuidesStatus): { data: GuidesData; issues: Issue[] } {
  const texts = buildGuideTexts(input.locales);
  const caps = buildCaps(tables);
  const vendors = buildVendors(tables);
  const merchant = buildMerchant(tables);
  const enchanting = buildEnchantCosts(tables);
  const tiers = buildRarityTiers(tables);
  const drops = buildDropWeights(tables);
  const secret = buildSecretTalismans({ tables, locales: input.locales, entries: input.entries });
  const stages = buildStages(tables, input.locales);
  const data = {
    verified: status,
    texts: texts.texts,
    caps: caps.caps,
    vendors: vendors.vendors,
    merchant: merchant.merchant,
    enchanting: { costs: enchanting.costs, maxLevel: maxEnchantmentLevel(tables) },
    rarity: { tiers: tiers.tiers, drops: drops.drops },
    secretTalismans: secret.secretTalismans,
    stages: stages.stages,
  };
  const issues = [texts, caps, vendors, merchant, enchanting, tiers, drops, secret, stages].flatMap((part) => part.issues);
  return { data: GuidesDataSchema.parse(data), issues };
}

export async function extractGuides(input: GuidesInput): Promise<GuidesResult> {
  const status = await readGuidesStatus(input.statusPath);
  const tablesRead: string[] = [];
  const loaded = await loadGuideTables(input.sourceRoot, (file) => {
    tablesRead.push(file);
  });
  const missing = loaded.missing.length > 0 ? [issue("missing-guides-tables", loaded.missing.join(", "))] : [];
  const built = buildData(loaded.tables, input, status);
  return { data: built.data, issues: [...missing, ...built.issues], tablesRead };
}
