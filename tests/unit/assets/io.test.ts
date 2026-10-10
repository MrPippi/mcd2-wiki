import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sortRecords } from "../../../scripts/assets/record";
import { readSnapshot, writeSnapshot } from "../../../scripts/assets/snapshot";
import { indexPublishedIcons, listFiles } from "../../../scripts/assets/usage";
import { record } from "./fixtures";

let dir = "";

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "assets-io-"));
  await mkdir(path.join(dir, "public", "icons", "melee"), { recursive: true });
  await mkdir(path.join(dir, "public", "icons", "ui"), { recursive: true });
  await writeFile(path.join(dir, "public", "icons", "melee", "axe.png"), "same-bytes");
  await writeFile(path.join(dir, "public", "icons", "ui", "melee.png"), "same-bytes");
  await writeFile(path.join(dir, "public", "icons", "melee", "sword.png"), "other");
});

afterAll(() => rm(dir, { recursive: true, force: true }));

describe("site icon index", () => {
  it("lists files with forward slashes", async () => {
    expect(await listFiles(path.join(dir, "public", "icons"))).toEqual(["melee/axe.png", "melee/sword.png", "ui/melee.png"]);
  });

  it("groups byte-identical icons under one hash", async () => {
    const index = await indexPublishedIcons(path.join(dir, "public"));
    expect(index.size).toBe(2);
    expect([...index.values()].find((paths) => paths.length === 2)?.sort()).toEqual(["icons/melee/axe.png", "icons/ui/melee.png"]);
  });
});

describe("snapshot file io", () => {
  it("is undefined before the first run and round-trips after it", async () => {
    const file = path.join(dir, "snapshot.json");
    expect(await readSnapshot(file)).toBeUndefined();
    await writeSnapshot(file, new Map([["Assets/A.png", "h1"]]));
    expect(await readSnapshot(file)).toEqual({ files: { "Assets/A.png": "h1" } });
  });
});

describe("sortRecords", () => {
  it("orders by group, sub-item, detail, then icons first", () => {
    const sorted = sortRecords(
      [
        record({ path: "b", group: "other", sub: "A" }),
        record({ path: "t", group: "ui", sub: "A", kind: "texture" }),
        record({ path: "i", group: "ui", sub: "A", kind: "icon" }),
        record({ path: "z", group: "ui", sub: "A", detail: "B", kind: "icon" }),
      ],
      ["ui", "other"],
    );
    expect(sorted.map((item) => item.path)).toEqual(["i", "t", "z", "b"]);
  });
});
