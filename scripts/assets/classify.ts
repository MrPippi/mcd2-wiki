import { FALLBACK_GROUP, type AssetRules } from "./rules";

export const KINDS = {
  icon: "圖示",
  texture: "貼圖",
  map: "材質圖（法線／遮罩）",
  hdr: "HDR",
} as const;
export type Kind = keyof typeof KINDS;

export interface Placement {
  /** 分類: a key of the rules' groups. */
  readonly group: string;
  /** 分項: a fixed label, or the first folder under the rule's prefix. */
  readonly sub: string;
  /** 細項: the folder below the sub-item, or "" when the file sits directly in it. */
  readonly detail: string;
  /** False when no rule matched and the file fell back to the "other" group. */
  readonly matched: boolean;
}

const ROOT_SUB = "（根目錄）";
const toSlashes = (filePath: string): string => filePath.split("\\").join("/");

/** Where a raw asset belongs: group (分類), sub-item (分項) and detail (細項), from its path under source-data. */
export function classifyAsset(filePath: string, assetRules: AssetRules): Placement {
  const normalized = toSlashes(filePath);
  const rule = assetRules.rules.find((candidate) => normalized.startsWith(`${candidate.prefix}/`));
  if (!rule) {
    const folders = normalized.split("/").slice(1, -1);
    return { group: FALLBACK_GROUP, sub: folders[0] ?? ROOT_SUB, detail: folders[1] ?? "", matched: false };
  }
  // Folders between the prefix and the file name.
  const folders = normalized.slice(rule.prefix.length + 1).split("/").slice(0, -1);
  if (rule.sub !== undefined) return { group: rule.group, sub: rule.sub, detail: folders[0] ?? "", matched: true };
  const folder = folders[0];
  if (folder === undefined) return { group: rule.group, sub: ROOT_SUB, detail: "", matched: true };
  return { group: rule.group, sub: rule.names?.[folder] ?? folder, detail: folders[1] ?? "", matched: true };
}

const MATERIAL_MAP = /_(?:N|Normal|MRES|ORM|M|R|E|Mask|Emissive|Roughness|AO|H|Height|Opacity|Flow)\d*\.[a-z0-9]+$/i;

/** What the file is for, judged from its name. */
export function assetKind(fileName: string): Kind {
  if (/\.(?:hdr|exr)$/i.test(fileName)) return "hdr";
  if (/(?:^|\/)T_UI_/i.test(fileName) || /_Icon\.[a-z0-9]+$/i.test(fileName)) return "icon";
  if (MATERIAL_MAP.test(fileName)) return "map";
  return "texture";
}

/** Browsers cannot draw these, so the gallery shows a label instead of a thumbnail. */
export const isPreviewable = (fileName: string): boolean => /\.(?:png|jpe?g|webp|gif|avif)$/i.test(fileName);
