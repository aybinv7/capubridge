import type {
  GridColumn,
  GridColumnType,
  GridRow,
  GridRowState,
} from "@/shared/components/data/grid";
import { isDateText } from "@/shared/components/data/grid/editors/cellEdit";
import type { IndexedDBDecoratedRecord } from "@/modules/storage/changes/useIndexedDBChangeOverlay";
import { formatKeyLabel, serializeKey } from "@/modules/storage/changes/indexeddbChanges.service";

export const KEY_COLUMN = "__key";
export const VALUE_COLUMN = "__value";

const TYPE_SAMPLE = 50;

export type IdbKeyPath = string | string[] | null;

export interface IdbGridModel {
  columns: GridColumn[];
  rows: GridRow[];
  byId: ReadonlyMap<string, IndexedDBDecoratedRecord>;
  states: ReadonlyMap<string, GridRowState>;
  /** The field that holds the key, when the key is one top-level field of the record. */
  keyField: string | null;
}

/** A plain object record (not an array, not a `__type` marker for a Date, Blob, Map…). */
export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return typeof (value as { __type?: unknown }).__type !== "string";
}

/** The record's own key, ready to send back to the device (markers included). */
export function recordKey(record: { key: IDBValidKey; primaryKey?: IDBValidKey }): IDBValidKey {
  return record.primaryKey ?? record.key;
}

/** A row id from the record's key: stable across pages, never an index. */
export function rowIdOf(record: { key: IDBValidKey; primaryKey?: IDBValidKey }): string {
  return serializeKey(recordKey(record));
}

export function keyLabelOf(record: { key: IDBValidKey; primaryKey?: IDBValidKey }): string {
  const key = recordKey(record) as unknown;
  if (typeof key === "object" && key !== null && "__type" in key) {
    const marker = key as { __type: string; value?: unknown };
    return marker.__type === "Date" ? String(marker.value) : marker.__type;
  }
  return formatKeyLabel(recordKey(record));
}

function typeOf(value: unknown): GridColumnType | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "real";
  if (typeof value === "string") return isDateText(value) ? "date" : "text";
  if (typeof value === "object" && !Array.isArray(value)) {
    const type = (value as { __type?: unknown }).__type;
    if (type === "Date") return "date";
    if (typeof type === "string") return "blob";
  }
  return "json";
}

function columnType(values: readonly unknown[]): GridColumnType {
  const seen = new Set<GridColumnType>();
  for (const value of values) {
    const type = typeOf(value);
    if (type) seen.add(type);
    if (seen.size > 2) break;
  }
  if (seen.size === 0) return "unknown";
  if (seen.size === 1) return [...seen][0] ?? "unknown";
  if (seen.size === 2 && seen.has("integer") && seen.has("real")) return "real";
  return "text";
}

function keyPathText(keyPath: IdbKeyPath): string {
  if (keyPath === null) return "out-of-line key";
  return Array.isArray(keyPath) ? `[${keyPath.join(", ")}]` : keyPath;
}

/** The single top-level field that holds the key, or `null` (out-of-line, compound or nested). */
export function keyFieldOf(keyPath: IdbKeyPath): string | null {
  return typeof keyPath === "string" && keyPath !== "" && !keyPath.includes(".") ? keyPath : null;
}

function stateOf(record: IndexedDBDecoratedRecord): GridRowState | undefined {
  switch (record.__changeOperation) {
    case "add":
      return "added";
    case "update":
      return "updated";
    case "delete":
      return "deleted";
    default:
      return undefined;
  }
}

/**
 * Columns and rows for a page of IndexedDB records. Fields are the union over every record
 * on the page (not the first record's shape); the key gets its own column unless it is one
 * top-level field, which is then marked as the key. Row ids come from the key.
 */
export function buildIdbGrid(
  records: readonly IndexedDBDecoratedRecord[],
  keyPath: IdbKeyPath,
  indexPaths: ReadonlySet<string>,
): IdbGridModel {
  const fieldOrder: string[] = [];
  const fieldSamples = new Map<string, unknown[]>();
  const valueSamples: unknown[] = [];
  let hasNonObject = false;

  for (const record of records) {
    if (isPlainRecord(record.value)) {
      for (const [field, value] of Object.entries(record.value)) {
        let samples = fieldSamples.get(field);
        if (!samples) {
          samples = [];
          fieldSamples.set(field, samples);
          fieldOrder.push(field);
        }
        if (samples.length < TYPE_SAMPLE) samples.push(value);
      }
    } else {
      hasNonObject = true;
      if (valueSamples.length < TYPE_SAMPLE) valueSamples.push(record.value);
    }
  }

  const keyField = keyFieldOf(keyPath);
  const keyIsField = keyField !== null && fieldSamples.has(keyField);
  const columns: GridColumn[] = [];
  if (!keyIsField) {
    columns.push({
      id: KEY_COLUMN,
      title: keyPath === null ? "Key" : keyPathText(keyPath),
      type: "key",
      typeLabel: keyPathText(keyPath),
      primaryKey: true,
      readOnly: true,
    });
  }
  const orderedFields =
    keyIsField && keyField
      ? [keyField, ...fieldOrder.filter((field) => field !== keyField)]
      : fieldOrder;
  for (const field of orderedFields) {
    const isKey = field === keyField && keyIsField;
    columns.push({
      id: field,
      title: field,
      type: columnType(fieldSamples.get(field) ?? []),
      typeLabel: isKey ? `key · ${field}` : indexPaths.has(field) ? "indexed" : undefined,
      primaryKey: isKey,
      readOnly: isKey,
    });
  }
  if (hasNonObject || fieldOrder.length === 0) {
    columns.push({ id: VALUE_COLUMN, title: "Value", type: columnType(valueSamples) });
  }

  const rows: GridRow[] = [];
  const byId = new Map<string, IndexedDBDecoratedRecord>();
  const states = new Map<string, GridRowState>();
  for (const record of records) {
    let id = rowIdOf(record);
    if (byId.has(id)) id = `${id}#${rows.length}`;
    const cells: Record<string, unknown> = { [KEY_COLUMN]: recordKey(record) };
    if (isPlainRecord(record.value)) Object.assign(cells, record.value);
    else cells[VALUE_COLUMN] = record.value;
    rows.push({ id, cells });
    byId.set(id, record);
    const state = stateOf(record);
    if (state) states.set(id, state);
  }

  return { columns, rows, byId, states, keyField: keyIsField ? keyField : null };
}
