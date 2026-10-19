import { CATEGORIES, type Category, type Release } from "../../shared/config";
import type { Issue, IssueType } from "./issues";
import type { ArmorSet, Entry } from "../../shared/schemas";

const COUNT_ONLY: ReadonlySet<IssueType> = new Set(["ignored-field", "placeholder-only"]);

interface ReportInput {
  readonly entries: readonly Entry[];
  readonly armorSets: readonly ArmorSet[];
  readonly issues: readonly Issue[];
}

const count = (entries: readonly Entry[], category: Category, release: Release): number =>
  entries.filter((entry) => entry.category === category && entry.release === release).length;

function groupByType(issues: readonly Issue[]): Map<IssueType, Issue[]> {
  const groups = new Map<IssueType, Issue[]>();
  for (const item of issues) groups.set(item.type, [...(groups.get(item.type) ?? []), item]);
  return groups;
}

function summaryLines(groups: Map<IssueType, Issue[]>): string[] {
  if (groups.size === 0) return ["無問題"];
  return ["| 類型 | 數量 |", "|---|---|", ...[...groups].map(([type, items]) => `| ${type} | ${items.length} |`)];
}

function detailLines(groups: Map<IssueType, Issue[]>): string[] {
  return [...groups]
    .filter(([type]) => !COUNT_ONLY.has(type))
    .flatMap(([type, items]) => [`### ${type} (${items.length})`, "", ...items.map((item) => `- ${item.detail}`), ""]);
}

export function renderReport(input: ReportInput): string {
  const groups = groupByType(input.issues);
  const lines = [
    "# Extract Report",
    "",
    "## 條目數",
    "",
    "| 分類 | base | upcoming |",
    "|---|---|---|",
    ...CATEGORIES.map((c) => `| ${c} | ${count(input.entries, c, "base")} | ${count(input.entries, c, "upcoming")} |`),
    "",
    `護甲套裝：${input.armorSets.length}`,
    "",
    "## 問題摘要",
    "",
    ...summaryLines(groups),
    "",
    "## 詳細",
    "",
    ...detailLines(groups),
  ];
  return `${lines.join("\n")}\n`;
}
