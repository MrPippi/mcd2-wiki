import { readFileSync } from "node:fs";
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
});
