import { existsSync } from "node:fs";
import { stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TAB_ORDER } from "../../shared/tabs";
import { assetKind, classifyAsset } from "./classify";
import { renderGallery } from "./gallery";
import { sortRecords, type AssetRecord } from "./record";
import { renderAssetReport } from "./report";
import { groupOrder, loadRules, type AssetRules } from "./rules";
import { CHANGES, diffSnapshot, readSnapshot, writeSnapshot, type Change } from "./snapshot";
import { USAGES, hashFile, indexPublishedIcons, listFiles, publishedIconDirs, usageOf, type Usage } from "./usage";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const RULES_PATH = path.join(projectRoot, "scripts", "assets", "rules.json");
const SNAPSHOT_PATH = path.join(projectRoot, "scripts", "assets", "snapshot.json");
// Hash in batches so thousands of files never hold thousands of handles open at once.
const BATCH = 64;

interface Options {
  readonly sourceRoot: string;
  /** Compare with the saved snapshot but leave it as is (to re-read a diff without losing it). */
  readonly keepSnapshot: boolean;
}

function parseArgs(argv: readonly string[]): Options {
  const positional = argv.filter((arg) => !arg.startsWith("--"));
  const unknown = argv.filter((arg) => arg.startsWith("--") && arg !== "--keep-snapshot");
  if (unknown.length > 0) throw new Error(`未知的參數：${unknown.join(" ")}（可用：--keep-snapshot）`);
  return {
    sourceRoot: path.resolve(positional[0] ?? path.join(projectRoot, "source-data")),
    keepSnapshot: argv.includes("--keep-snapshot"),
  };
}

async function inBatches<T, R>(items: readonly T[], work: (item: T) => Promise<R>): Promise<R[]> {
  const batches = Array.from({ length: Math.ceil(items.length / BATCH) }, (_, i) => items.slice(i * BATCH, (i + 1) * BATCH));
  const results: R[][] = [];
  for (const batch of batches) results.push(await Promise.all(batch.map(work)));
  return results.flat();
}

interface Scanned {
  readonly path: string;
  readonly hash: string;
  readonly bytes: number;
}

async function scan(sourceRoot: string, rules: AssetRules): Promise<Scanned[]> {
  const extension = new RegExp(`\\.(?:${rules.extensions.join("|")})$`, "i");
  const files = (await listFiles(path.join(sourceRoot, "Assets"))).filter((file) => extension.test(file));
  return inBatches(files, async (file) => {
    const full = path.join(sourceRoot, "Assets", ...file.split("/"));
    const [hash, info] = await Promise.all([hashFile(full), stat(full)]);
    return { path: `Assets/${file}`, hash, bytes: info.size };
  });
}

const tally = <K extends string>(labels: Readonly<Record<K, string>>, values: readonly K[]): string =>
  (Object.keys(labels) as K[]).map((key) => `${labels[key]} ${values.filter((value) => value === key).length}`).join("、");

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (!existsSync(path.join(options.sourceRoot, "Assets"))) {
    throw new Error(`找不到原始素材目錄：${path.join(options.sourceRoot, "Assets")}。請先把遊戲解包檔放進 source-data/。`);
  }
  const rules = loadRules(RULES_PATH);
  const publishedDirs = publishedIconDirs(TAB_ORDER);
  const [published, scanned, previous] = await Promise.all([
    indexPublishedIcons(path.join(projectRoot, "public")),
    scan(options.sourceRoot, rules),
    readSnapshot(SNAPSHOT_PATH),
  ]);
  const current = new Map(scanned.map((file) => [file.path, file.hash]));
  const diff = diffSnapshot(previous, current);
  const records = sortRecords(
    scanned.map((file): AssetRecord => {
      const matches = published.get(file.hash) ?? [];
      return {
        path: file.path,
        name: path.posix.basename(file.path),
        ...classifyAsset(file.path, rules),
        kind: assetKind(file.path),
        usage: usageOf(matches, publishedDirs),
        published: matches,
        change: diff.changes.get(file.path) ?? "same",
        bytes: file.bytes,
      };
    }),
    groupOrder(rules),
  );

  await writeFile(path.join(projectRoot, "asset-index.md"), renderAssetReport(records, rules, diff), "utf8");
  await writeFile(path.join(options.sourceRoot, "asset-gallery.html"), renderGallery(records, rules, new Date().toISOString().slice(0, 10)), "utf8");
  if (!options.keepSnapshot) await writeSnapshot(SNAPSHOT_PATH, current);

  const unmatched = records.filter((record) => !record.matched).length;
  const changeLine = diff.isBaseline
    ? "首次建立快照"
    : `${tally<Change>(CHANGES, records.map((record) => record.change))}、移除 ${diff.removed.length}`;
  console.log(
    [
      `素材索引完成：${records.length} 個檔案（${tally<Usage>(USAGES, records.map((record) => record.usage))}）`,
      `與上次比較：${changeLine}${options.keepSnapshot ? "（快照未更新）" : ""}`,
      unmatched > 0 ? `未分類 ${unmatched} 個：請在 scripts/assets/rules.json 補規則` : "全部檔案都有分類規則",
      "報告 asset-index.md；瀏覽頁 source-data/asset-gallery.html",
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error(`素材索引失敗：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
