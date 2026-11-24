import type { CDPClient } from "../client.js";
import {
  FIND_DB_PROTOTYPES,
  LIST_OPEN,
  LIVE_SQLITE_GROUP,
  RUN_CHANGE,
} from "./live-sqlite-scripts.js";

/** What to do through the app's connection. */
export type LiveSqliteChange =
  | { kind: "sql"; sql: string }
  | { kind: "every-table" }
  | { kind: "changeset"; statements: readonly string[] };

/** Rows of `table` whose foreign key points into `parent` at a row that is no longer there. */
export interface LiveDanglingRows {
  table: string;
  parent: string;
  rows: number;
}

/**
 * `done`: committed through the app's connection. `failed`: SQLite refused it and nothing was
 * changed; pausing the app would fail the same way. `unavailable`: the connection could not be
 * used (not found, held in a transaction), so the change may still be made with the app paused.
 */
export type LiveSqliteOutcome =
  | { status: "done"; dangling: LiveDanglingRows[] }
  | { status: "failed"; message: string }
  | { status: "unavailable"; reason: string };

export interface LiveSqliteOptions {
  /** How long to wait for the workers the page already runs to be announced. */
  settleMs?: number;
  /** How many times to try again while the app holds a transaction open, and how far apart. */
  busyTries?: number;
  busyIntervalMs?: number;
}

interface RemoteObject {
  objectId?: string;
  value?: unknown;
}

interface CallResult {
  result: RemoteObject;
  exceptionDetails?: { text?: string; exception?: { description?: string } };
}

interface Holder {
  sessionId: string;
  instancesId: string;
}

type RunResult = LiveSqliteOutcome | { status: "busy"; reason: string };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** How the app and Capubridge name the same database: no `file:`, query, or leading slash. */
export function normalizeSqliteFilename(name: string): string {
  return name
    .replace(/^file:/, "")
    .replace(/[?#].*$/, "")
    .replace(/^\/+/, "");
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function thrown(details: CallResult["exceptionDetails"]): string {
  return details?.exception?.description ?? details?.text ?? "The script threw";
}

/**
 * Changes an app's SQLite database through the app's own sqlite-wasm connection, while the app
 * runs: no reload, no file rewritten under it. The page's dedicated workers are attached for the
 * call only; the open `oo1.DB` connections are found by their prototype (`Runtime.queryObjects`,
 * which needs no global), and the change runs in one transaction as a fresh task of the worker
 * (see `RUN_CHANGE`). The app's own state in memory does not learn of the change until it reads.
 */
export class LiveSqlite {
  private readonly settleMs: number;
  private readonly busyTries: number;
  private readonly busyIntervalMs: number;

  constructor(
    private client: CDPClient,
    options: LiveSqliteOptions = {},
  ) {
    this.settleMs = options.settleMs ?? 200;
    this.busyTries = options.busyTries ?? 8;
    this.busyIntervalMs = options.busyIntervalMs ?? 250;
  }

  async apply(filename: string, change: LiveSqliteChange): Promise<LiveSqliteOutcome> {
    const wanted = normalizeSqliteFilename(filename);
    let sessions: string[];
    try {
      sessions = await this.attachWorkers();
    } catch (error) {
      return {
        status: "unavailable",
        reason: `The page's workers could not be reached (${messageOf(error)}).`,
      };
    }
    try {
      if (sessions.length === 0) {
        return {
          status: "unavailable",
          reason: "The page runs no worker, where sqlite-wasm keeps a database in OPFS open.",
        };
      }
      const holders: Holder[] = [];
      const seen = new Set<string>();
      for (const sessionId of sessions) {
        for (const found of await this.openIn(sessionId).catch(() => [])) {
          for (const name of found.names) seen.add(name);
          if (found.names.includes(wanted)) {
            holders.push({ sessionId, instancesId: found.instancesId });
          }
        }
      }
      if (holders.length === 0) {
        return {
          status: "unavailable",
          reason:
            seen.size > 0
              ? `No sqlite-wasm connection of the app has it open (open: ${[...seen].join(", ")}).`
              : "No sqlite-wasm connection was found in the page's workers.",
        };
      }
      if (holders.length > 1) {
        return {
          status: "unavailable",
          reason: "More than one connection of the app has it open.",
        };
      }
      return await this.runUntilFree(holders[0] as Holder, wanted, change).catch(
        (error: unknown): LiveSqliteOutcome => ({
          status: "failed",
          message: `The app's worker stopped answering (${messageOf(error)}), so it is not known whether the change was made. Read the database again before trying again.`,
        }),
      );
    } finally {
      await this.detach(sessions);
    }
  }

  private async attachWorkers(): Promise<string[]> {
    const sessions: string[] = [];
    const off = this.client.on("Target.attachedToTarget", (params) => {
      const event = params as { sessionId?: string; targetInfo?: { type?: string } };
      if (event.sessionId && event.targetInfo?.type === "worker") sessions.push(event.sessionId);
    });
    try {
      await this.client.send("Target.setAutoAttach", {
        autoAttach: true,
        waitForDebuggerOnStart: false,
        flatten: true,
      });
      await sleep(this.settleMs);
    } finally {
      off();
    }
    return sessions;
  }

  private async detach(sessions: readonly string[]) {
    for (const sessionId of sessions) {
      await this.client
        .send("Runtime.releaseObjectGroup", { objectGroup: LIVE_SQLITE_GROUP }, sessionId)
        .catch(() => undefined);
      await this.client.send("Target.detachFromTarget", { sessionId }).catch(() => undefined);
    }
    await this.client
      .send("Target.setAutoAttach", {
        autoAttach: false,
        waitForDebuggerOnStart: false,
        flatten: true,
      })
      .catch(() => undefined);
  }

  private call(
    sessionId: string,
    objectId: string,
    functionDeclaration: string,
    extra: Record<string, unknown> = {},
  ): Promise<CallResult> {
    return this.client.send<CallResult>(
      "Runtime.callFunctionOn",
      { objectId, functionDeclaration, objectGroup: LIVE_SQLITE_GROUP, ...extra },
      sessionId,
    );
  }

  private async instancesOf(sessionId: string, prototypeObjectId: string): Promise<string | null> {
    const { objects } = await this.client.send<{ objects: RemoteObject }>(
      "Runtime.queryObjects",
      { prototypeObjectId, objectGroup: LIVE_SQLITE_GROUP },
      sessionId,
    );
    return objects.objectId ?? null;
  }

  /** The open connections in one worker, per copy of sqlite-wasm. */
  private async openIn(sessionId: string): Promise<{ instancesId: string; names: string[] }[]> {
    const fnProto = await this.client.send<CallResult>(
      "Runtime.evaluate",
      { expression: "Function.prototype", objectGroup: LIVE_SQLITE_GROUP },
      sessionId,
    );
    if (!fnProto.result.objectId) return [];
    const functions = await this.instancesOf(sessionId, fnProto.result.objectId);
    if (!functions) return [];
    const prototypes = await this.call(sessionId, functions, FIND_DB_PROTOTYPES);
    if (prototypes.exceptionDetails || !prototypes.result.objectId) return [];
    const { result: entries } = await this.client.send<{
      result: { name: string; value?: RemoteObject }[];
    }>(
      "Runtime.getProperties",
      { objectId: prototypes.result.objectId, ownProperties: true },
      sessionId,
    );
    const out: { instancesId: string; names: string[] }[] = [];
    for (const entry of entries) {
      const prototypeId = /^\d+$/.test(entry.name) ? entry.value?.objectId : undefined;
      if (!prototypeId) continue;
      const instancesId = await this.instancesOf(sessionId, prototypeId);
      if (!instancesId) continue;
      const listed = await this.call(sessionId, instancesId, LIST_OPEN, { returnByValue: true });
      const names = Array.isArray(listed.result.value)
        ? listed.result.value.filter((name): name is string => typeof name === "string")
        : [];
      out.push({ instancesId, names });
    }
    return out;
  }

  private async runOnce(
    holder: Holder,
    filename: string,
    change: LiveSqliteChange,
  ): Promise<RunResult> {
    const ran = await this.call(holder.sessionId, holder.instancesId, RUN_CHANGE, {
      arguments: [{ value: { filename, change } }],
      awaitPromise: true,
      returnByValue: true,
    });
    if (ran.exceptionDetails) return { status: "failed", message: thrown(ran.exceptionDetails) };
    const value = ran.result.value as RunResult | undefined;
    if (!value || typeof value !== "object" || !("status" in value)) {
      return { status: "failed", message: "The app's worker gave no answer." };
    }
    return value;
  }

  private async runUntilFree(
    holder: Holder,
    filename: string,
    change: LiveSqliteChange,
  ): Promise<LiveSqliteOutcome> {
    let reason = "";
    for (let attempt = 0; attempt < this.busyTries; attempt++) {
      if (attempt > 0) await sleep(this.busyIntervalMs);
      const outcome = await this.runOnce(holder, filename, change);
      if (outcome.status !== "busy") return outcome;
      reason = outcome.reason;
    }
    const seconds = ((this.busyTries * this.busyIntervalMs) / 1000).toFixed(1);
    return {
      status: "unavailable",
      reason: `The app kept a transaction open on it for ${seconds} s (${reason}).`,
    };
  }
}
