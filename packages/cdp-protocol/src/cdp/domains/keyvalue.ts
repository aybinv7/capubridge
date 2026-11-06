import { DeviceEvaluationError, evaluateChecked } from "../evaluate.js";
import type { CDPClient } from "../client.js";
import { toRecord, type EncodedRecord } from "./indexeddb-records.js";
import {
  KEYVALUE_DELETE_BATCH,
  discoveryScript,
  forageDeleteScript,
  forageReadScript,
  forageWriteScript,
  storageDeleteScript,
  storageWriteScript,
  type KeyValueDeleteItem,
  type KeyValueWriteInput,
} from "./keyvalue-scripts.js";

export type { KeyValueDeleteItem, KeyValueWriteInput } from "./keyvalue-scripts.js";
export { FORAGE_READ_LIMIT, KEYVALUE_DELETE_BATCH } from "./keyvalue-scripts.js";

/** Local storage or Session storage of one origin. */
export type KeyValueArea = "local" | "session";

/** Where a key-value write lands. */
export type KeyValueTarget =
  | { kind: "area"; origin: string; area: KeyValueArea }
  | { kind: "forage"; origin: string; database: string; store: string };

/** One LocalForage store found in the page's IndexedDB. */
export interface KeyValueForageStore {
  database: string;
  store: string;
  count: number | null;
}

/** Every key-value source the page has. */
export interface KeyValueDiscovery {
  /** The main frame's origin; LocalForage stores belong to it. */
  pageOrigin: string;
  /** The page origin first, then the origins of its frames. */
  origins: string[];
  /** Keys in the page origin's Local and Session storage; `null` when it could not be read. */
  counts: { local: number | null; session: number | null };
  forage: KeyValueForageStore[];
  /** Why LocalForage stores could not all be listed. */
  forageError: string | null;
}

export interface KeyValueStorageEntry {
  key: string;
  value: string;
}

/** A LocalForage entry as the IndexedDB encoder returns it (markers for dates, blobs…). */
export interface KeyValueForageEntry {
  key: unknown;
  value: unknown;
  editable: boolean;
  readOnlyReason?: string;
}

export interface KeyValueForagePage {
  entries: KeyValueForageEntry[];
  /** More entries exist than were read. */
  more: boolean;
  total: number;
}

/** Every entry of one LocalForage store, with where it came from. */
export interface KeyValueForageStoreEntries extends KeyValueForageStore {
  page: KeyValueForagePage;
}

/** What made the device refuse a write; nothing was changed. */
export type KeyValueConflict = "exists" | "changed" | "gone";

/**
 * The device refused a write because the key is taken (`exists`), or the app changed
 * (`changed`) or deleted (`gone`) the value since it was read. Nothing was changed.
 */
export class KeyValueConflictError extends Error {
  override name = "KeyValueConflictError";
  constructor(
    readonly conflict: KeyValueConflict,
    message: string,
  ) {
    super(message);
  }
}

/** The origin is not in this page (any more), or the frame belongs to another origin. */
export class KeyValueWrongOriginError extends Error {
  override name = "KeyValueWrongOriginError";
}

/** How a write ended: `gone` when a delete found nothing to delete. */
export interface KeyValueWriteResult {
  gone: boolean;
}

/** What a batch delete did, as indexes into the keys it was given. */
export interface KeyValueDeleteResult {
  deleted: number[];
  /** Already gone from the phone. */
  gone: number[];
  /** Kept: the app changed the value after it was read. */
  changed: number[];
}

/** A batch delete failed part way; `done` says what the phone had deleted by then. */
export class KeyValueDeleteError extends Error {
  override name = "KeyValueDeleteError";
  constructor(
    message: string,
    readonly done: KeyValueDeleteResult,
  ) {
    super(message);
  }
}

export interface KeyValueDeleteOptions {
  /** Delete values the app changed since they were read (the person said yes). */
  force?: boolean;
  /** Called after each part of a long batch with how many keys were handled. */
  onProgress?: (done: number, total: number) => void;
}

interface FrameNode {
  frame?: { id?: string; securityOrigin?: string };
  childFrames?: FrameNode[];
}

interface DeviceReply {
  ok?: boolean;
  gone?: boolean;
  error?: string;
  conflict?: KeyValueConflict;
  wrongOrigin?: boolean;
}

function isRealOrigin(origin: string | undefined): origin is string {
  return Boolean(origin) && origin !== "null" && origin !== "://";
}

function collectFrames(node: FrameNode | undefined, out: { id: string; origin: string }[]) {
  if (!node) return;
  const origin = node.frame?.securityOrigin;
  if (node.frame?.id && isRealOrigin(origin)) out.push({ id: node.frame.id, origin });
  for (const child of node.childFrames ?? []) collectFrames(child, out);
}

function parseReply<T>(raw: unknown): T & DeviceReply {
  if (typeof raw !== "string") throw new DeviceEvaluationError("The phone sent no answer");
  const reply = JSON.parse(raw) as T & DeviceReply;
  if (reply.error != null) {
    if (reply.conflict) throw new KeyValueConflictError(reply.conflict, reply.error);
    if (reply.wrongOrigin) throw new KeyValueWrongOriginError(reply.error);
    throw new DeviceEvaluationError(reply.error);
  }
  return reply;
}

/**
 * Local storage, Session storage and LocalForage of a page, read and written on the phone.
 * Reads of Local and Session storage go through `DOMStorage`; every write is a script that
 * checks what the phone holds before it changes anything (see `KeyValueWriteInput`).
 */
export class KeyValueDomain {
  constructor(private client: CDPClient) {}

  private async evaluate(expression: string, contextId?: number): Promise<unknown> {
    const result = await evaluateChecked(this.client, {
      expression,
      awaitPromise: true,
      returnByValue: true,
      ...(contextId === undefined ? {} : { contextId }),
    });
    return result.result.value;
  }

  private async frames(): Promise<{ id: string; origin: string }[]> {
    const tree = await this.client.send<{ frameTree?: FrameNode }>("Page.getFrameTree");
    const frames: { id: string; origin: string }[] = [];
    collectFrames(tree.frameTree, frames);
    return frames;
  }

  /** Lists the page's origins, its storage counts and its LocalForage stores. */
  async discover(): Promise<KeyValueDiscovery> {
    await this.client.send("DOMStorage.enable");
    const page = parseReply<{
      origin: string;
      local: number | null;
      session: number | null;
      forage: KeyValueForageStore[];
      forageError: string | null;
    }>(await this.evaluate(discoveryScript()));
    const origins = [page.origin];
    try {
      for (const frame of await this.frames()) {
        if (!origins.includes(frame.origin)) origins.push(frame.origin);
      }
    } catch (error) {
      if (!isRealOrigin(page.origin)) throw error;
    }
    return {
      pageOrigin: page.origin,
      origins: origins.filter(isRealOrigin),
      counts: { local: page.local, session: page.session },
      forage: page.forage,
      forageError: page.forageError,
    };
  }

  /** Every key of one origin's Local or Session storage, values as stored. */
  async readArea(origin: string, area: KeyValueArea): Promise<KeyValueStorageEntry[]> {
    const result = await this.client.send<{ entries?: [string, string][] }>(
      "DOMStorage.getDOMStorageItems",
      { storageId: { securityOrigin: origin, isLocalStorage: area === "local" } },
    );
    return (result.entries ?? []).map(([key, value]) => ({ key, value }));
  }

  /** The entries of one LocalForage store, up to `FORAGE_READ_LIMIT`. */
  async readForage(origin: string, database: string, store: string): Promise<KeyValueForagePage> {
    const reply = parseReply<{ records: EncodedRecord[]; more: boolean; total: number }>(
      await this.evaluate(forageReadScript(origin, database, store)),
    );
    return {
      entries: reply.records.map((encoded) => {
        const record = toRecord(encoded);
        return {
          key: record.primaryKey ?? record.key,
          value: record.value,
          editable: record.editable !== false,
          ...(record.readOnlyReason ? { readOnlyReason: record.readOnlyReason } : {}),
        };
      }),
      more: reply.more,
      total: reply.total,
    };
  }

  /**
   * The entries of every LocalForage store of the page, found by `discover` and read with
   * `readForage`: no database is created or upgraded and LocalForage itself is never called.
   * Resolves nothing when the page no longer shows `origin` (when given).
   */
  async readAllForage(origin?: string): Promise<KeyValueForageStoreEntries[]> {
    const found = await this.discover();
    if (origin !== undefined && found.pageOrigin !== origin) return [];
    const out: KeyValueForageStoreEntries[] = [];
    for (const store of found.forage) {
      out.push({
        ...store,
        page: await this.readForage(found.pageOrigin, store.database, store.store),
      });
    }
    return out;
  }

  /** The frame context to write `origin`'s storage in: the page itself, or an isolated world of a frame. */
  private async contextFor(origin: string): Promise<number | undefined> {
    const frames = await this.frames();
    if (frames[0]?.origin === origin) return undefined;
    const frame = frames.find((entry) => entry.origin === origin);
    if (!frame) {
      throw new KeyValueWrongOriginError(
        `No frame of this page belongs to ${origin} any more; nothing was changed`,
      );
    }
    const world = await this.client.send<{ executionContextId: number }>(
      "Page.createIsolatedWorld",
      { frameId: frame.id, worldName: "capubridge-keyvalue" },
    );
    return world.executionContextId;
  }

  /**
   * Deletes keys of one list, `KEYVALUE_DELETE_BATCH` at a time, resolving the frame once. A key
   * whose value is not what the person saw (`expected`) is kept unless `force`.
   */
  async deleteMany(
    target: KeyValueTarget,
    items: readonly KeyValueDeleteItem[],
    options: KeyValueDeleteOptions = {},
  ): Promise<KeyValueDeleteResult> {
    const force = options.force === true;
    const contextId = target.kind === "area" ? await this.contextFor(target.origin) : undefined;
    const out: KeyValueDeleteResult = { deleted: [], gone: [], changed: [] };
    for (let start = 0; start < items.length; start += KEYVALUE_DELETE_BATCH) {
      const part = items.slice(start, start + KEYVALUE_DELETE_BATCH);
      const script =
        target.kind === "area"
          ? storageDeleteScript(target.origin, target.area, part, force)
          : forageDeleteScript(target.origin, target.database, target.store, part, force);
      let reply: KeyValueDeleteResult;
      try {
        reply = parseReply<KeyValueDeleteResult>(await this.evaluate(script, contextId));
      } catch (error) {
        if (start === 0) throw error;
        throw new KeyValueDeleteError(error instanceof Error ? error.message : String(error), out);
      }
      out.deleted.push(...reply.deleted.map((index) => start + index));
      out.gone.push(...reply.gone.map((index) => start + index));
      out.changed.push(...reply.changed.map((index) => start + index));
      options.onProgress?.(start + part.length, items.length);
    }
    return out;
  }

  /**
   * Writes, renames or deletes one key on the phone. Throws `KeyValueConflictError` when the
   * phone holds something the person did not see (see `KeyValueWriteInput`); nothing changes then.
   */
  async write(target: KeyValueTarget, input: KeyValueWriteInput): Promise<KeyValueWriteResult> {
    if (target.kind === "area") {
      const contextId = await this.contextFor(target.origin);
      const reply = parseReply<object>(
        await this.evaluate(storageWriteScript(target.origin, target.area, input), contextId),
      );
      return { gone: reply.gone === true };
    }
    const reply = parseReply<object>(
      await this.evaluate(forageWriteScript(target.origin, target.database, target.store, input)),
    );
    return { gone: reply.gone === true };
  }
}
