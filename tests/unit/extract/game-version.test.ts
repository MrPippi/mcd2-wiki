import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { configVersion, updateGameVersion, withReadmeVersion } from "../../../scripts/extract/game-version";

const config = (version: string) =>
  `<?xml version="1.0" encoding="utf-8"?>\n<Game configVersion="1">\n  <Identity Name="Microsoft.MinecraftDungeons2" Publisher="CN=Microsoft" Version="${version}" />\n</Game>\n`;

describe("configVersion", () => {
  it("reads the Identity version, not the XML declaration's", () => {
    expect(configVersion(config("1.1.3.0"))).toBe("1.1.3.0");
  });

  it.each(["", "1.1 beta", "<b>1</b>"])("rejects %j", (version) => {
    expect(configVersion(config(version))).toBeUndefined();
  });

  it("is undefined without an Identity", () => {
    expect(configVersion(`<?xml version="1.0"?><Game />`)).toBeUndefined();
  });
});

describe("withReadmeVersion", () => {
  it("replaces every mention of the old version", () => {
    expect(withReadmeVersion("badge/game-1.1.2.0-orange … **game version 1.1.2.0**", "1.1.2.0", "1.1.3.0")).toBe(
      "badge/game-1.1.3.0-orange … **game version 1.1.3.0**",
    );
  });
});

describe("updateGameVersion", () => {
  async function project(installed: string, unpacked?: string) {
    const root = await mkdtemp(path.join(tmpdir(), "game-version-"));
    const source = path.join(root, "source-data");
    const game = path.join(root, "game");
    await mkdir(path.join(root, "shared"));
    await mkdir(source);
    await mkdir(game);
    await writeFile(path.join(root, "shared", "game-version.json"), `{\n  "version": "1.1.2.0"\n}\n`);
    await writeFile(path.join(root, "README.md"), "game-1.1.2.0-orange");
    await writeFile(path.join(root, "README.zh-TW.md"), "遊戲版本-1.1.2.0-orange");
    await writeFile(path.join(game, "MicrosoftGame.config"), config(installed));
    if (unpacked !== undefined) await writeFile(path.join(source, "MicrosoftGame.config"), config(unpacked));
    return { root, source, game };
  }
  const read = (root: string, file: string) => readFile(path.join(root, file), "utf8");

  it("writes the installed version into the version file and both READMEs", async () => {
    const { root, source, game } = await project("1.1.3.0");
    expect(await updateGameVersion(root, source, game)).toEqual({ version: "1.1.3.0", previous: "1.1.2.0", config: path.join(game, "MicrosoftGame.config") });
    expect(await read(root, "shared/game-version.json")).toBe(`{\n  "version": "1.1.3.0"\n}\n`);
    expect(await read(root, "README.md")).toBe("game-1.1.3.0-orange");
    expect(await read(root, "README.zh-TW.md")).toBe("遊戲版本-1.1.3.0-orange");
  });

  it("prefers a config copied next to the unpacked files", async () => {
    const { root, source, game } = await project("1.1.4.0", "1.1.3.0");
    expect((await updateGameVersion(root, source, game))?.version).toBe("1.1.3.0");
  });

  it("changes nothing when no config is found", async () => {
    const { root, source } = await project("1.1.3.0");
    expect(await updateGameVersion(root, source, path.join(root, "nowhere"))).toBeUndefined();
    expect(await read(root, "shared/game-version.json")).toContain("1.1.2.0");
  });
});
