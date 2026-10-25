import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG_NAME, updateGameVersion } from "./game-version";
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
  const update = await updateGameVersion(projectRoot, sourceRoot, process.env.GAME_DIR);
  console.log(
    update === undefined
      ? `找不到 ${CONFIG_NAME}，遊戲版本沒有更新（把它放進 source-data/，或以 GAME_DIR 指定遊戲安裝目錄）`
      : `遊戲版本：${update.previous === update.version ? update.version : `${update.previous} → ${update.version}`}（取自 ${update.config}）`,
  );
  if (update !== undefined && !update.config.startsWith(sourceRoot)) {
    console.warn(`注意：版本取自已安裝的遊戲；若 source-data 不是從這個版本解包，把解包時的 ${CONFIG_NAME} 放進 source-data/`);
  }
  console.log(
    `抽取完成：${summary.entries} 個條目、${summary.armorSets} 個護甲套裝、${summary.icons} 張圖示、${summary.mobs} 隻怪物、${summary.issues.length} 個問題（詳見 extract-report.md）`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof ExtractError ? `抽取失敗：${error.message}` : error);
  process.exitCode = 1;
});
