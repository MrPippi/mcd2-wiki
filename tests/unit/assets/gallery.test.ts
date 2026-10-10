import { describe, expect, it } from "vitest";
import { renderGallery } from "../../../scripts/assets/gallery";
import { record, testRules } from "./fixtures";

const lock = record({ path: "Assets/UI/Icons/Lock/T_UI_Lock.png", name: "T_UI_Lock.png", group: "ui", sub: "Lock", kind: "icon" });

describe("renderGallery", () => {
  it("is a standalone page that embeds every record and the rules' group labels", () => {
    const html = renderGallery([lock], testRules);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('"Assets/UI/Icons/Lock/T_UI_Lock.png"');
    expect(html).toContain("介面 UI");
    expect(html).toContain("未使用");
  });

  it("marks which files a browser can draw", () => {
    const html = renderGallery([lock, record({ path: "Assets/X/T_Sky.hdr", name: "T_Sky.hdr", kind: "hdr" })], testRules);
    expect(html).toContain('"name":"T_UI_Lock.png","group":"ui"');
    expect(html).toMatch(/"name":"T_Sky\.hdr"[^}]*"previewable":false/);
  });

  it("counts changed files in the header", () => {
    expect(renderGallery([lock, record({ change: "new" })], testRules)).toContain("本次變動 1");
    expect(renderGallery([lock], testRules)).not.toContain("本次變動");
  });

  it("keeps data from closing its script tag", () => {
    const html = renderGallery([{ ...lock, sub: "</script><b>x" }], testRules);
    expect(html).not.toContain("</script><b>");
    expect(html).toContain("\\u003c/script>");
  });
});
