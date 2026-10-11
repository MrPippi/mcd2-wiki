import path from "node:path";
import { fileURLToPath } from "node:url";
import { ExtractError } from "./issues";
import { runExtract } from "./pipeline";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

async function main(): Promise<void> {
  const sourceRoot = path.resolve(process.argv[2] ?? path.join(projectRoot, "source-data"));
  const summary = await runExtract({
    sourceRoot,
    outRoot: projectRoot,
    overridesPath: path.join(projectRoot, "scripts", "extract", "icon-overrides.json"),
  });
  console.log(
    `抽取完成：${summary.entries} 個條目、${summary.armorSets} 個護甲套裝、${summary.icons} 張圖示、${summary.mobs} 隻怪物、${summary.issues.length} 個問題（詳見 extract-report.md）`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof ExtractError ? `抽取失敗：${error.message}` : error);
  process.exitCode = 1;
});
