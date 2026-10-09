import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { listIconFiles, loadOverrides } from "../../../scripts/extract/icon-files";
import { ExtractError } from "../../../scripts/extract/issues";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "mcd2-icons-"));
});

async function touch(relative: string, content = "x"): Promise<string> {
  const file = path.join(dir, ...relative.split("/"));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, "utf8");
  return file;
}

describe("listIconFiles", () => {
  it("lists only T_UI_*.png files as source-relative posix paths", async () => {
    const root = "Assets/Art/Characters/Player/Equipment";
    await touch(`${root}/Weapons/Sword/T_UI_Sword_Icon.png`);
    await touch(`${root}/Weapons/Sword/T_Sword.png`);
    await touch(`${root}/Weapons/Sword/T_UI_Notes.txt`);
    await expect(listIconFiles(dir, root)).resolves.toEqual([`${root}/Weapons/Sword/T_UI_Sword_Icon.png`]);
  });

  it("lists files under any given root", async () => {
    await touch("Assets/UI/Icons/Statuses/T_UI_Icon_Status_Burning.png");
    await expect(listIconFiles(dir, "Assets/UI/Icons/Statuses")).resolves.toEqual([
      "Assets/UI/Icons/Statuses/T_UI_Icon_Status_Burning.png",
    ]);
  });

  it("accepts a custom file pattern for icons not named T_UI_*", async () => {
    await touch("Assets/Skins/Darian/T_Darian_Skin_Icon.png");
    await touch("Assets/Skins/Darian/T_Darian_Skin.png");
    await expect(listIconFiles(dir, "Assets/Skins", /(?:^|\/)T_[^/]*_Icon\.png$/i)).resolves.toEqual([
      "Assets/Skins/Darian/T_Darian_Skin_Icon.png",
    ]);
  });

  it("returns null when the icon root does not exist", async () => {
    await expect(listIconFiles(dir, "Assets/Missing")).resolves.toBeNull();
  });
});

describe("loadOverrides", () => {
  it("returns an empty object when the file is missing", async () => {
    await expect(loadOverrides(path.join(dir, "none.json"))).resolves.toEqual({});
  });

  it("reads string and null overrides", async () => {
    const file = await touch("o.json", JSON.stringify({ A: "x.png", B: null }));
    await expect(loadOverrides(file)).resolves.toEqual({ A: "x.png", B: null });
  });

  it("rejects values that are not strings or null", async () => {
    const file = await touch("o.json", JSON.stringify({ A: 1 }));
    await expect(loadOverrides(file)).rejects.toThrow(ExtractError);
    await expect(loadOverrides(file)).rejects.toThrow(/圖示對照檔格式錯誤/);
  });

  it("rejects invalid JSON", async () => {
    const file = await touch("o.json", "{");
    await expect(loadOverrides(file)).rejects.toThrow(/圖示對照檔不是合法 JSON/);
  });
});
