import { describe, expect, it } from "vitest";
import { diffSnapshot, parseSnapshot, serializeSnapshot } from "../../../scripts/assets/snapshot";

const current = new Map([
  ["Assets/A.png", "h1"],
  ["Assets/B.png", "h2-new"],
  ["Assets/C.png", "h3"],
]);

describe("diffSnapshot", () => {
  it("marks every file as a baseline when there is no earlier snapshot", () => {
    const diff = diffSnapshot(undefined, current);
    expect(diff.isBaseline).toBe(true);
    expect(diff.removed).toEqual([]);
    expect([...diff.changes.values()]).toEqual(["same", "same", "same"]);
  });

  it("finds added, changed, unchanged and removed files", () => {
    const previous = { files: { "Assets/A.png": "h1", "Assets/B.png": "h2", "Assets/Gone.png": "h9" } };
    const diff = diffSnapshot(previous, current);
    expect(diff.isBaseline).toBe(false);
    expect(diff.changes.get("Assets/A.png")).toBe("same");
    expect(diff.changes.get("Assets/B.png")).toBe("changed");
    expect(diff.changes.get("Assets/C.png")).toBe("new");
    expect(diff.removed).toEqual(["Assets/Gone.png"]);
  });
});

describe("snapshot file", () => {
  it("round-trips with sorted keys for stable diffs", () => {
    const text = serializeSnapshot(new Map([["Assets/B.png", "2"], ["Assets/A.png", "1"]]));
    expect(text.indexOf("Assets/A.png")).toBeLessThan(text.indexOf("Assets/B.png"));
    expect(parseSnapshot(text)).toEqual({ files: { "Assets/A.png": "1", "Assets/B.png": "2" } });
  });

  it("rejects a malformed snapshot", () => {
    expect(() => parseSnapshot('{"files": {"a": 1}}')).toThrow(/素材快照/);
    expect(() => parseSnapshot("not json")).toThrow(/素材快照/);
  });
});
