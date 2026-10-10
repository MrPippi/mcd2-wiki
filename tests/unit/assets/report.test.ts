import { describe, expect, it } from "vitest";
import { renderAssetReport } from "../../../scripts/assets/report";
import { record, testRules } from "./fixtures";

const records = [
  record({
    path: "Assets/Art/Characters/Player/Equipment/Weapons/Axe/T_UI_Axe_Icon.png",
    name: "T_UI_Axe_Icon.png",
    group: "equipment",
    sub: "武器",
    detail: "Axe",
    kind: "icon",
    usage: "published",
    published: ["icons/melee/axe.png"],
  }),
  record({
    path: "Assets/Art/Characters/Player/Equipment/Weapons/Axe/T_Axe.png",
    name: "T_Axe.png",
    group: "equipment",
    sub: "武器",
    detail: "Axe",
    change: "new",
  }),
  record({ path: "Assets/UI/Icons/Lock/T_UI_Lock.png", name: "T_UI_Lock.png", group: "ui", sub: "Lock", kind: "icon", change: "changed" }),
  record({ path: "Assets/Mystery/Deep/T_M.png", name: "T_M.png", group: "other", sub: "Mystery", detail: "Deep", matched: false }),
];

const section = (report: string, heading: string): string => report.split(`## ${heading}`)[1]?.split("\n## ")[0] ?? "";

describe("renderAssetReport", () => {
  const report = renderAssetReport(records, testRules, { isBaseline: false, removed: ["Assets/Old/T_Old.png"] });

  it("summarises totals by group and usage", () => {
    expect(report).toContain("共 4 個檔案");
    expect(report).toMatch(/\| 裝備 \| 2 \| 1 \| 0 \| 0 \| 1 \|/);
    expect(report).toMatch(/\| 介面 UI \| 1 \| 0 \| 0 \| 0 \| 1 \|/);
  });

  it("reports what changed since the last run", () => {
    const changes = section(report, "與上次比較");
    expect(changes).toContain("新增 1、變更 1、移除 1");
    expect(changes).toContain("Assets/Art/Characters/Player/Equipment/Weapons/Axe/T_Axe.png");
    expect(changes).toContain("Assets/UI/Icons/Lock/T_UI_Lock.png");
    expect(changes).toContain("Assets/Old/T_Old.png");
  });

  it("says when this run only sets the baseline", () => {
    const first = renderAssetReport(records, testRules, { isBaseline: true, removed: [] });
    expect(section(first, "與上次比較")).toContain("首次建立快照");
  });

  it("flags folders no rule covers", () => {
    const unmatched = section(report, "未分類資料夾");
    expect(unmatched).toContain("Assets/Mystery");
    expect(unmatched).toContain("rules.json");
  });

  it("lists sub-items with their details under each group", () => {
    expect(report).toContain("## 裝備");
    expect(report).toMatch(/\| 武器 \| 2 \| 1 \| 1 \| Axe \|/);
  });

  it("lists icons the site does not use yet", () => {
    const unused = section(report, "未使用的圖示");
    expect(unused).toContain("Assets/UI/Icons/Lock/T_UI_Lock.png");
    expect(unused).not.toContain("T_UI_Axe_Icon");
  });

  it("maps used files to their site paths", () => {
    expect(report).toContain("`Assets/Art/Characters/Player/Equipment/Weapons/Axe/T_UI_Axe_Icon.png` → `icons/melee/axe.png`");
  });

  it("leaves out groups with no files", () => {
    expect(report).not.toContain("## 地圖");
  });
});
