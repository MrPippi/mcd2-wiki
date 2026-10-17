import { existsSync } from "node:fs";
import { mkdtemp, readdir, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { listPortraitFiles, planPortraits, PORTRAIT_SIZE, publishPortraits, renderAssetName, withPortraits, type PortraitInput } from "../../../scripts/extract/mob-portraits";
import type { MobDraft } from "../../../scripts/extract/mobs";
import type { Mob } from "../../../scripts/extract/mob-schema";
import { loadMobTables } from "../../../scripts/extract/mob-tables";
import { buildMobs } from "../../../scripts/extract/mobs";
import { loadLocales } from "../../../scripts/extract/parse-locale";
import { loc } from "../../helpers/localized";

const ref = (blueprint: string) => `/Game/Spicewood/Art/Characters/Enemies/X/BP_${blueprint}.BP_${blueprint}_C`;

function draft(slug: string, ...references: string[]): MobDraft {
  const mob: Mob = { slug, id: slug, kind: "regular", world: null, name: loc({ en: slug }), untranslated: [], stats: [], variants: [], areas: [], drops: [] };
  return { mob, tags: [], closure: [], references };
}

const input = (renders: string[], overrides: string[] = []): PortraitInput => ({ renderDir: "/r", renders, overrideDir: "/o", overrides });

describe("renderAssetName", () => {
  it("takes the blueprint asset name without BP_ and keeps the game's own spelling", () => {
    expect(renderAssetName("/Game/Spicewood/Art/Characters/Enemies/Zombie/BP_Zombie.BP_Zombie_C")).toBe("Zombie");
    expect(renderAssetName(ref("Scavanger_Ranged"))).toBe("Scavanger_Ranged");
    expect(renderAssetName("None")).toBeUndefined();
    expect(renderAssetName("")).toBeUndefined();
  });
});

describe("planPortraits", () => {
  it("joins by CharacterReference, not by row name", () => {
    const { plans } = planPortraits([draft("zombie", ref("Zombie"))], input(["Zombie.png"]));
    expect(plans).toEqual([{ slug: "zombie", from: path.join("/r", "Zombie.png"), source: "render", published: "mobs/zombie.webp" }]);
  });

  it("joins a variant by its own blueprint (Zombie_Frozen)", () => {
    const { plans } = planPortraits([draft("zombie-frozen", ref("Zombie_Frozen"))], input(["Zombie.png", "Zombie_Frozen.png"]));
    expect(plans.map((plan) => path.basename(plan.from))).toEqual(["Zombie_Frozen.png"]);
  });

  it("lets a Soul Corrupted reference fall back to the base mob's portrait", () => {
    const zombie = draft("zombie", ref("Zombie"), ref("Zombie_SoulStated"));
    const creeperOnlySoul = draft("creeper", ref("Creeper_SoulStated"));
    const { plans, issues } = planPortraits([zombie, creeperOnlySoul], input(["Zombie.png"]));
    expect(plans.map((plan) => plan.slug)).toEqual(["zombie"]);
    expect(issues).toContainEqual({ type: "mob-no-portrait", detail: "creeper" });
  });

  it("matches file names without regard to case", () => {
    expect(planPortraits([draft("vex", ref("Vex"))], input(["vex.PNG"])).plans).toHaveLength(1);
  });

  it("reports renders that belong to no mob page and does not publish them", () => {
    const { plans, issues } = planPortraits([draft("zombie", ref("Zombie"))], input(["Zombie.png", "Evoker_FangTrap.png"]));
    expect(plans.map((plan) => plan.slug)).toEqual(["zombie"]);
    expect(issues).toContainEqual({ type: "mob-portrait-unjoined", detail: "Evoker_FangTrap.png" });
  });

  it("never publishes the grey Geomancer_BombPillar render even when a mob points at it", () => {
    const { plans, issues } = planPortraits([draft("geomancer-bomb-pillar", ref("Geomancer_BombPillar"))], input(["Geomancer_BombPillar.png"]));
    expect(plans).toEqual([]);
    expect(issues).toEqual([{ type: "mob-no-portrait", detail: "geomancer-bomb-pillar" }, { type: "mob-portrait-unjoined", detail: "Geomancer_BombPillar.png" }]);
  });

  it("prefers a hand-made override over the render", () => {
    const { plans } = planPortraits([draft("zombie", ref("Zombie"))], input(["Zombie.png"], ["zombie.webp"]));
    expect(plans).toEqual([{ slug: "zombie", from: path.join("/o", "zombie.webp"), source: "override", published: "mobs/zombie.webp" }]);
  });

  it("reports a referenced render the mob did not choose", () => {
    const { issues } = planPortraits([draft("slime", ref("Slime"), ref("Slime_Alias"))], input(["Slime.png", "Slime_Alias.png"]));
    expect(issues).toEqual([{ type: "mob-portrait-unjoined", detail: "Slime_Alias.png" }]);
  });

  it("prefers the representative reference over a merged cube row and reports the cube", () => {
    const { plans, issues } = planPortraits([draft("monstrosity-moss", ref("Monstrosity_Moss"), ref("Moss_Cube"))], input(["Monstrosity_Moss.png", "Moss_Cube.png"]));
    expect(plans.map((plan) => path.basename(plan.from))).toEqual(["Monstrosity_Moss.png"]);
    expect(issues).toEqual([{ type: "mob-portrait-unjoined", detail: "Moss_Cube.png" }]);
  });

  it("does not report the render of a mob whose override won", () => {
    const { issues } = planPortraits([draft("zombie", ref("Zombie"))], input(["Zombie.png"], ["zombie.webp"]));
    expect(issues).toEqual([]);
  });

  it("uses an override for a mob that has no render at all", () => {
    const { plans, issues } = planPortraits([draft("bee", ref("Bee"))], input([], ["bee.webp"]));
    expect(plans[0]?.source).toBe("override");
    expect(issues).toEqual([]);
  });
});

describe("withPortraits", () => {
  it("returns new drafts with the published path and leaves the inputs alone", () => {
    const original = draft("zombie", ref("Zombie"));
    const updated = withPortraits([original, draft("bee", ref("Bee"))], [{ slug: "zombie", from: "x", source: "render", published: "mobs/zombie.webp" }]);
    expect(updated[0]?.mob.portrait).toBe("mobs/zombie.webp");
    expect(updated[1]?.mob.portrait).toBeUndefined();
    expect(original.mob.portrait).toBeUndefined();
  });
});

describe("publishPortraits", () => {
  it("writes 256 px webp files, replacing what was there", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "mcd2-portrait-"));
    const source = path.join(root, "Zombie.png");
    await sharp({ create: { width: 256, height: 256, channels: 4, background: { r: 0, g: 128, b: 0, alpha: 0.5 } } }).png().toFile(source);
    await mkdir(path.join(root, "public", "mobs"), { recursive: true });
    await writeFile(path.join(root, "public", "mobs", "stale.webp"), "old");
    await publishPortraits(root, [{ slug: "zombie", from: source, source: "render", published: "mobs/zombie.webp" }]);
    expect(await readdir(path.join(root, "public", "mobs"))).toEqual(["zombie.webp"]);
    const meta = await sharp(path.join(root, "public", "mobs", "zombie.webp")).metadata();
    expect([meta.format, meta.width, meta.height, meta.hasAlpha]).toEqual(["webp", PORTRAIT_SIZE, PORTRAIT_SIZE, true]);
  });
});

describe("listPortraitFiles", () => {
  it("returns null for a missing folder and only the requested extension otherwise", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "mcd2-renders-"));
    await writeFile(path.join(dir, "Zombie.png"), "x");
    await writeFile(path.join(dir, "_render_log.txt"), "x");
    expect(await listPortraitFiles(dir, ".png")).toEqual(["Zombie.png"]);
    expect(await listPortraitFiles(path.join(dir, "nope"), ".png")).toBeNull();
  });
});

const REAL_RENDERS = "source-data/Renders/Mobs";
describe.skipIf(!existsSync(REAL_RENDERS))("real source-data", () => {
  it("joins the mobs to their renders through CharacterReference", async () => {
    const [locales, tables, renders] = await Promise.all([loadLocales("source-data"), loadMobTables("source-data"), listPortraitFiles(REAL_RENDERS, ".png")]);
    if (!tables || !renders) throw new Error("source data missing");
    const { drafts } = buildMobs(tables, locales);
    const { plans, issues } = planPortraits(drafts, { renderDir: REAL_RENDERS, renders, overrideDir: "scripts/extract/mob-portrait-overrides", overrides: [] });
    const slugs = plans.map((plan) => plan.slug);
    expect(slugs).toEqual(expect.arrayContaining(["zombie", "zombie-frozen", "maw"]));
    expect(slugs).not.toContain("bee");
    const unjoined = issues.filter((item) => item.type === "mob-portrait-unjoined").map((item) => item.detail);
    expect(unjoined).toEqual(expect.arrayContaining(["Evoker_FangTrap.png", "Geomancer_WallPillar.png", "RedStoneNode.png", "TargetDummy.png"]));
    expect(plans.map((plan) => path.basename(plan.from))).not.toContain("Geomancer_BombPillar.png");
  });
});
