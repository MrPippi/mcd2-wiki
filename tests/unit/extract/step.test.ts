import { describe, expect, it } from "vitest";
import { issue } from "../../../scripts/extract/issues";
import { defineStep, runSteps, type AnyStep, validateSteps, type StepContext } from "../../../scripts/extract/step";
import { EXTRACT_STEPS } from "../../../scripts/extract/steps";

const context: StepContext = { options: { sourceRoot: "src", outRoot: "out", overridesPath: "o.json" } };

const base = defineStep({
  name: "base",
  needs: {},
  writes: ["base.json"],
  run: () => ({ value: 2, issues: [issue("missing-icon", "base")], files: { "base.json": [1] }, tablesRead: ["A.json"] }),
});
const doubled = defineStep({
  name: "doubled",
  needs: { base },
  writes: [],
  run: (_context, { base: value }) => ({ value: value * 2, issues: [issue("missing-icon", "doubled")], tablesRead: ["B.json"] }),
});

describe("validateSteps", () => {
  it("rejects a step that needs one that is not registered", () => {
    expect(() => validateSteps([doubled])).toThrow(/沒有登記/);
  });

  it("accepts steps whose needs are all listed, in either order", () => {
    expect(() => validateSteps([base, doubled])).not.toThrow();
    expect(() => validateSteps([doubled, base])).not.toThrow();
  });

  it("rejects a loop in the needs", () => {
    const firstNeeds: Record<string, AnyStep> = {};
    const first = defineStep({ name: "first", needs: firstNeeds, writes: [], run: () => ({ value: 0 }) });
    const second = defineStep({ name: "second", needs: { first }, writes: [], run: () => ({ value: 0 }) });
    firstNeeds.second = second;
    expect(() => validateSteps([first, second])).toThrow(/迴圈/);
  });

  it("rejects duplicate names and files written twice", () => {
    expect(() => validateSteps([base, base])).toThrow(/名稱重複/);
    const other = defineStep({ name: "other", needs: {}, writes: ["base.json"], run: () => ({ value: 0 }) });
    expect(() => validateSteps([base, other])).toThrow(/base\.json.*base.*other/);
  });

  it("holds for the registered extraction steps", () => {
    expect(() => validateSteps(EXTRACT_STEPS)).not.toThrow();
  });
});

describe("runSteps", () => {
  it("runs each step after its needs and reports in list order", async () => {
    const run = await runSteps([doubled, base], context);
    expect(run.valueOf(doubled)).toBe(4);
    expect(run.issues.map((item) => item.detail)).toEqual(["doubled", "base"]);
    expect(run.files).toEqual({ "base.json": [1] });
    expect(run.tablesRead).toEqual(["B.json", "A.json"]);
  });

  it("refuses to run when a needed step is not registered", async () => {
    await expect(runSteps([doubled], context)).rejects.toThrow(/沒有登記/);
  });

  it("fails when a step writes other files than it declares", async () => {
    const stray = defineStep({ name: "stray", needs: {}, writes: ["a.json"], run: () => ({ value: 0, files: { "b.json": 1 } }) });
    await expect(runSteps([stray], context)).rejects.toThrow(/stray.*writes 不符/);
  });

  it("hands a step only the steps it declares", async () => {
    const seen: string[] = [];
    const peek = defineStep({
      name: "peek",
      needs: { base },
      writes: [],
      run: (_context, needs) => {
        seen.push(...Object.keys(needs));
        return { value: undefined };
      },
    });
    await runSteps([base, doubled, peek], context);
    expect(seen).toEqual(["base"]);
  });
});
