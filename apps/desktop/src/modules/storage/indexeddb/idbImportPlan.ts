import type { IdbTransferRecord } from "@capubridge/cdp-protocol";
import type { IdbExportedDatabase } from "./idbTransfer.types";

/** Largest JSON one import call carries to the phone. */
export const IMPORT_CHUNK_BYTES = 4 * 1024 * 1024;
/** Binary data above this size travels in pieces ahead of its record. */
const STAGE_BINARY_FROM = 256 * 1024;
const BINARY_PIECE = 3 * 1024 * 1024;

export const V1_LOSS =
  "This file was saved by an older Capubridge: dates were saved as text, and binary data, Maps, Sets and Blobs as empty objects.";

const LOST_ENTIRELY: Record<string, string> = {
  Circular: "refers back to itself",
  MaxDepth: "was nested too deeply to save",
  MaxNodes: "had too many parts to save",
  TooLarge: "was too large to save",
  Unsupported: "is a kind of value that cannot be saved",
};

const BINARY_TYPES = new Set([
  "ArrayBuffer",
  "DataView",
  "Blob",
  "File",
  "Int8Array",
  "Uint8Array",
  "Uint8ClampedArray",
  "Int16Array",
  "Uint16Array",
  "Int32Array",
  "Uint32Array",
  "Float32Array",
  "Float64Array",
  "BigInt64Array",
  "BigUint64Array",
]);

type Marker = { __type: string; [field: string]: unknown };

function markerOf(value: unknown): Marker | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const type = (value as { __type?: unknown }).__type;
  return typeof type === "string" ? (value as Marker) : null;
}

function keyText(key: unknown): string {
  const marker = markerOf(key);
  if (marker?.__type === "Date") return String(marker["value"]);
  if (marker) return `${marker.__type} key`;
  return JSON.stringify(key) ?? String(key);
}

function joinPath(path: string, part: string | number): string {
  if (typeof part === "number") return `${path}[${part}]`;
  return path ? `${path}.${part}` : part;
}

function scanValue(value: unknown, path: string, found: (path: string, what: string) => void) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanValue(entry, joinPath(path, index), found));
    return;
  }
  if (!value || typeof value !== "object") return;
  const marker = markerOf(value);
  if (!marker) {
    for (const [field, entry] of Object.entries(value)) {
      scanValue(entry, joinPath(path, field), found);
    }
    return;
  }
  const lost = LOST_ENTIRELY[marker.__type];
  if (lost) return found(path, `${lost}; it is written as empty (null)`);
  if (marker.__type === "Error")
    return found(path, "is an Error; only its name and message are kept");
  if (BINARY_TYPES.has(marker.__type) && typeof marker["base64"] !== "string") {
    return found(path, `is ${marker.__type} data that was not saved; it is written empty`);
  }
  if (marker.__type === "Escaped") return scanValue(marker["value"], path, found);
  if (marker.__type === "Map" && Array.isArray(marker["entries"])) {
    return scanValue(marker["entries"], path, found);
  }
  if (marker.__type === "Set" && Array.isArray(marker["values"])) {
    return scanValue(marker["values"], path, found);
  }
}

/**
 * Every value a replace from this file would not restore exactly, one sentence each, naming
 * the store, the record and the field. A version 1 file can only say what it lost in general.
 */
export function exportLoss(data: IdbExportedDatabase): string[] {
  if (data.version === 1) return [V1_LOSS];
  const lines: string[] = [];
  for (const store of data.database.stores) {
    for (const record of store.records) {
      scanValue(record.value, "", (path, what) => {
        const where = path ? `"${path}" ` : "The value ";
        lines.push(`${store.name} · record ${keyText(record.key)}: ${where}${what}`);
      });
    }
  }
  return lines;
}

export interface StagedBinary {
  id: string;
  /** Base64 pieces, each a multiple of 4 characters, so each decodes on its own. */
  pieces: string[];
}

export interface PlannedChunk {
  records: IdbTransferRecord[];
  binaries: StagedBinary[];
  /** JSON characters of the records as sent. */
  bytes: number;
}

/** A record that stays larger than one transfer even without its binary data. */
export class IdbRecordTooLargeError extends Error {
  override name = "IdbRecordTooLargeError";
}

function splitBase64(base64: string): string[] {
  const pieces: string[] = [];
  for (let start = 0; start < base64.length; start += BINARY_PIECE) {
    pieces.push(base64.slice(start, start + BINARY_PIECE));
  }
  return pieces;
}

function stageBinaries(value: unknown, nextId: () => string, staged: StagedBinary[]): unknown {
  if (Array.isArray(value)) return value.map((entry) => stageBinaries(entry, nextId, staged));
  if (!value || typeof value !== "object") return value;
  const marker = markerOf(value);
  if (marker && typeof marker["base64"] === "string") {
    const base64 = marker["base64"];
    if (base64.length < STAGE_BINARY_FROM) return value;
    const id = nextId();
    staged.push({ id, pieces: splitBase64(base64) });
    const { base64: _sent, ...rest } = marker;
    return { ...rest, staged: id };
  }
  const out: Record<string, unknown> = {};
  for (const [field, entry] of Object.entries(value)) {
    out[field] = stageBinaries(entry, nextId, staged);
  }
  return out;
}

/**
 * Splits a store's records into chunks of at most `maxBytes` of JSON. A record too large on its
 * own sends its large binary values ahead in pieces; one still too large is refused before
 * anything is written. The file's records are never changed.
 */
export function* planImportChunks(
  records: readonly IdbTransferRecord[],
  options: { maxBytes?: number; idPrefix?: string } = {},
): Generator<PlannedChunk> {
  const maxBytes = options.maxBytes ?? IMPORT_CHUNK_BYTES;
  let counter = 0;
  const nextId = () => `${options.idPrefix ?? "b"}${(counter += 1)}`;
  let current: PlannedChunk = { records: [], binaries: [], bytes: 0 };
  for (const record of records) {
    let entry = record;
    let size = JSON.stringify(record).length;
    const binaries: StagedBinary[] = [];
    if (size > maxBytes) {
      entry = { key: record.key, value: stageBinaries(record.value, nextId, binaries) };
      size = JSON.stringify(entry).length;
      if (size > maxBytes) {
        throw new IdbRecordTooLargeError(
          `The record ${keyText(record.key)} holds ${Math.ceil(size / 1024 / 1024)} MB of data besides its files, more than one transfer to the phone can carry. Nothing was changed.`,
        );
      }
    }
    if (current.records.length > 0 && current.bytes + size > maxBytes) {
      yield current;
      current = { records: [], binaries: [], bytes: 0 };
    }
    current.records.push(entry);
    current.binaries.push(...binaries);
    current.bytes += size;
  }
  if (current.records.length > 0) yield current;
}
