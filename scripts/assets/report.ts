import { KINDS, type Kind } from "./classify";
import type { AssetRecord } from "./record";
import { groupOrder, type AssetRules } from "./rules";
import type { SnapshotDiff } from "./snapshot";
import { USAGES, type Usage } from "./usage";

const USAGE_ORDER = Object.keys(USAGES) as Usage[];
const DETAILS_SHOWN = 8;

type DiffSummary = Pick<SnapshotDiff, "isBaseline" | "removed">;

const countBy = <T>(items: readonly T[], test: (item: T) => boolean): number => items.filter(test).length;
const code = (text: string): string => `\`${text}\``;
const groupsIn = (records: readonly AssetRecord[], rules: AssetRules): string[] =>
  groupOrder(rules).filter((group) => records.some((record) => record.group === group));

function summaryTable(records: readonly AssetRecord[], rules: AssetRules): string[] {
  const header = `| 分類 | 總數 | ${USAGE_ORDER.map((usage) => USAGES[usage]).join(" | ")} |`;
  const divider = `|---|---:|${USAGE_ORDER.map(() => "---:").join("|")}|`;
  const rows = groupsIn(records, rules).map((group) => {
    const inGroup = records.filter((record) => record.group === group);
    const byUsage = USAGE_ORDER.map((usage) => countBy(inGroup, (record) => record.usage === usage));
    return `| ${rules.groups[group]} | ${inGroup.length} | ${byUsage.join(" | ")} |`;
  });
  return [header, divider, ...rows];
}

function changeSection(records: readonly AssetRecord[], diff: DiffSummary): string[] {
  if (diff.isBaseline) {
    return ["## 與上次比較", "", "首次建立快照（`scripts/assets/snapshot.json`），下次執行起會列出新增、變更與移除的檔案。", ""];
  }
  const added = records.filter((record) => record.change === "new");
  const changed = records.filter((record) => record.change === "changed");
  const list = (title: string, paths: readonly string[]): string[] =>
    paths.length === 0 ? [] : [`### ${title} (${paths.length})`, "", ...paths.map((p) => `- ${code(p)}`), ""];
  return [
    "## 與上次比較",
    "",
    `新增 ${added.length}、變更 ${changed.length}、移除 ${diff.removed.length}。`,
    "",
    ...list("新增", added.map((record) => record.path)),
    ...list("變更", changed.map((record) => record.path)),
    ...list("移除", diff.removed),
  ];
}

function unmatchedSection(records: readonly AssetRecord[]): string[] {
  const unmatched = records.filter((record) => !record.matched);
  if (unmatched.length === 0) return [];
  const folderOf = (record: AssetRecord): string => ["Assets", record.sub, record.detail].filter(Boolean).join("/");
  const folders = [...new Set(unmatched.map(folderOf))];
  return [
    `## 未分類資料夾 (${unmatched.length})`,
    "",
    "這些檔案沒有規則對應，暫放在「其他」。在 `scripts/assets/rules.json` 新增規則（prefix → 分類／分項）後重跑 `npm run assets`。",
    "",
    ...folders.map((folder) => `- ${code(folder)}：${countBy(unmatched, (record) => folderOf(record) === folder)} 個`),
    "",
  ];
}

function detailList(records: readonly AssetRecord[]): string {
  const details = [...new Set(records.map((record) => record.detail).filter((detail) => detail !== ""))];
  if (details.length === 0) return "—";
  const shown = details.slice(0, DETAILS_SHOWN).join("、");
  return details.length > DETAILS_SHOWN ? `${shown}…等 ${details.length} 項` : shown;
}

function groupSection(records: readonly AssetRecord[], rules: AssetRules, group: string): string[] {
  const inGroup = records.filter((record) => record.group === group);
  const subs = [...new Set(inGroup.map((record) => record.sub))];
  const rows = subs.map((sub) => {
    const inSub = inGroup.filter((record) => record.sub === sub);
    const icons = countBy(inSub, (record) => record.kind === "icon");
    const used = countBy(inSub, (record) => record.usage !== "unused");
    return `| ${sub} | ${inSub.length} | ${icons} | ${used} | ${detailList(inSub)} |`;
  });
  return [`## ${rules.groups[group]}`, "", "| 分項 | 數量 | 圖示 | 已使用 | 細項 |", "|---|---:|---:|---:|---|", ...rows, ""];
}

const kindLine = (records: readonly AssetRecord[]): string =>
  (Object.keys(KINDS) as Kind[]).map((kind) => `${KINDS[kind]} ${countBy(records, (record) => record.kind === kind)}`).join("、");

/** Markdown index of the raw assets: totals, changes, unmatched folders, sub-items, unused icons and the source → site mapping. */
export function renderAssetReport(records: readonly AssetRecord[], rules: AssetRules, diff: DiffSummary): string {
  const unusedIcons = records.filter((record) => record.kind === "icon" && record.usage === "unused");
  const used = records.filter((record) => record.published.length > 0);
  return [
    "# 原始素材索引",
    "",
    `共 ${records.length} 個檔案。類型：${kindLine(records)}。`,
    "用途以檔案內容比對 `public/icons/` 判定；瀏覽頁：`source-data/asset-gallery.html`。",
    "",
    ...summaryTable(records, rules),
    "",
    ...changeSection(records, diff),
    ...unmatchedSection(records),
    ...groupsIn(records, rules).flatMap((group) => groupSection(records, rules, group)),
    `## 未使用的圖示 (${unusedIcons.length})`,
    "",
    "遊戲有圖示但網站沒用到；可能是未收錄的物品，或可補進 `icon-overrides.json`。",
    "",
    ...unusedIcons.map((record) => `- ${code(record.path)}`),
    "",
    `## 原始檔 → 網站路徑 (${used.length})`,
    "",
    ...used.map((record) => `- ${code(record.path)} → ${record.published.map(code).join("、")}`),
    "",
  ].join("\n");
}
