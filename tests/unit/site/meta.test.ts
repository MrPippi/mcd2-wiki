import { describe, expect, it } from "vitest";
import { metaDescription, plainText } from "../../../src/lib/meta";

describe("plainText", () => {
  it("drops tags and keeps their text", () => {
    expect(plainText('Carry <span class="placeholder">{value}</span> more ammo.')).toBe("Carry {value} more ammo.");
  });

  it("decodes the entities the game text uses", () => {
    expect(plainText("Hunter&#39;s &amp; &lt;b&gt; &quot;x&quot;")).toBe('Hunter\'s & <b> "x"');
  });

  it("collapses whitespace", () => {
    expect(plainText("  a \n\n b  ")).toBe("a b");
  });
});

describe("metaDescription", () => {
  it("keeps short text as is", () => {
    expect(metaDescription("短句。")).toBe("短句。");
  });

  it("cuts long text at the limit with an ellipsis", () => {
    const text = "字".repeat(200);
    const result = metaDescription(text, 160);
    expect(result).toHaveLength(160);
    expect(result.endsWith("…")).toBe(true);
  });

  it("falls back when the text is empty", () => {
    expect(metaDescription("   ", 160, "後備")).toBe("後備");
  });
});
