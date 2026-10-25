/** Calls to the community builds API from the browser, and this browser's anonymous voter id. */
import type { ErrorLabel } from "../lib/community/cards";
import { errorLabel } from "../lib/community/cards";

const VOTER_KEY = "mcd2-voter";
const MARKS_KEY = "mcd2-community-marks";

export interface CommunityBuild {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly lang: string;
  readonly gameVersion: string;
  readonly createdAt: number;
  readonly votes: number;
}

export type ApiResult<T> = { ok: true; value: T } | { ok: false; label: ErrorLabel; id?: string };

async function call<T>(api: string, path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${api}${path}`, init);
    const body = (await response.json()) as Record<string, unknown>;
    if (response.ok) return { ok: true, value: body as T };
    return { ok: false, label: errorLabel(body.error), ...(typeof body.id === "string" ? { id: body.id } : {}) };
  } catch (error) {
    console.error("community builds:", error);
    return { ok: false, label: "actionFailed" };
  }
}

const post = <T>(api: string, path: string, body: unknown) =>
  call<T>(api, path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const isBuild = (value: unknown): value is CommunityBuild => {
  if (typeof value !== "object" || value === null) return false;
  const one = value as Record<string, unknown>;
  return typeof one.id === "string" && typeof one.code === "string" && typeof one.title === "string" && typeof one.votes === "number" && typeof one.createdAt === "number" && typeof one.gameVersion === "string";
};

export async function listBuilds(api: string, sort: "top" | "new", page: number): Promise<ApiResult<{ builds: CommunityBuild[]; more: boolean }>> {
  const result = await call<{ builds: unknown; more: unknown }>(api, `/builds?sort=${sort}&page=${page}`);
  if (!result.ok) return result;
  const builds = Array.isArray(result.value.builds) ? result.value.builds.filter(isBuild) : [];
  return { ok: true, value: { builds, more: result.value.more === true } };
}

export const publishBuild = (api: string, body: { code: string; title: string; lang: string; token: string }) => post<{ id: string }>(api, "/builds", body);

export const markBuild = (api: string, id: string, action: "vote" | "report", token: string) =>
  post<{ votes: number }>(api, `/builds/${encodeURIComponent(id)}/${action}`, { voter: voterId(), token });

/** A random id kept in this browser; without storage it lasts for the page. */
let pageVoter: string | undefined;
export function voterId(): string {
  try {
    const stored = localStorage.getItem(VOTER_KEY);
    if (stored) return stored;
    const made = crypto.randomUUID();
    localStorage.setItem(VOTER_KEY, made);
    return made;
  } catch {
    pageVoter ??= crypto.randomUUID();
    return pageVoter;
  }
}

/** Builds this browser already liked or reported (`vote:<id>`, `report:<id>`), so the buttons can say so. */
function readMarks(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(MARKS_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((mark): mark is string => typeof mark === "string") : [];
  } catch {
    return [];
  }
}

export const hasMark = (id: string, action: "vote" | "report"): boolean => readMarks().includes(`${action}:${id}`);

export function saveMark(id: string, action: "vote" | "report"): void {
  try {
    localStorage.setItem(MARKS_KEY, JSON.stringify([...new Set([...readMarks(), `${action}:${id}`])]));
  } catch {
    // Storage is unavailable (private mode): the mark lasts only for this page.
  }
}
