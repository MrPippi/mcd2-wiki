import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export const USAGES = {
  published: "網站已發布",
  "site-ui": "網站介面",
  unpublished: "已抽取未發布",
  unused: "未使用",
} as const;
export type Usage = keyof typeof USAGES;

/** Extracted icons shown next to a published category rather than as one: enchantment books on enchantment pages. */
const SHOWN_WITH: Readonly<Record<string, string>> = { enchantment: "enchantment-book" };
const UI_DIRS: ReadonlySet<string> = new Set(["ui", "frames", "brand"]);

/** Icon folders the site shows, derived from its category tabs so a newly published category counts at once. */
export function publishedIconDirs(tabs: readonly string[]): ReadonlySet<string> {
  return new Set(tabs.flatMap((tab) => (SHOWN_WITH[tab] ? [tab, SHOWN_WITH[tab]] : [tab])));
}

const usageOfPath = (publishedPath: string, publishedDirs: ReadonlySet<string>): Usage => {
  const dir = publishedPath.split("/")[1] ?? "";
  if (publishedDirs.has(dir)) return "published";
  if (UI_DIRS.has(dir)) return "site-ui";
  return "unpublished";
};

const RANK: readonly Usage[] = ["published", "site-ui", "unpublished"];

/** The strongest use among the site files that are byte-identical to a raw asset. */
export function usageOf(publishedPaths: readonly string[], publishedDirs: ReadonlySet<string>): Usage {
  const uses = new Set(publishedPaths.map((publishedPath) => usageOfPath(publishedPath, publishedDirs)));
  return RANK.find((usage) => uses.has(usage)) ?? "unused";
}

export const hashFile = async (filePath: string): Promise<string> =>
  createHash("sha1").update(await readFile(filePath)).digest("hex");

/** Every file under `root`, as forward-slash paths relative to `root`. */
export async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"))
    .sort();
}

/** Content hash → published paths (relative to public/, e.g. icons/melee/axe.png) of the site's icons. */
export async function indexPublishedIcons(publicDir: string): Promise<Map<string, string[]>> {
  const iconsDir = path.join(publicDir, "icons");
  const files = await listFiles(iconsDir);
  const hashed = await Promise.all(
    files.map(async (file) => ({ hash: await hashFile(path.join(iconsDir, file)), published: `icons/${file}` })),
  );
  const groups = Map.groupBy(hashed, ({ hash }) => hash);
  return new Map([...groups].map(([hash, items]) => [hash, items.map(({ published }) => published)]));
}
