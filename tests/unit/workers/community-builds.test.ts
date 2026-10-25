import { beforeEach, describe, expect, it } from "vitest";
import { handle, PAGE_SIZE, PUBLISH_PER_HOUR, REPORTS_TO_HIDE, type Deps, type Env } from "../../../workers/community-builds/src/handlers";
import { normalizeCode, normalizeTitle } from "../../../workers/community-builds/src/validate";
import { sqliteD1 } from "../../helpers/sqlite-d1";

const ORIGIN = "https://mrpippi.github.io";
const CODE = "v=1&gv=1.1.3.0&m=axe&a=blizzard-staff";

let db: ReturnType<typeof sqliteD1>;
let env: Env;
let clock: number;
let ids: number;
let turnstileOk: boolean;
const deps: Deps = {
  verifyTurnstile: async () => turnstileOk,
  now: () => clock,
  randomId: () => `id${String(ids++).padStart(8, "0")}`,
};

beforeEach(() => {
  db = sqliteD1("workers/community-builds/schema.sql");
  env = { DB: db, TURNSTILE_SECRET: "s", HASH_SALT: "salt", ADMIN_TOKEN: "admin-token-0123456789", ALLOWED_ORIGINS: `${ORIGIN},http://localhost:4321` };
  clock = 1_800_000_000;
  ids = 0;
  turnstileOk = true;
});

const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  handle(
    new Request(`https://api.example${path}`, {
      method,
      headers: { Origin: ORIGIN, "CF-Connecting-IP": "203.0.113.7", ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    env,
    deps,
  );
const publish = (code = CODE, title = "Frost axe", headers?: Record<string, string>) => call("POST", "/builds", { code, title, lang: "zh", token: "t" }, headers);
const idOf = async (response: Response) => ((await response.json()) as { id: string }).id;
const voter = (n: number) => `browser-${String(n).padStart(12, "0")}`;

describe("normalizeCode", () => {
  it("keeps the build parameters in a fixed order and drops the rest", () => {
    expect(normalizeCode("?a=blizzard-staff&utm=x&m=axe&v=1")).toEqual({ ok: true, value: "v=1&m=axe&a=blizzard-staff" });
    expect(normalizeCode("v=1&m=axe&x=sharpness:3~looting:1&e=fire-aspect:2")).toEqual({ ok: true, value: "v=1&m=axe&e=fire-aspect:2&x=sharpness:3~looting:1" });
  });

  it("rejects other versions, empty builds, odd characters and repeats", () => {
    expect(normalizeCode("v=2&m=axe").ok).toBe(false);
    expect(normalizeCode("v=1&a=,,").ok).toBe(false);
    expect(normalizeCode("v=1&m=<script>").ok).toBe(false);
    expect(normalizeCode("v=1&m=axe&m=sword").ok).toBe(false);
    expect(normalizeCode(42).ok).toBe(false);
  });
});

describe("normalizeTitle", () => {
  it("trims and collapses spaces, and limits the length", () => {
    expect(normalizeTitle("  冰霜   斧頭 ")).toEqual({ ok: true, value: "冰霜 斧頭" });
    expect(normalizeTitle("劍".repeat(40)).ok).toBe(true);
    expect(normalizeTitle("劍".repeat(41)).ok).toBe(false);
    expect(normalizeTitle("   ").ok).toBe(false);
  });

  it("rejects links and markup", () => {
    for (const bad of ["see https://x.y", "www.example", "free.gg", "<b>hi</b>"]) expect(normalizeTitle(bad).ok, bad).toBe(false);
  });
});

describe("community builds API", () => {
  it("publishes a build and lists it, with CORS for the site", async () => {
    const created = await publish();
    expect(created.status).toBe(201);
    expect(created.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    const id = await idOf(created);
    const listed = await (await call("GET", "/builds")).json();
    expect(listed).toEqual({
      builds: [{ id, code: CODE, title: "Frost axe", lang: "zh", gameVersion: "1.1.3.0", createdAt: clock, votes: 0 }],
      more: false,
    });
  });

  it("gives no CORS header to other origins", async () => {
    const response = await call("GET", "/builds", undefined, { Origin: "https://evil.example" });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("refuses a failed Turnstile check, a bad title and a build already published", async () => {
    turnstileOk = false;
    expect((await publish()).status).toBe(403);
    turnstileOk = true;
    expect((await publish(CODE, "https://spam")).status).toBe(400);
    const first = await idOf(await publish());
    const again = await publish("?m=axe&a=blizzard-staff&gv=1.1.3.0&v=1", "Same build");
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: "exists", id: first });
  });

  it("limits how many builds one IP publishes per hour", async () => {
    for (let n = 0; n < PUBLISH_PER_HOUR; n++) expect((await publish(`v=1&m=axe&t=t${n}`)).status).toBe(201);
    expect((await publish("v=1&m=sword")).status).toBe(429);
    expect((await publish("v=1&m=sword", "Other", { "CF-Connecting-IP": "198.51.100.1" })).status).toBe(201);
    clock += 3601;
    expect((await publish("v=1&m=spear")).status).toBe(201);
  });

  it("counts one like per browser and sorts by likes", async () => {
    const a = await idOf(await publish("v=1&m=axe"));
    clock += 10;
    const b = await idOf(await publish("v=1&m=sword"));
    expect(await (await call("POST", `/builds/${a}/vote`, { voter: voter(1), token: "t" })).json()).toEqual({ votes: 1 });
    expect(await (await call("POST", `/builds/${a}/vote`, { voter: voter(1), token: "t" })).json()).toEqual({ votes: 1 });
    expect(await (await call("POST", `/builds/${a}/vote`, { voter: voter(2), token: "t" })).json()).toEqual({ votes: 2 });
    const top = (await (await call("GET", "/builds?sort=top")).json()) as { builds: { id: string }[] };
    const latest = (await (await call("GET", "/builds?sort=new")).json()) as { builds: { id: string }[] };
    expect(top.builds.map((one) => one.id)).toEqual([a, b]);
    expect(latest.builds.map((one) => one.id)).toEqual([b, a]);
    expect((await call("POST", `/builds/${a}/vote`, { voter: "short", token: "t" })).status).toBe(400);
  });

  it("hides a build reported by enough browsers", async () => {
    const id = await idOf(await publish());
    for (let n = 0; n < REPORTS_TO_HIDE; n++) await call("POST", `/builds/${id}/report`, { voter: voter(n), token: "t" });
    const listed = (await (await call("GET", "/builds")).json()) as { builds: unknown[] };
    expect(listed.builds).toEqual([]);
    expect((await call("POST", `/builds/${id}/vote`, { voter: voter(9), token: "t" })).status).toBe(404);
    expect(await (await publish(CODE, "Again")).json()).toEqual({ error: "hidden" });
  });

  it("pages the list", async () => {
    const insert = db.raw.prepare("INSERT INTO builds (id, code, title, lang, game_version, created_at, author) VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (let n = 0; n <= PAGE_SIZE; n++) insert.run(`b${String(n).padStart(9, "0")}`, `v=1&m=m${n}`, "x", "en", "", n, "a");
    const first = (await (await call("GET", "/builds?sort=new")).json()) as { builds: unknown[]; more: boolean };
    const second = (await (await call("GET", "/builds?sort=new&page=1")).json()) as { builds: unknown[]; more: boolean };
    expect([first.builds.length, first.more, second.builds.length, second.more]).toEqual([PAGE_SIZE, true, 1, false]);
  });

  it("lets only the admin token delete", async () => {
    const id = await idOf(await publish());
    await call("POST", `/builds/${id}/vote`, { voter: voter(1), token: "t" });
    expect((await call("DELETE", `/builds/${id}`, undefined, { Authorization: "Bearer wrong" })).status).toBe(401);
    expect((await call("DELETE", `/builds/${id}`, undefined, { Authorization: `Bearer ${env.ADMIN_TOKEN}` })).status).toBe(200);
    expect(db.raw.prepare("SELECT COUNT(*) AS n FROM votes").get()).toEqual({ n: 0 });
  });

  it("answers preflight requests and unknown routes", async () => {
    expect((await call("OPTIONS", "/builds")).status).toBe(204);
    expect((await call("GET", "/nope")).status).toBe(404);
    expect((await call("POST", "/builds", "not an object")).status).toBe(400);
  });
});
