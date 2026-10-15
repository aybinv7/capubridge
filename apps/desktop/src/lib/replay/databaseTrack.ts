import type {
  CapuEvent,
  DatabaseCapuData,
  DatabaseCapuEvent,
  LocalStorageCapuData,
  TableChangeCapuData,
  TableChangeType,
} from "@/types/replay.types";

const LOCAL_STORAGE_REASONS = new Set(["initial", "change", "final"]);
const TABLE_CHANGE_TYPES = new Set<TableChangeType>(["insert", "update", "delete", "bulk"]);

export interface DatabaseTrackResult {
  events: DatabaseCapuEvent[];
  skippedKinds: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isLocalStorageEntry(value: unknown): boolean {
  return isRecord(value) && typeof value.key === "string" && typeof value.value === "string";
}

function isAffectedId(value: unknown): value is string | number {
  return typeof value === "string" || (typeof value === "number" && Number.isFinite(value));
}

function localStorageError(data: Record<string, unknown>): string | null {
  if (typeof data.origin !== "string") return "localStorage.origin must be a string";
  if (!Array.isArray(data.entries) || !data.entries.every(isLocalStorageEntry)) {
    return "localStorage.entries must be an array of { key, value } strings";
  }
  if (typeof data.reason !== "string" || !LOCAL_STORAGE_REASONS.has(data.reason)) {
    return "localStorage.reason must be initial, change or final";
  }
  return null;
}

function tableChangeError(data: Record<string, unknown>): string | null {
  if (data.engine !== "sqlite") return "tableChange.engine must be sqlite";
  if (typeof data.table !== "string" || data.table.length === 0) {
    return "tableChange.table must be a non-empty string";
  }
  if (typeof data.type !== "string" || !TABLE_CHANGE_TYPES.has(data.type as TableChangeType)) {
    return "tableChange.type must be insert, update, delete or bulk";
  }
  if (
    data.affectedRows !== null &&
    (typeof data.affectedRows !== "number" ||
      !Number.isInteger(data.affectedRows) ||
      data.affectedRows < 0)
  ) {
    return "tableChange.affectedRows must be a non-negative integer or null";
  }
  if (
    data.affectedIds !== null &&
    (!Array.isArray(data.affectedIds) || !data.affectedIds.every(isAffectedId))
  ) {
    return "tableChange.affectedIds must be an array of strings or numbers, or null";
  }
  if (data.transactionId !== null && typeof data.transactionId !== "string") {
    return "tableChange.transactionId must be a string or null";
  }
  return null;
}

export function describeDatabaseEventError(data: unknown): string | null {
  if (!isRecord(data)) return "data must be an object";
  if (typeof data.kind !== "string") return "data.kind must be a string";
  if (data.kind === "localStorage") return localStorageError(data);
  if (data.kind === "tableChange") return tableChangeError(data);
  return null;
}

function isKnownKind(data: unknown): data is DatabaseCapuData {
  return isRecord(data) && (data.kind === "localStorage" || data.kind === "tableChange");
}

export function validateDatabaseTrack(events: CapuEvent<unknown>[]): DatabaseTrackResult {
  const accepted: DatabaseCapuEvent[] = [];
  const skippedKinds: string[] = [];

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const message = describeDatabaseEventError(event.data);
    if (message) {
      throw new Error("Corrupt databases track at event " + String(index + 1) + ": " + message);
    }
    if (!isKnownKind(event.data)) {
      skippedKinds.push(String((event.data as Record<string, unknown>).kind));
      continue;
    }
    accepted.push({ t: event.t, data: event.data });
  }

  return { events: accepted, skippedKinds };
}

export function isLocalStorageData(data: DatabaseCapuData): data is LocalStorageCapuData {
  return data.kind === "localStorage";
}

export function isTableChangeData(data: DatabaseCapuData): data is TableChangeCapuData {
  return data.kind === "tableChange";
}
