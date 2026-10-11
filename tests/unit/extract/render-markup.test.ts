import { describe, expect, it } from "vitest";
import { renderMarkup, stripMarkup } from "../../../scripts/extract/render-markup";

describe("renderMarkup", () => {
  it("escapes HTML special characters in plain text", () => {
    expect(renderMarkup(`say "hi" & 'bye'`, "en")).toEqual({
      html: "say &quot;hi&quot; &amp; &#39;bye&#39;",
      warnings: [],
    });
  });

  it("never emits script tags from injected markup", () => {
    const { html, warnings } = renderMarkup("<script>alert(1)</script>", "en");
    expect(html).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(warnings).toEqual(["unknown tag <script>"]);
  });

  it("renders emphasis in any case", () => {
    expect(renderMarkup("<emphasis>A</>", "en").html).toBe('<em class="emphasis">A</em>');
    expect(renderMarkup("<Emphasis>A</>", "en").html).toBe('<em class="emphasis">A</em>');
  });

  it("renders a valid decorator colour without alpha", () => {
    expect(renderMarkup('<SWDecorator Color="#E67740FF">警告</>：x', "zh").html).toBe(
      '<span style="color:#E67740">警告</span>：x',
    );
  });

  it("keeps only the text of a decorator with an invalid colour", () => {
    expect(renderMarkup('<SWDecorator Color="#FFF" onload="x">hi</>', "en")).toEqual({
      html: "hi",
      warnings: ['invalid color "#FFF"'],
    });
  });

  it("supports nesting", () => {
    expect(renderMarkup('<SWDecorator Color="#112233"><emphasis>A</></>', "en").html).toBe(
      '<span style="color:#112233"><em class="emphasis">A</em></span>',
    );
  });

  it("closes tags left open", () => {
    expect(renderMarkup("<emphasis>A", "en").html).toBe('<em class="emphasis">A</em>');
  });

  it("escapes a stray closing tag", () => {
    expect(renderMarkup("A</>", "en").html).toBe("A&lt;/&gt;");
  });

  it("keeps unknown tags and their closers as text", () => {
    expect(renderMarkup("<foo>x</>", "en")).toEqual({ html: "&lt;foo&gt;x&lt;/&gt;", warnings: ["unknown tag <foo>"] });
  });

  it("renders placeholders per language", () => {
    expect(renderMarkup("提高 {0}", "zh").html).toBe('提高 <span class="placeholder" data-slot="0">{數值}</span>');
    expect(renderMarkup("deal {damage}", "en").html).toBe('deal <span class="placeholder" data-slot="damage">{value}</span>');
  });

  it("turns newlines into line breaks", () => {
    expect(renderMarkup("a\nb\r\nc", "en").html).toBe("a<br>b<br>c");
  });
});

describe("stripMarkup", () => {
  it("removes tags and collapses whitespace", () => {
    expect(stripMarkup("<emphasis>Sage</>   Belt ")).toBe("Sage Belt");
  });
});

describe("placeholder slots", () => {
  it("keeps each placeholder's slot number", () => {
    expect(renderMarkup("移動超過 {1} 秒後，移動速度提高 {0}。", "zh").html).toBe(
      '移動超過 <span class="placeholder" data-slot="1">{數值}</span> 秒後，移動速度提高 <span class="placeholder" data-slot="0">{數值}</span>。',
    );
  });

  it("turns the game's plural syntax into a plural slot", () => {
    const { html, warnings } = renderMarkup("дольше {1} {1}|plural(one=секунды,few=секунд,many=секунд,other=секунды).", "en");
    expect(warnings).toEqual([]);
    expect(html).toContain('<span class="placeholder" data-slot="1">');
    expect(html).toContain('<span class="plural" data-slot="1" data-forms="{&quot;one&quot;:&quot;секунды&quot;,&quot;few&quot;:&quot;секунд&quot;,&quot;many&quot;:&quot;секунд&quot;,&quot;other&quot;:&quot;секунды&quot;}"></span>');
    expect(html).not.toContain("|plural(");
  });
});
