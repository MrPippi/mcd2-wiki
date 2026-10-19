import type { Issue } from "./issues";
import { writeOutputs } from "./output";
import { renderReport } from "./report";
import { runSteps, type ExtractOptions } from "./step";
import { bestiaryStep } from "./steps/bestiary";
import { describedStep } from "./steps/described";
import { entriesStep } from "./steps/entries";
import { EXTRACT_STEPS } from "./steps/index";

export type { ExtractOptions } from "./step";

export interface ExtractSummary {
  readonly entries: number;
  readonly armorSets: number;
  readonly icons: number;
  readonly mobs: number;
  /** Every DataTable file name the extract read. */
  readonly tablesRead: readonly string[];
  readonly issues: Issue[];
}

/** Runs the registered steps (steps/index.ts), then writes the entries, every step's data files and the report. */
export async function runExtract(options: ExtractOptions): Promise<ExtractSummary> {
  const run = await runSteps(EXTRACT_STEPS, { options });
  const described = run.valueOf(describedStep);
  const issues = [...run.issues];
  await writeOutputs(options.outRoot, described, run.files, renderReport({ ...described, issues }));
  return {
    entries: described.entries.length,
    armorSets: described.armorSets.length,
    icons: run.valueOf(entriesStep).copies.length,
    mobs: run.valueOf(bestiaryStep).mobs.mobs.length,
    tablesRead: run.tablesRead,
    issues,
  };
}
