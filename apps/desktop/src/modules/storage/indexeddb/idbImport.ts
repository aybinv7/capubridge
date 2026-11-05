import {
  IdbBlockedError,
  importCopyChunk,
  importPutChunk,
  importReplaceSchema,
  importStageBegin,
  importStageBinary,
  importStageDiscard,
  type CDPClient,
  type IdbSchema,
} from "@capubridge/cdp-protocol";
import { exportLoss, planImportChunks } from "./idbImportPlan";
import type {
  IdbExportedDatabase,
  IdbImportOptions,
  IdbTransferOptions,
} from "./idbTransfer.types";

/** The real database was deleted and only part of the file is in it. The staged copy is kept. */
export class IdbPartialImportError extends Error {
  override name = "IdbPartialImportError";

  constructor(
    message: string,
    readonly state: IdbPendingImport,
  ) {
    super(message);
  }
}

/** What a failed replace leaves behind, enough to finish it or throw the staged copy away. */
export interface IdbPendingImport {
  origin: string;
  stage: string;
  target: string;
  schema: IdbSchema;
  /** `schema`: the database may be missing or empty; `copy`: stores before `fromStore` are done. */
  phase: "schema" | "copy";
  fromStore: number;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  const error = new Error("The transfer was cancelled");
  error.name = "AbortError";
  throw error;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function stageName(): string {
  return `__capubridge_import_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function schemaOf(data: IdbExportedDatabase, target: string): IdbSchema {
  return {
    name: target,
    version: data.database.version,
    stores: data.database.stores.map((store) => ({
      name: store.name,
      keyPath: store.keyPath,
      autoIncrement: store.autoIncrement,
      indexes: store.indexes,
    })),
  };
}

async function discardQuietly(client: CDPClient, origin: string, stage: string) {
  try {
    await importStageDiscard(client, { origin, stage });
  } catch {
    return;
  }
}

async function writeStage(
  client: CDPClient,
  data: IdbExportedDatabase,
  origin: string,
  stage: string,
  options: IdbImportOptions & { totalBytes?: number | null },
) {
  const stores = data.database.stores;
  let bytes = 0;
  for (const [storeIndex, store] of stores.entries()) {
    let records = 0;
    for (const chunk of planImportChunks(store.records, { idPrefix: `${storeIndex}-` })) {
      throwIfAborted(options.signal);
      for (const binary of chunk.binaries) {
        for (const base64 of binary.pieces) {
          throwIfAborted(options.signal);
          await importStageBinary(client, { origin, id: binary.id, base64 });
        }
      }
      records += await importPutChunk(client, {
        origin,
        database: stage,
        store: store.name,
        records: chunk.records,
        revive: data.version === 2,
        acceptLoss: options.acceptLoss === true,
      });
      bytes += chunk.bytes;
      options.onProgress?.({
        phase: "check",
        store: store.name,
        storeIndex,
        storeCount: stores.length,
        records,
        bytes,
        totalBytes: options.totalBytes ?? null,
      });
    }
  }
}

async function copyStores(
  client: CDPClient,
  pending: IdbPendingImport,
  options: IdbTransferOptions,
): Promise<number> {
  const stores = pending.schema.stores;
  let written = 0;
  for (let storeIndex = pending.fromStore; storeIndex < stores.length; storeIndex += 1) {
    const store = stores[storeIndex];
    if (!store) continue;
    let after: unknown = null;
    let records = 0;
    try {
      for (;;) {
        const chunk = await importCopyChunk(client, {
          origin: pending.origin,
          from: pending.stage,
          to: pending.target,
          store: store.name,
          after,
        });
        records += chunk.copied;
        options.onProgress?.({
          phase: "write",
          store: store.name,
          storeIndex,
          storeCount: stores.length,
          records,
          bytes: 0,
          totalBytes: null,
        });
        if (chunk.next === null) break;
        after = chunk.next;
      }
    } catch (error) {
      const done = stores.slice(0, storeIndex).map((entry) => entry.name);
      throw new IdbPartialImportError(
        `"${pending.target}" on the phone is incomplete: ${done.length ? `${done.join(", ")} ${done.length === 1 ? "is" : "are"} written, ` : ""}"${store.name}" and the stores after it are not. The file is still on the phone, ready to finish. ${message(error)}`,
        { ...pending, phase: "copy", fromStore: storeIndex },
      );
    }
    written += records;
  }
  return written;
}

async function commit(
  client: CDPClient,
  pending: IdbPendingImport,
  options: IdbTransferOptions,
): Promise<{ inserted: number }> {
  if (pending.phase === "schema") {
    try {
      await importReplaceSchema(client, { origin: pending.origin, schema: pending.schema });
    } catch (error) {
      if (error instanceof IdbBlockedError) throw error;
      throw new IdbPartialImportError(
        `"${pending.target}" on the phone may be missing or empty: it was being replaced when the phone answered "${message(error)}". The file is still on the phone, ready to finish.`,
        pending,
      );
    }
  }
  const inserted = await copyStores(client, { ...pending, phase: "copy" }, options);
  await discardQuietly(client, pending.origin, pending.stage);
  return { inserted };
}

/**
 * Replaces the database `targetName` on the phone (the one the person chose, never the name
 * inside the file). The whole file is first written to a scratch database on the phone, which
 * proves every record can be stored while the real database is still intact; a failure or a
 * cancel up to then changes nothing. Only then is the database replaced and filled from the
 * scratch copy, on the phone. A failure from there throws `IdbPartialImportError`, whose
 * state `finishImport` completes. A lossy file is refused unless `acceptLoss` is set.
 */
export async function importDatabaseReplace(
  client: CDPClient,
  data: IdbExportedDatabase,
  targetName: string,
  origin: string,
  options: IdbImportOptions & { totalBytes?: number | null } = {},
): Promise<{ inserted: number }> {
  const loss = exportLoss(data);
  if (loss.length > 0 && options.acceptLoss !== true) {
    throw new Error(
      `Refused: ${loss.length === 1 ? "one value" : `${loss.length} values`} in this file would not be restored exactly. ${loss[0]}`,
    );
  }
  throwIfAborted(options.signal);
  const schema = schemaOf(data, targetName);
  const stage = stageName();
  await importStageBegin(client, { origin, stage, schema: { ...schema, name: stage } });
  try {
    await writeStage(client, data, origin, stage, options);
    throwIfAborted(options.signal);
  } catch (error) {
    await discardQuietly(client, origin, stage);
    throw error;
  }
  options.onCommit?.();
  try {
    return await commit(
      client,
      { origin, stage, target: targetName, schema, phase: "schema", fromStore: 0 },
      options,
    );
  } catch (error) {
    if (!(error instanceof IdbPartialImportError)) await discardQuietly(client, origin, stage);
    throw error;
  }
}

/** Finishes a replace that stopped half way, from the copy still staged on the phone. */
export function finishImport(
  client: CDPClient,
  pending: IdbPendingImport,
  options: IdbTransferOptions = {},
): Promise<{ inserted: number }> {
  return commit(client, pending, options);
}

/** Throws away the staged copy of a replace that will not be finished. */
export function discardImport(client: CDPClient, pending: IdbPendingImport): Promise<void> {
  return importStageDiscard(client, { origin: pending.origin, stage: pending.stage });
}
