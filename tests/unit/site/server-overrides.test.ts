import { describe, expect, it } from "vitest";
import type { GuidesData } from "../../../shared/guides-schema";
import type { Mob } from "../../../shared/mob-schema";
import { guidesData } from "../../../src/lib/guides";
import { mobData } from "../../../src/lib/mobs";
import {
  ServerOverridesSchema, applyCapOverrides, applyMobOverrides, capOverride, mobOverrides, serverOverrides, type ServerOverrides,
} from "../../../src/lib/server-overrides";

const caps: NonNullable<GuidesData["caps"]> = { emeralds: 99999, echoShards: 100, level: 100 };
const mob = (slug: string, health: number): Mob =>
  ({ slug, stats: [{ key: "health", value: health }, { key: "poise", value: 700 }] }) as unknown as Mob;
const overrides = (patch: Partial<ServerOverrides>): ServerOverrides => ({ caps: [], mobStats: [], ...patch });

describe("server overrides", () => {
  it("replaces a cap the server changed and leaves the others", () => {
    const list = overrides({ caps: [{ key: "emeralds", value: 999999, was: 99999, version: "1.1.4.0" }] });
    expect(applyCapOverrides(caps, list)).toEqual({ emeralds: 999999, echoShards: 100, level: 100 });
    expect(caps.emeralds).toBe(99999);
  });

  it("replaces a mob stat the server changed without touching the input", () => {
    const mobs = [mob("soul-corrupted-witch", 1200), mob("witch", 460)];
    const list = overrides({ mobStats: [{ mob: "soul-corrupted-witch", key: "health", value: 1000, was: 1200, version: "1.1.4.0" }] });
    const result = applyMobOverrides(mobs, list);
    expect(result[0]?.stats).toEqual([{ key: "health", value: 1000 }, { key: "poise", value: 700 }]);
    expect(result[1]).toBe(mobs[1]);
    expect(mobs[0]?.stats[0]?.value).toBe(1200);
  });

  it("fails when the game files no longer hold the old value, so a stale override gets rechecked", () => {
    const list = overrides({ caps: [{ key: "emeralds", value: 999999, was: 99999, version: "1.1.4.0" }] });
    expect(() => applyCapOverrides({ ...caps, emeralds: 999999 }, list)).toThrow(/already 999999/);
    expect(() => applyCapOverrides({ ...caps, emeralds: 50000 }, list)).toThrow(/expected 99999/);
  });

  it("fails on a mob or stat the data does not have", () => {
    const missingMob = overrides({ mobStats: [{ mob: "nobody", key: "health", value: 1, was: 2, version: "1.1.4.0" }] });
    expect(() => applyMobOverrides([mob("witch", 460)], missingMob)).toThrow(/nobody/);
    const missingStat = overrides({ mobStats: [{ mob: "witch", key: "mass", value: 1, was: 2, version: "1.1.4.0" }] });
    expect(() => applyMobOverrides([mob("witch", 460)], missingStat)).toThrow(/mass/);
  });

  it("rejects a change that changes nothing", () => {
    expect(ServerOverridesSchema.safeParse(overrides({ caps: [{ key: "level", value: 100, was: 100, version: "1.1.4.0" }] })).success).toBe(false);
  });

  it("is applied to the site's data", () => {
    for (const one of serverOverrides.caps) expect(guidesData.caps?.[one.key]).toBe(one.value);
    for (const one of serverOverrides.mobStats) {
      expect(mobData.mobs.find((m) => m.slug === one.mob)?.stats.find((s) => s.key === one.key)?.value).toBe(one.value);
    }
  });

  it("looks overrides up for the pages that note them", () => {
    const first = serverOverrides.mobStats[0];
    if (first) expect(mobOverrides(first.mob).map((one) => one.key)).toContain(first.key);
    expect(mobOverrides("no-such-mob")).toEqual([]);
    expect(capOverride("level")).toBeUndefined();
  });
});
