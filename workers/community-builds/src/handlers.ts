/** The community builds API: list, publish, like, report, and an admin delete. Runtime-neutral (Web APIs only) so tests run it in Node. */
import type { Db } from "./db";
import { gameVersionOf, isLang, normalizeCode, normalizeTitle } from "./validate";

export interface Env {
  readonly DB: Db;
  /** Turnstile secret key. */
  readonly TURNSTILE_SECRET: string;
  /** Salt for the stored hashes of IPs and browser ids. */
  readonly HASH_SALT: string;
  /** Bearer token for DELETE. */
  readonly ADMIN_TOKEN: string;
  /** Comma-separated origins allowed to call the API. */
  readonly ALLOWED_ORIGINS: string;
}

export interface Deps {
  /** Verifies a Turnstile token; resolves false when it is invalid. */
  readonly verifyTurnstile: (token: string, ip: string | null) => Promise<boolean>;
  readonly now: () => number;
  readonly randomId: () => string;
}

export const PAGE_SIZE = 30;
/** Reports from this many browsers hide a build until an admin looks at it. */
export const REPORTS_TO_HIDE = 3;
/** Builds one IP may publish per hour. */
export const PUBLISH_PER_HOUR = 5;
const HOUR = 3600;
const MAX_BODY = 4096;
const VOTER_PATTERN = /^[A-Za-z0-9-]{16,64}$/;
const ID_PATTERN = /^[a-z0-9]{10}$/;

interface BuildRow {
  id: string;
  code: string;
  title: string;
  lang: string;
  game_version: string;
  created_at: number;
  votes: number;
}

const toBuild = (row: BuildRow) => ({
  id: row.id,
  code: row.code,
  title: row.title,
  lang: row.lang,
  gameVersion: row.game_version,
  createdAt: row.created_at,
  votes: row.votes,
});

export async function hashOf(salt: string, value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${value}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("Origin");
  const allowed = env.ALLOWED_ORIGINS.split(",").map((one) => one.trim());
  return origin && allowed.includes(origin)
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", Vary: "Origin" }
    : { Vary: "Origin" };
}

const json = (body: unknown, status: number, headers: Record<string, string>): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } });

async function readBody(request: Request): Promise<Record<string, unknown> | undefined> {
  const text = await request.text();
  if (text.length > MAX_BODY) return undefined;
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

async function list(url: URL, env: Env): Promise<{ status: number; body: unknown }> {
  const sort = url.searchParams.get("sort") === "new" ? "new" : "top";
  const page = Math.max(0, Math.min(100, Number.parseInt(url.searchParams.get("page") ?? "0", 10) || 0));
  const order = sort === "new" ? "created_at DESC" : "votes DESC, created_at DESC";
  const { results } = await env.DB.prepare(
    `SELECT id, code, title, lang, game_version, created_at, votes FROM builds WHERE hidden = 0 ORDER BY ${order} LIMIT ? OFFSET ?`,
  )
    .bind(PAGE_SIZE + 1, page * PAGE_SIZE)
    .all<BuildRow>();
  return { status: 200, body: { builds: results.slice(0, PAGE_SIZE).map(toBuild), more: results.length > PAGE_SIZE } };
}

async function publish(body: Record<string, unknown>, ip: string, env: Env, deps: Deps): Promise<{ status: number; body: unknown }> {
  const code = normalizeCode(body.code);
  const title = normalizeTitle(body.title);
  if (!code.ok) return { status: 400, body: { error: code.error } };
  if (!title.ok) return { status: 400, body: { error: title.error } };
  if (!isLang(body.lang)) return { status: 400, body: { error: "lang" } };
  if (typeof body.token !== "string" || !(await deps.verifyTurnstile(body.token, ip))) return { status: 403, body: { error: "turnstile" } };
  const existing = await env.DB.prepare("SELECT id, hidden FROM builds WHERE code = ?").bind(code.value).first<{ id: string; hidden: number }>();
  if (existing) return existing.hidden ? { status: 409, body: { error: "hidden" } } : { status: 409, body: { error: "exists", id: existing.id } };
  const now = deps.now();
  const author = await hashOf(env.HASH_SALT, `ip:${ip}`);
  const recent = await env.DB.prepare("SELECT COUNT(*) AS count FROM builds WHERE author = ? AND created_at > ?").bind(author, now - HOUR).first<{ count: number }>();
  if ((recent?.count ?? 0) >= PUBLISH_PER_HOUR) return { status: 429, body: { error: "rate" } };
  const id = deps.randomId();
  await env.DB.prepare("INSERT INTO builds (id, code, title, lang, game_version, created_at, author) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(id, code.value, title.value, body.lang, gameVersionOf(code.value), now, author)
    .run();
  return { status: 201, body: { id } };
}

/** A like or a report: one per browser id, counted on the build; enough reports hide it. */
async function mark(table: "votes" | "reports", id: string, body: Record<string, unknown>, ip: string, env: Env, deps: Deps): Promise<{ status: number; body: unknown }> {
  if (typeof body.voter !== "string" || !VOTER_PATTERN.test(body.voter)) return { status: 400, body: { error: "voter" } };
  if (typeof body.token !== "string" || !(await deps.verifyTurnstile(body.token, ip))) return { status: 403, body: { error: "turnstile" } };
  const build = await env.DB.prepare("SELECT id FROM builds WHERE id = ? AND hidden = 0").bind(id).first<{ id: string }>();
  if (!build) return { status: 404, body: { error: "missing" } };
  const voter = await hashOf(env.HASH_SALT, `voter:${body.voter}`);
  const inserted = await env.DB.prepare(`INSERT OR IGNORE INTO ${table} (build_id, voter) VALUES (?, ?)`).bind(id, voter).run();
  if (inserted.meta.changes > 0) {
    const column = table === "votes" ? "votes" : "reports";
    const hide = table === "reports" ? `, hidden = CASE WHEN reports + 1 >= ${REPORTS_TO_HIDE} THEN 1 ELSE hidden END` : "";
    await env.DB.prepare(`UPDATE builds SET ${column} = ${column} + 1${hide} WHERE id = ?`).bind(id).run();
  }
  const row = await env.DB.prepare("SELECT votes FROM builds WHERE id = ?").bind(id).first<{ votes: number }>();
  return { status: 200, body: { votes: row?.votes ?? 0 } };
}

async function remove(request: Request, id: string, env: Env): Promise<{ status: number; body: unknown }> {
  const auth = request.headers.get("Authorization") ?? "";
  if (env.ADMIN_TOKEN.length < 16 || auth !== `Bearer ${env.ADMIN_TOKEN}`) return { status: 401, body: { error: "auth" } };
  await env.DB.batch([
    env.DB.prepare("DELETE FROM votes WHERE build_id = ?").bind(id),
    env.DB.prepare("DELETE FROM reports WHERE build_id = ?").bind(id),
    env.DB.prepare("DELETE FROM builds WHERE id = ?").bind(id),
  ]);
  return { status: 200, body: { deleted: id } };
}

async function route(request: Request, env: Env, deps: Deps): Promise<{ status: number; body: unknown }> {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  if (parts[0] !== "builds" || parts.length > 3) return { status: 404, body: { error: "route" } };
  if (parts.length === 1) {
    if (request.method === "GET") return list(url, env);
    if (request.method !== "POST") return { status: 405, body: { error: "method" } };
    const body = await readBody(request);
    return body ? publish(body, ip, env, deps) : { status: 400, body: { error: "body" } };
  }
  const id = parts[1]!;
  if (!ID_PATTERN.test(id)) return { status: 404, body: { error: "missing" } };
  if (parts.length === 2) return request.method === "DELETE" ? remove(request, id, env) : { status: 405, body: { error: "method" } };
  const action = parts[2];
  if (request.method !== "POST" || (action !== "vote" && action !== "report")) return { status: 404, body: { error: "route" } };
  const body = await readBody(request);
  return body ? mark(action === "vote" ? "votes" : "reports", id, body, ip, env, deps) : { status: 400, body: { error: "body" } };
}

export async function handle(request: Request, env: Env, deps: Deps): Promise<Response> {
  const headers = corsHeaders(request, env);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  try {
    const { status, body } = await route(request, env, deps);
    return json(body, status, headers);
  } catch (error) {
    console.error("community builds:", error);
    return json({ error: "server" }, 500, headers);
  }
}
