import { describe, expect, it } from "vitest";
import { cardItems, errorLabel, hasItems } from "../../../src/lib/community/cards";
import { communityListPayload } from "../../../src/lib/community/payload";

describe("cardItems", () => {
  const items = { melee: { axe: ["Axe", "/icons/melee/axe.png"] as const }, artifact: { horn: ["Horn", undefined] as const } };

  it("lists the build's items in slot order, skipping unknown slugs", () => {
    expect(cardItems("v=1&a=,horn,ghost&m=axe&r=nope", items)).toEqual([
      { slot: "melee", name: "Axe", icon: "/icons/melee/axe.png" },
      { slot: "artifact2", name: "Horn" },
    ]);
  });
});

describe("hasItems", () => {
  it("needs at least one item, not just version or enchantment parameters", () => {
    expect(hasItems("?v=1&m=axe")).toBe(true);
    expect(hasItems("?v=1&a=,,horn")).toBe(true);
    expect(hasItems("?v=1&gv=1.1.3.0&e=fire-aspect:1")).toBe(false);
    expect(hasItems("")).toBe(false);
  });
});

describe("errorLabel", () => {
  it("maps the API's error codes and falls back for anything else", () => {
    expect(errorLabel("exists")).toBe("errExists");
    expect(errorLabel("rate")).toBe("errRate");
    expect(errorLabel("server")).toBe("actionFailed");
    expect(errorLabel(undefined)).toBe("actionFailed");
  });
});

describe("communityListPayload", () => {
  it("names every item a build slot can hold, with the page's texts", () => {
    const payload = communityListPayload("zh");
    expect(payload.items.melee?.["axe"]?.[0]).toBe("斧頭");
    expect(Object.keys(payload.items.helmet ?? {}).length).toBeGreaterThan(0);
    expect(payload.labels.version).toContain("{version}");
    expect(payload.buildHref).toBe("/zh/build/");
  });
});
