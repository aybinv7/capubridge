import { DeviceEvaluationError } from "../evaluate.js";
import type { IdbValueIssue } from "./indexeddb-codec.js";

export interface IDBRecord {
  key: IDBValidKey;
  primaryKey?: IDBValidKey;
  value: unknown;
  editable?: boolean;
  readOnlyReason?: string;
}

/** A record as the device encoder returns it: encoded parts and the first issue of each. */
export interface EncodedRecord {
  k: unknown;
  p: unknown;
  v: unknown;
  ik?: IdbValueIssue | null;
  ip?: IdbValueIssue | null;
  iv?: IdbValueIssue | null;
}

/** The app keeps the database open, so a delete or schema change could not run now. */
export class IdbBlockedError extends Error {
  override name = "IdbBlockedError";
}

/** A key edit would land on a key another record already uses; nothing was changed. */
export class IdbKeyConflictError extends Error {
  override name = "IdbKeyConflictError";
}

const INTO_TEXT = new Set(["Date", "BigInt", "RegExp"]);
const REVIVABLE_KEYS = new Set(["Date", "Number"]);

function article(type: string): string {
  return /^[AEIOU]/.test(type) ? "an" : "a";
}

function at(path: string): string {
  return path ? ` at "${path}"` : "";
}

/** A plain sentence saying why a record read with `issue` cannot be saved as a whole. */
export function idbReadOnlyReason(issue: IdbValueIssue): string {
  const { type, path } = issue;
  switch (type) {
    case "TooLarge":
      return "The value is larger than 1 MB, so only part of it was read.";
    case "PageBudget":
      return "This page holds too much data, so this value was not loaded. Open the record on its own to read it.";
    case "Reserved":
      return `Uses the reserved field name "__type"${at(path)}; saving it here could change what it means.`;
    case "Circular":
      return `Refers back to itself${at(path)}; saving it here would break that link.`;
    case "MaxDepth":
    case "MaxNodes":
      return `Is too deeply nested to read in full${at(path)}; saving it here would cut it short.`;
    case "Undefined":
      return `Holds undefined${at(path)}; saving the whole record here would drop it.`;
    case "Number":
      return `Holds a number JSON cannot carry${at(path)}; saving the whole record here would turn it into null.`;
    case "Unsupported":
      return `Holds a value this editor cannot read${at(path)}; saving the whole record here would lose it.`;
    default: {
      const outcome = INTO_TEXT.has(type) ? "text" : "a plain object";
      if (!path)
        return `Is ${article(type)} ${type}; saving it here would turn it into ${outcome}.`;
      return `Holds ${article(type)} ${type}${at(path)}; saving the whole record here would turn it into ${outcome}.`;
    }
  }
}

function keyIssueBlocksWrites(issue: IdbValueIssue, encodedKey: unknown): boolean {
  if (REVIVABLE_KEYS.has(issue.type)) return false;
  return !hasAllBinary(encodedKey);
}

function hasAllBinary(value: unknown): boolean {
  if (Array.isArray(value)) return value.every(hasAllBinary);
  if (!value || typeof value !== "object") return true;
  const marker = value as { __type?: unknown; base64?: unknown };
  if (typeof marker.__type !== "string") return true;
  if (marker.__type === "Date" || marker.__type === "Number") return true;
  return typeof marker.base64 === "string";
}

/**
 * Builds the host record from the device encoding. Keys whose markers the device can revive
 * (dates, binary sent in full) keep the record editable; any marker in the value does not.
 */
export function toRecord(encoded: EncodedRecord): IDBRecord {
  const key = encoded.k as IDBValidKey;
  const primaryKey = (encoded.p === undefined ? encoded.k : encoded.p) as IDBValidKey;
  let reason: string | undefined;
  if (encoded.iv) reason = idbReadOnlyReason(encoded.iv);
  else if (encoded.ip && keyIssueBlocksWrites(encoded.ip, encoded.p)) {
    reason = `Its key holds ${article(encoded.ip.type)} ${encoded.ip.type} that cannot be sent back to the phone.`;
  }
  return {
    key,
    primaryKey,
    value: encoded.v,
    editable: reason === undefined,
    ...(reason ? { readOnlyReason: reason } : {}),
  };
}

/** Parsed JSON a device script returned, or the device error it reported. */
export function parseDeviceReply<T>(result: { result: Record<string, unknown> }): T {
  const raw = result.result.value;
  if (typeof raw !== "string") throw new DeviceEvaluationError("The device sent no answer");
  const parsed = JSON.parse(raw) as T & { error?: unknown; blocked?: boolean; conflict?: boolean };
  if (parsed && typeof parsed === "object" && "error" in parsed && parsed.error != null) {
    const message = typeof parsed.error === "string" ? parsed.error : JSON.stringify(parsed.error);
    if (parsed.blocked) throw new IdbBlockedError(message);
    if (parsed.conflict) throw new IdbKeyConflictError(message);
    throw new DeviceEvaluationError(message);
  }
  return parsed;
}
