import { describe, expect, it } from "vitest";
import { splitSiteTitle } from "../../../src/lib/site-title";

describe("splitSiteTitle", () => {
  it("splits the game name from the rest of the title", () => {
    expect(splitSiteTitle("Minecraft Dungeons II 中文 Wiki")).toEqual({ game: "Minecraft Dungeons II", word: "中文 Wiki", tag: undefined });
  });

  it("handles a title with no qualifier", () => {
    expect(splitSiteTitle("Minecraft Dungeons II Wiki")).toEqual({ game: "Minecraft Dungeons II", word: "Wiki", tag: undefined });
  });

  it("sets a half-width or full-width parenthetical qualifier apart", () => {
    expect(splitSiteTitle("Minecraft Dungeons II Wiki (zh-TW)")).toEqual({ game: "Minecraft Dungeons II", word: "Wiki", tag: "(zh-TW)" });
    expect(splitSiteTitle("Minecraft Dungeons II 中文 Wiki（简体）")).toEqual({ game: "Minecraft Dungeons II", word: "中文 Wiki", tag: "（简体）" });
  });

  it("leaves a title without the game name whole", () => {
    expect(splitSiteTitle("Some Other Wiki")).toBeUndefined();
    expect(splitSiteTitle("Minecraft Dungeons II")).toBeUndefined();
  });
});
