/** A Cloudflare D1 stand-in on node:sqlite, for testing the community builds worker. */
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { Db, Statement } from "../../workers/community-builds/src/db";

type Value = string | number | null;

function statement(db: DatabaseSync, sql: string, values: Value[] = []): Statement {
  return {
    bind: (...next: unknown[]) => statement(db, sql, next as Value[]),
    first: async <T>() => (db.prepare(sql).get(...values) as T | undefined) ?? null,
    all: async <T>() => ({ results: db.prepare(sql).all(...values) as T[] }),
    run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...values).changes) } }),
  };
}

export function sqliteD1(schemaPath: string): Db & { raw: DatabaseSync } {
  const raw = new DatabaseSync(":memory:");
  raw.exec(readFileSync(schemaPath, "utf8"));
  return {
    raw,
    prepare: (sql) => statement(raw, sql),
    batch: async (statements) => Promise.all(statements.map((one) => one.run())),
  };
}
