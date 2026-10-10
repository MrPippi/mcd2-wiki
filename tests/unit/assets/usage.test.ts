import { describe, expect, it } from "vitest";
import { publishedIconDirs, usageOf } from "../../../scripts/assets/usage";

const published = publishedIconDirs(["melee", "armor", "enchantment", "effect"]);

describe("publishedIconDirs", () => {
  it("follows the site's category tabs and adds books when enchantments are shown", () => {
    expect([...published].sort()).toEqual(["armor", "effect", "enchantment", "enchantment-book", "melee"]);
    expect(publishedIconDirs(["melee"]).has("enchantment-book")).toBe(false);
  });
});

describe("usageOf", () => {
  it("is unused when nothing on the site shares the file", () => {
    expect(usageOf([], published)).toBe("unused");
  });

  it("reads the category from the published icon path", () => {
    expect(usageOf(["icons/melee/axe.png"], published)).toBe("published");
    expect(usageOf(["icons/enchantment-book/arcane.png"], published)).toBe("published");
    expect(usageOf(["icons/status/burning.png"], published)).toBe("unpublished");
    expect(usageOf(["icons/ui/melee.png"], published)).toBe("site-ui");
    expect(usageOf(["icons/frames/artifact.png"], published)).toBe("site-ui");
  });

  it("treats a newly published category as published without code changes", () => {
    expect(usageOf(["icons/pet/bee.png"], publishedIconDirs(["pet"]))).toBe("published");
  });

  it("ranks a published use above other uses of the same file", () => {
    expect(usageOf(["icons/status/arcane.png", "icons/enchantment/arcane.png"], published)).toBe("published");
    expect(usageOf(["icons/skin/a.png", "icons/ui/all.png"], published)).toBe("site-ui");
  });
});
