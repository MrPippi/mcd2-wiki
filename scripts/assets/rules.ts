import { readFileSync } from "node:fs";
import { z } from "zod";

/** Every unmatched file lands in this group, so it must always exist. */
export const FALLBACK_GROUP = "other";

const RuleSchema = z
  .object({
    /** Folder under source-data, forward slashes, no trailing slash. */
    prefix: z.string().regex(/^Assets(?:\/[^/]+)*$/, "prefix 必須以 Assets 開頭、用 / 分隔、結尾不加 /"),
    group: z.string().min(1),
    /** Fixed sub-item label; leave it out to use the next folder name as the sub-item. */
    sub: z.string().min(1).optional(),
    /** Display names for folder names when the next folder is the sub-item. */
    names: z.record(z.string(), z.string()).optional(),
  })
  .strict();

const RulesSchema = z
  .object({
    extensions: z.array(z.string().regex(/^[a-z0-9]+$/, "副檔名用小寫、不含點")).min(1),
    /** Group key → display label; key order is display order. */
    groups: z.record(z.string(), z.string().min(1)),
    rules: z.array(RuleSchema),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!(FALLBACK_GROUP in value.groups)) {
      ctx.addIssue({ code: "custom", path: ["groups"], message: `groups 必須包含 "${FALLBACK_GROUP}"` });
    }
    value.rules.forEach((rule, index) => {
      if (!(rule.group in value.groups)) {
        ctx.addIssue({ code: "custom", path: ["rules", index, "group"], message: `未定義的分類 "${rule.group}"` });
      }
    });
    const prefixes = value.rules.map((rule) => rule.prefix);
    const duplicate = prefixes.find((prefix, index) => prefixes.indexOf(prefix) !== index);
    if (duplicate) ctx.addIssue({ code: "custom", path: ["rules"], message: `重複的 prefix "${duplicate}"` });
  });

export type AssetRule = z.infer<typeof RuleSchema>;

export interface AssetRules {
  readonly extensions: readonly string[];
  readonly groups: Readonly<Record<string, string>>;
  /** Longest prefix first, so the most specific rule wins regardless of order in the file. */
  readonly rules: readonly AssetRule[];
}

/** Validates rules data; rules may be listed in any order. */
export function parseRules(json: unknown): AssetRules {
  const parsed = RulesSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(`素材分類規則格式錯誤：${first.path.join(".") || "(根)"} ${first.message}`);
  }
  const rules = [...parsed.data.rules].sort((a, b) => b.prefix.length - a.prefix.length);
  return { ...parsed.data, rules };
}

export function loadRules(filePath: string): AssetRules {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`無法讀取素材分類規則 ${filePath}：${(error as Error).message}`);
  }
  return parseRules(json);
}

export const groupOrder = (rules: AssetRules): string[] => Object.keys(rules.groups);
