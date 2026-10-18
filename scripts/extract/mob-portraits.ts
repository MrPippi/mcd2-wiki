/** Joins each mob to its render through CharacterReference and publishes each portrait twice: 256 px for cards (2× the largest card) and 768 px for the mob page plate. */
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { LARGE_PORTRAIT_DIR, largePortraitPath } from "../../src/lib/mob-portrait-path";
import { issue, type Issue } from "./issues";
import type { MobDraft } from "./mobs";

export const PORTRAIT_SIZE = 256;
/** The mob page plate is drawn up to about 380 CSS px wide; 768 px stays sharp there on high-DPI screens. */
export const LARGE_PORTRAIT_SIZE = 768;
/** Grey, untextured render: never published, even when a mob points at it. */
export const PORTRAIT_DENYLIST: readonly string[] = ["Geomancer_BombPillar"];

export interface PortraitPlan {
  readonly slug: string;
  readonly from: string;
  readonly source: "override" | "render";
  readonly published: string;
}
export interface PortraitInput {
  readonly renderDir: string;
  readonly renders: readonly string[];
  readonly overrideDir: string;
  readonly overrides: readonly string[];
}

const BLUEPRINT = /\/BP_([^/.]+)\.[^/]*$/;

/** "/Game/…/BP_Zombie.BP_Zombie_C" -> "Zombie". */
export function renderAssetName(reference: string): string | undefined {
  return BLUEPRINT.exec(reference)?.[1];
}

const lower = (text: string): string => text.toLowerCase();
const stem = (file: string): string => file.slice(0, file.length - path.extname(file).length);
const isDenied = (name: string): boolean => PORTRAIT_DENYLIST.some((denied) => lower(denied) === lower(name));

function byLowerName(files: readonly string[], extension: string): Map<string, string> {
  const index = new Map<string, string>();
  for (const file of files) {
    if (lower(path.extname(file)) === extension && !index.has(lower(stem(file)))) index.set(lower(stem(file)), file);
  }
  return index;
}

interface Resolved {
  readonly plan?: PortraitPlan;
  readonly usedRender?: string;
}

function resolveOne(draft: MobDraft, renders: Map<string, string>, overrides: Map<string, string>, input: PortraitInput): Resolved {
  const slug = draft.mob.slug;
  const published = `mobs/${slug}.webp`;
  const render = firstRender(draft, renders);
  const override = overrides.get(lower(slug));
  if (override) return { plan: { slug, from: path.join(input.overrideDir, override), source: "override", published }, usedRender: render };
  if (render) return { plan: { slug, from: path.join(input.renderDir, render), source: "render", published }, usedRender: render };
  return {};
}

/** The render this mob would use if no override existed: the first non-denied reference that has a file. */
function firstRender(draft: MobDraft, renders: Map<string, string>): string | undefined {
  for (const reference of draft.references) {
    const name = renderAssetName(reference);
    const file = name && !isDenied(name) ? renders.get(lower(name)) : undefined;
    if (file) return file;
  }
  return undefined;
}

export function planPortraits(drafts: readonly MobDraft[], input: PortraitInput): { plans: PortraitPlan[]; issues: Issue[] } {
  const renders = byLowerName(input.renders, ".png");
  const overrides = byLowerName(input.overrides, ".webp");
  const plans: PortraitPlan[] = [];
  const issues: Issue[] = [];
  const used = new Set<string>();
  for (const draft of drafts) {
    const { plan, usedRender } = resolveOne(draft, renders, overrides, input);
    if (plan) plans.push(plan);
    else issues.push(issue("mob-no-portrait", draft.mob.slug));
    if (usedRender) used.add(usedRender);
  }
  for (const file of input.renders) {
    if (lower(path.extname(file)) === ".png" && !used.has(file)) issues.push(issue("mob-portrait-unjoined", file));
  }
  return { plans, issues };
}

/** File names with the given extension, or null when the folder does not exist. */
export async function listPortraitFiles(dir: string, extension: ".png" | ".webp"): Promise<string[] | null> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && lower(path.extname(entry.name)) === extension).map((entry) => entry.name).sort();
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

export async function publishPortraits(outRoot: string, plans: readonly PortraitPlan[]): Promise<void> {
  const target = path.join(outRoot, "public", "mobs");
  await rm(target, { recursive: true, force: true });
  await mkdir(path.join(target, LARGE_PORTRAIT_DIR), { recursive: true });
  for (const plan of plans) {
    await writePortrait(plan.from, PORTRAIT_SIZE, path.join(outRoot, "public", plan.published));
    await writePortrait(plan.from, LARGE_PORTRAIT_SIZE, path.join(outRoot, "public", largePortraitPath(plan.published)));
  }
}

async function writePortrait(from: string, size: number, to: string): Promise<void> {
  await sharp(from)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90 })
    .toFile(to);
}

export function withPortraits(drafts: readonly MobDraft[], plans: readonly PortraitPlan[]): MobDraft[] {
  const bySlug = new Map(plans.map((plan) => [plan.slug, plan.published]));
  return drafts.map((draft) => {
    const portrait = bySlug.get(draft.mob.slug);
    return portrait ? { ...draft, mob: { ...draft.mob, portrait } } : draft;
  });
}
