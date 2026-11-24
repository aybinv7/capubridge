import { DatabaseSync } from "node:sqlite";
import { runInNewContext } from "node:vm";
import { describe, expect, test } from "vite-plus/test";
import type { CDPClient } from "../src/cdp/client.ts";
import { LiveSqlite, normalizeSqliteFilename } from "../src/cdp/domains/live-sqlite.ts";

type Conn = InstanceType<typeof DatabaseSync>;

interface FakeDb {
  filename: string;
  pointer?: number;
  conn: Conn;
}

/** sqlite-wasm's `oo1.DB` as far as the scripts use it, over a real SQLite connection. */
function library() {
  function DB(this: FakeDb, filename: string, conn: Conn) {
    this.filename = filename;
    this.pointer = 1;
    this.conn = conn;
  }
  const rows = (db: FakeDb, sql: string) => db.conn.prepare(sql).all() as Record<string, unknown>[];
  DB.prototype.exec = function (this: FakeDb, sql: string) {
    this.conn.exec(sql);
  };
  DB.prototype.selectValue = function (this: FakeDb, sql: string) {
    const row = rows(this, sql)[0];
    return row ? Object.values(row)[0] : undefined;
  };
  DB.prototype.selectValues = function (this: FakeDb, sql: string) {
    return rows(this, sql).map((row) => Object.values(row)[0]);
  };
  DB.prototype.selectArrays = function (this: FakeDb, sql: string) {
    return rows(this, sql).map((row) => Object.values(row));
  };
  DB.prototype.changes = function (this: FakeDb) {
    return Number((this.conn.prepare("SELECT changes() AS n").get() as { n: number }).n);
  };
  DB.prototype.checkRc = function () {};
  DB.prototype.isOpen = function (this: FakeDb) {
    return this.pointer !== undefined;
  };
  function SahPoolDb(this: FakeDb, filename: string, conn: Conn) {
    DB.call(this, filename, conn);
  }
  SahPoolDb.prototype = Object.create(DB.prototype);
  return { DB, SahPoolDb };
}

function linked(): Conn {
  const conn = new DatabaseSync(":memory:");
  conn.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE product (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE pack_item (id INTEGER PRIMARY KEY, product_id INTEGER REFERENCES product(id));
    INSERT INTO product (id, name) VALUES (1, 'a'), (2, 'b');
    INSERT INTO pack_item (product_id) VALUES (1), (2), (2);`);
  return conn;
}

function count(conn: Conn, table: string): number {
  return Number((conn.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n);
}

/** A page with one dedicated worker holding `dbs`; CDP calls run the scripts against them. */
function fakePage(dbs: object[], functions: Function[]) {
  const objects = new Map<string, unknown>();
  const calls: string[] = [];
  const handlers = new Map<string, (params: unknown) => void>();
  let next = 0;
  const remote = (value: unknown) => {
    const objectId = `o${next++}`;
    objects.set(objectId, value);
    return { objectId };
  };
  const send = async (method: string, params: Record<string, unknown> = {}, sessionId?: string) => {
    calls.push(sessionId ? `${method}@${sessionId}` : method);
    if (method === "Target.setAutoAttach") {
      if (params.autoAttach) {
        handlers.get("Target.attachedToTarget")?.({
          sessionId: "w1",
          targetInfo: { type: "worker" },
        });
      }
      return {};
    }
    if (method === "Runtime.evaluate") return { result: remote(Function.prototype) };
    if (method === "Runtime.queryObjects") {
      const prototype = objects.get(String(params.prototypeObjectId));
      const found =
        prototype === Function.prototype
          ? functions
          : dbs.filter((db) => Object.prototype.isPrototypeOf.call(prototype, db));
      return { objects: remote(found) };
    }
    if (method === "Runtime.getProperties") {
      const array = objects.get(String(params.objectId)) as unknown[];
      return {
        result: [
          ...array.map((value, index) => ({ name: String(index), value: remote(value) })),
          { name: "length", value: { value: array.length } },
        ],
      };
    }
    if (method === "Runtime.callFunctionOn") {
      const fn = runInNewContext(`(${String(params.functionDeclaration)})`, { setTimeout });
      const args = ((params.arguments as { value: unknown }[] | undefined) ?? []).map(
        (arg) => arg.value,
      );
      let value = fn.apply(objects.get(String(params.objectId)), args);
      if (params.awaitPromise) value = await value;
      return params.returnByValue
        ? { result: { value: JSON.parse(JSON.stringify(value)) } }
        : { result: remote(value) };
    }
    return {};
  };
  const client = {
    send,
    on: (event: string, handler: (params: unknown) => void) => {
      handlers.set(event, handler);
      return () => handlers.delete(event);
    },
  } as unknown as CDPClient;
  return { client, calls };
}

const fast = { settleMs: 0, busyTries: 2, busyIntervalMs: 1 };

describe("changing the app's database through its own connection", () => {
  test("names match however the app spelled the file", () => {
    expect(normalizeSqliteFilename("file:/PresalioStore.sqlite3?vfs=opfs-sahpool")).toBe(
      "PresalioStore.sqlite3",
    );
    expect(normalizeSqliteFilename("/dir/app.db")).toBe("dir/app.db");
  });

  test("empties a referenced table, names the rows left behind, and sets foreign keys back", async () => {
    const { DB, SahPoolDb } = library();
    const conn = linked();
    const db = new (SahPoolDb as unknown as new (f: string, c: Conn) => FakeDb)(
      "/PresalioStore.sqlite3",
      conn,
    );
    const { client, calls } = fakePage([db], [DB, SahPoolDb, function unrelated() {}]);
    const outcome = await new LiveSqlite(client, fast).apply("PresalioStore.sqlite3", {
      kind: "sql",
      sql: 'DELETE FROM "product";',
    });
    expect(outcome).toEqual({
      status: "done",
      dangling: [{ table: "pack_item", parent: "product", rows: 3 }],
    });
    expect(count(conn, "product")).toBe(0);
    expect(
      Number((conn.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number }).foreign_keys),
    ).toBe(1);
    expect(calls).toContain("Target.detachFromTarget");
    expect(calls.at(-1)).toBe("Target.setAutoAttach");
  });

  test("a staged edit of a row that is gone changes nothing", async () => {
    const { DB } = library();
    const conn = linked();
    const db = new (DB as unknown as new (f: string, c: Conn) => FakeDb)("/app.db", conn);
    const { client } = fakePage([db], [DB]);
    const outcome = await new LiveSqlite(client, fast).apply("app.db", {
      kind: "changeset",
      statements: [
        'DELETE FROM "pack_item" WHERE "id" IS 1',
        `UPDATE "product" SET "name" = 'z' WHERE "id" IS 42`,
      ],
    });
    expect(outcome.status).toBe("failed");
    expect(outcome.status === "failed" && outcome.message).toContain("instead of one");
    expect(count(conn, "pack_item")).toBe(3);
  });

  test("emptying every table ignores the order of linked tables", async () => {
    const { DB } = library();
    const conn = linked();
    const db = new (DB as unknown as new (f: string, c: Conn) => FakeDb)("/app.db", conn);
    const { client } = fakePage([db], [DB]);
    const outcome = await new LiveSqlite(client, fast).apply("app.db", { kind: "every-table" });
    expect(outcome).toEqual({ status: "done", dangling: [] });
    expect(count(conn, "product") + count(conn, "pack_item")).toBe(0);
  });

  test("while the app holds a transaction open it is tried again, then left for a pause", async () => {
    const { DB } = library();
    const conn = linked();
    conn.exec("BEGIN");
    const db = new (DB as unknown as new (f: string, c: Conn) => FakeDb)("/app.db", conn);
    const { client } = fakePage([db], [DB]);
    const outcome = await new LiveSqlite(client, fast).apply("app.db", {
      kind: "sql",
      sql: 'DELETE FROM "product";',
    });
    expect(outcome.status).toBe("unavailable");
    expect(outcome.status === "unavailable" && outcome.reason).toContain("transaction open");
    conn.exec("ROLLBACK");
    expect(count(conn, "product")).toBe(2);
  });

  test("a database the app does not have open is left for a pause, naming what is open", async () => {
    const { DB } = library();
    const closed = new (DB as unknown as new (f: string, c: Conn) => FakeDb)("/old.db", linked());
    closed.pointer = undefined;
    const open = new (DB as unknown as new (f: string, c: Conn) => FakeDb)("/other.db", linked());
    const { client } = fakePage([closed, open], [DB]);
    const outcome = await new LiveSqlite(client, fast).apply("old.db", { kind: "every-table" });
    expect(outcome).toEqual({
      status: "unavailable",
      reason: "No sqlite-wasm connection of the app has it open (open: other.db).",
    });
  });
});
