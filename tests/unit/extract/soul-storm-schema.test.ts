import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EMPTY_SOUL_STORM, SoulStormDataSchema, SoulStormStatusSchema } from "../../../scripts/extract/soul-storm-schema";

describe("Soul Storm schema", () => {
  it("ships unverified, with no offsets", () => {
    const status = SoulStormStatusSchema.parse(JSON.parse(readFileSync(path.resolve(__dirname, "../../../scripts/extract/soul-storm-status.json"), "utf8")));
    expect(status).toEqual({ verified: false, anchorOffsetMinutes: 0, rotationOffset: 0 });
  });

  it("rejects a status that is not a plain boolean switch", () => {
    expect(() => SoulStormStatusSchema.parse({ verified: "yes", anchorOffsetMinutes: 0, rotationOffset: 0 })).toThrow();
    expect(() => SoulStormStatusSchema.parse({ verified: true, anchorOffsetMinutes: 0, rotationOffset: -1 })).toThrow();
    expect(() => SoulStormStatusSchema.parse({ verified: true, anchorOffsetMinutes: 0, rotationOffset: 0, extra: 1 })).toThrow();
  });

  it("accepts the empty output used when the tables are missing", () => {
    expect(SoulStormDataSchema.parse(EMPTY_SOUL_STORM)).toEqual(EMPTY_SOUL_STORM);
  });

  it("publishes the same verified flag as the hand-kept status file", () => {
    const out = path.resolve(__dirname, "../../../src/data/soul-storm.json");
    if (!existsSync(out)) return;   // no output before the first extract
    const data = SoulStormDataSchema.parse(JSON.parse(readFileSync(out, "utf8")));
    const status = SoulStormStatusSchema.parse(JSON.parse(readFileSync(path.resolve(__dirname, "../../../scripts/extract/soul-storm-status.json"), "utf8")));
    expect(data.verified).toBe(status.verified);
    expect(data.schedule.rotationOffset).toBe(status.rotationOffset);
    expect(data.schedule.anchorOffsetMinutes).toBe(status.anchorOffsetMinutes);
  });
});
