import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";
import BuildPage from "../../../src/pages/[lang]/build.astro";
import { SLOT_KEYS } from "../../../src/lib/build/slots";
import { parseBuildPayload } from "../../../src/lib/build/parse";
import { GAME_VERSION } from "../../../src/lib/game-version";

let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create();
});
const render = (lang: string) => container.renderToString(BuildPage, { props: { lang }, params: { lang } });

const payloadOf = (html: string): unknown => {
  const json = /<script type="application\/json" data-build-json[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1];
  return json === undefined ? undefined : JSON.parse(json);
};

describe("build page", () => {
  it("renders every slot once", async () => {
    const html = await render("zh");
    for (const key of SLOT_KEYS) expect(html.split(`data-testid="build-slot-${key}"`).length - 1, key).toBe(1);
  });

  it("starts the planner hidden and explains it needs JavaScript", async () => {
    const html = await render("en");
    expect(/<div[^>]*data-testid="build-planner"[^>]*>/.exec(html)?.[0]).toMatch(/\shidden(\s|=|>)/);
    expect(html).toContain("<noscript>");
    expect(html).toContain("The build planner needs JavaScript.");
  });

  it("embeds a payload the browser check accepts", async () => {
    expect(parseBuildPayload(payloadOf(await render("ja")))).toBeDefined();
  });

  it("titles the page in the page language with the comparison name", async () => {
    const html = await render("zh");
    expect(html).toContain("配裝");
    expect(html).toContain("Build Planner");
  });

  it("states the game version the data matches", async () => {
    expect(await render("zh")).toContain(`遊戲版本 ${GAME_VERSION}`);
    expect((payloadOf(await render("en")) as { gameVersion: string }).gameVersion).toBe(GAME_VERSION);
  });

  it("offers the whole-set picker", async () => {
    expect(await render("en")).toContain('data-testid="build-whole-set"');
  });
});
