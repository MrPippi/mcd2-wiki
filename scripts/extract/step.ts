import path from "node:path";
import { ExtractError, type Issue } from "./issues";

export interface ExtractOptions {
  readonly sourceRoot: string;
  readonly outRoot: string;
  readonly overridesPath: string;
  /** Hand-made mob portraits; defaults to mob-portrait-overrides next to the icon overrides. */
  readonly mobPortraitOverrideDir?: string;
  /** The hand-kept Soul Storm status file; defaults to soul-storm-status.json next to the icon overrides. */
  readonly soulStormStatusPath?: string;
  /** The hand-kept guides status file; defaults to guides-status.json next to the icon overrides. */
  readonly guidesStatusPath?: string;
}

export interface StepContext {
  readonly options: ExtractOptions;
}

/** A hand-kept file that sits next to the icon overrides. */
export const siblingOfOverrides = (options: ExtractOptions, name: string): string => path.join(path.dirname(options.overridesPath), name);

export interface StepResult<Value> {
  /** What later steps read through `needs`. */
  readonly value: Value;
  readonly issues?: readonly Issue[];
  /** Data files for src/data, keyed by file name; exactly the names the step declares in `writes`. */
  readonly files?: Readonly<Record<string, unknown>>;
  /** DataTable file names the step read. */
  readonly tablesRead?: readonly string[];
}

/** The steps a step reads, by the name it uses for them. */
export type StepNeeds = Readonly<Record<string, AnyStep>>;

export type NeedValues<Needs extends StepNeeds> = {
  readonly [Alias in keyof Needs]: Needs[Alias] extends ExtractStep<infer Value, StepNeeds> ? Value : never;
};

/**
 * One extraction step. `needs` names the steps whose values it reads (the runner runs them first,
 * and `run` only sees those); `writes` names the src/data files it produces.
 */
export interface ExtractStep<Value = unknown, Needs extends StepNeeds = StepNeeds> {
  readonly name: string;
  readonly needs: Needs;
  readonly writes: readonly string[];
  // A method, so a step with specific needs still fits the registry's list of steps.
  run(context: StepContext, needs: NeedValues<Needs>): Promise<StepResult<Value>> | StepResult<Value>;
}

export type AnyStep = ExtractStep<any, any>;

/** Keeps the needs and value types of a step inferred from its definition. */
export const defineStep = <Value, Needs extends StepNeeds>(step: ExtractStep<Value, Needs>): ExtractStep<Value, Needs> => step;

const needsOf = (step: AnyStep): [string, AnyStep][] => Object.entries(step.needs as StepNeeds);

/** Fails when two steps share a name or a file, a step needs one that is not in the list, or the needs loop. */
export function validateSteps(steps: readonly AnyStep[]): void {
  const names = new Set<string>();
  const files = new Map<string, string>();
  for (const step of steps) {
    if (names.has(step.name)) throw new ExtractError(`抽取步驟名稱重複：${step.name}`);
    names.add(step.name);
    for (const [alias, need] of needsOf(step)) {
      if (!steps.includes(need)) throw new ExtractError(`抽取步驟 ${step.name} 需要 ${need.name}（${alias}），但它沒有登記`);
    }
    for (const file of step.writes) {
      const owner = files.get(file);
      if (owner !== undefined) throw new ExtractError(`${file} 同時由抽取步驟 ${owner} 與 ${step.name} 寫出`);
      files.set(file, step.name);
    }
  }
  executionOrder(steps);
}

/** The list order with every step moved after the steps it needs; a loop in the needs is an error. */
function executionOrder(steps: readonly AnyStep[]): AnyStep[] {
  const done = new Set<AnyStep>();
  const order: AnyStep[] = [];
  const visit = (step: AnyStep, path: readonly AnyStep[]): void => {
    if (done.has(step)) return;
    if (path.includes(step)) throw new ExtractError(`抽取步驟的 needs 形成迴圈：${[...path, step].map((item) => item.name).join(" → ")}`);
    for (const [, need] of needsOf(step)) visit(need, [...path, step]);
    done.add(step);
    order.push(step);
  };
  for (const step of steps) visit(step, []);
  return order;
}

export interface StepRun {
  /** The value a step produced. */
  valueOf<Value>(step: ExtractStep<Value, StepNeeds>): Value;
  /** Every step's issues, in list order. */
  readonly issues: readonly Issue[];
  readonly files: Readonly<Record<string, unknown>>;
  readonly tablesRead: readonly string[];
}

function checkWrites(step: AnyStep, result: StepResult<unknown>): Readonly<Record<string, unknown>> {
  const files = result.files ?? {};
  const actual = Object.keys(files).sort().join(", ");
  if (actual !== [...step.writes].sort().join(", ")) {
    throw new ExtractError(`抽取步驟 ${step.name} 寫出的檔案（${actual}）與宣告的 writes 不符`);
  }
  return files;
}

/**
 * Runs the steps, each after the steps it needs and seeing only their values. The list order decides the order of
 * the issues in extract-report.md; the run order only has to respect `needs`.
 */
export async function runSteps(steps: readonly AnyStep[], context: StepContext): Promise<StepRun> {
  validateSteps(steps);
  const results = new Map<AnyStep, StepResult<unknown>>();
  for (const step of executionOrder(steps)) {
    const needed = Object.fromEntries(needsOf(step).map(([alias, need]) => [alias, results.get(need)?.value]));
    const result: StepResult<unknown> = await step.run(context, needed);
    checkWrites(step, result);
    results.set(step, result);
  }
  const listed = steps.map((step) => results.get(step) as StepResult<unknown>);
  return {
    valueOf: (step) => results.get(step)?.value as never,
    issues: listed.flatMap((result) => result.issues ?? []),
    files: Object.assign({}, ...listed.map((result) => result.files ?? {})),
    tablesRead: listed.flatMap((result) => result.tablesRead ?? []),
  };
}
