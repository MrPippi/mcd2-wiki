import { describe, expect, it } from "vitest";
import { GAME_VERSION, GameVersionSchema } from "../../../src/lib/game-version";

describe("GAME_VERSION", () => {
  it("is a plain version string", () => {
    expect(GAME_VERSION).toMatch(/^\d+(\.\d+)+$/);
  });

  it.each(["", "1.1 beta", "<b>1</b>", "x".repeat(33)])("rejects %j", (version) => {
    expect(GameVersionSchema.safeParse({ version }).success).toBe(false);
  });
});
