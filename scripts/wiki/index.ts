import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { publishedEntries } from "../../src/lib/data";
import { assembleWeaponEffects, isWeapon, wikiTitle, type WeaponEffectsReport } from "./assemble";
import { WikiFetchError, fetchWikiPages } from "./fetch";
import { WeaponEffectsSchema } from "./schema";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUTPUT = path.join(projectRoot, "src", "data", "weapon-effects.json");

const listed = (label: string, items: readonly string[]): string =>
  items.length === 0 ? `${label}：無` : `${label}（${items.length}）：${items.join("、")}`;

function printReport(report: WeaponEffectsReport): void {
  console.log(listed("Wiki 沒有頁面", report.missingPages));
  console.log(listed("尚無可用效果", report.noCompatible));
  console.log(listed("獨特武器未標明固定效果", report.noFixedBonus));
  console.log(listed("對不上網站資料的名稱", report.unmatched));
}

async function main(): Promise<void> {
  const titles = publishedEntries.filter(isWeapon).map(wikiTitle);
  const pages = await fetchWikiPages(titles);
  const { data, report } = assembleWeaponEffects(publishedEntries, pages);
  const checked = WeaponEffectsSchema.parse(data);
  await writeFile(OUTPUT, `${JSON.stringify(checked, null, 2)}\n`, "utf8");
  const withCompatible = Object.values(checked.weapons).filter((weapon) => weapon.compatible.length > 0).length;
  const withFixed = Object.values(checked.weapons).filter((weapon) => weapon.fixed).length;
  console.log(`已寫入 ${path.relative(projectRoot, OUTPUT)}：${titles.length} 把武器，${withCompatible} 把有可用效果，${withFixed} 把有固定效果`);
  printReport(report);
}

main().catch((error: unknown) => {
  console.error(error instanceof WikiFetchError ? `抓取失敗：${error.message}` : error);
  process.exitCode = 1;
});
