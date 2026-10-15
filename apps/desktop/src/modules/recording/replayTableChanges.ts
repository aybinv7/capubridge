import type { DatabaseCapuEvent, TableChangeCapuData, TableChangeType } from "@/types/replay.types";

export interface ReplayTableChangeEntry {
  id: string;
  tMs: number;
  type: TableChangeType;
  affectedRows: number | null;
  affectedIds: Array<string | number> | null;
  transactionId: string | null;
}

export interface ReplayTableChangeGroup {
  key: string;
  transactionId: string | null;
  tMs: number;
  changes: ReplayTableChangeEntry[];
}

export interface ReplayTableChangeSource {
  id: string;
  kind: "tableChange";
  engine: TableChangeCapuData["engine"];
  table: string;
  label: string;
  recordCount: number;
  changes: ReplayTableChangeEntry[];
  counts: Record<TableChangeType, number>;
}

export interface ReplayTableChangeMarker {
  id: string;
  t: number;
  pct: number;
  type: TableChangeType;
  table: string;
  affectedRows: number | null;
  title: string;
}

export const TABLE_CHANGE_ORDER: TableChangeType[] = ["insert", "update", "delete", "bulk"];

export const TABLE_CHANGE_KIND_LABEL = "sqlite (changes)";

export const AFFECTED_IDS_PREVIEW = 6;

export function tableChangeSourceId(engine: string, table: string): string {
  return `tableChange:${engine}:${table}`;
}

function emptyCounts(): Record<TableChangeType, number> {
  return { insert: 0, update: 0, delete: 0, bulk: 0 };
}

export function buildTableChangeSources(events: DatabaseCapuEvent[]): ReplayTableChangeSource[] {
  const byId = new Map<string, ReplayTableChangeSource>();
  const sorted = events
    .filter((event) => event.data.kind === "tableChange")
    .sort((a, b) => a.t - b.t);

  for (let index = 0; index < sorted.length; index += 1) {
    const event = sorted[index];
    if (event.data.kind !== "tableChange") continue;
    const data = event.data;
    const id = tableChangeSourceId(data.engine, data.table);
    let source = byId.get(id);
    if (!source) {
      source = {
        id,
        kind: "tableChange",
        engine: data.engine,
        table: data.table,
        label: data.table,
        recordCount: 0,
        changes: [],
        counts: emptyCounts(),
      };
      byId.set(id, source);
    }
    source.changes.push({
      id: `${id}:${String(index)}`,
      tMs: event.t,
      type: data.type,
      affectedRows: data.affectedRows,
      affectedIds: data.affectedIds,
      transactionId: data.transactionId,
    });
    source.counts[data.type] += 1;
    source.recordCount = source.changes.length;
  }

  return Array.from(byId.values()).sort((a, b) => a.table.localeCompare(b.table));
}

export function groupTableChanges(changes: ReplayTableChangeEntry[]): ReplayTableChangeGroup[] {
  const groups: ReplayTableChangeGroup[] = [];
  const byTransaction = new Map<string, ReplayTableChangeGroup>();

  for (const change of changes) {
    if (change.transactionId === null) {
      groups.push({ key: change.id, transactionId: null, tMs: change.tMs, changes: [change] });
      continue;
    }
    const existing = byTransaction.get(change.transactionId);
    if (existing) {
      existing.changes.push(change);
      continue;
    }
    const group: ReplayTableChangeGroup = {
      key: `tx:${change.transactionId}`,
      transactionId: change.transactionId,
      tMs: change.tMs,
      changes: [change],
    };
    byTransaction.set(change.transactionId, group);
    groups.push(group);
  }

  return groups.sort((a, b) => a.tMs - b.tMs);
}

export function countChangesAtOrBefore(changes: ReplayTableChangeEntry[], positionMs: number) {
  let count = 0;
  for (const change of changes) if (change.tMs <= positionMs) count += 1;
  return count;
}

export function truncateAffectedIds(
  ids: Array<string | number> | null,
  limit: number = AFFECTED_IDS_PREVIEW,
): { shown: string[]; hidden: number } {
  if (!ids || ids.length === 0) return { shown: [], hidden: 0 };
  const shown = ids.slice(0, limit).map((id) => String(id));
  return { shown, hidden: Math.max(0, ids.length - shown.length) };
}

export function formatAffectedRows(change: Pick<ReplayTableChangeEntry, "affectedRows">): string {
  if (change.affectedRows === null) return "rows: n/a";
  return `${change.affectedRows.toLocaleString()} ${change.affectedRows === 1 ? "row" : "rows"}`;
}

export function tableChangeBadgeClass(type: TableChangeType): string {
  switch (type) {
    case "insert":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "update":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "delete":
      return "border-red-500/30 bg-red-500/10 text-red-300";
    case "bulk":
      return "border-violet-500/30 bg-violet-500/10 text-violet-300";
  }
}

export function tableChangeMarkerClass(type: TableChangeType): string {
  switch (type) {
    case "insert":
      return "bg-emerald-400/80";
    case "update":
      return "bg-amber-400/80";
    case "delete":
      return "bg-red-400/80";
    case "bulk":
      return "bg-violet-400/80";
  }
}

export function tableChangeSegmentClass(type: TableChangeType): string {
  switch (type) {
    case "insert":
      return "bg-emerald-500";
    case "update":
      return "bg-amber-500";
    case "delete":
      return "bg-red-500";
    case "bulk":
      return "bg-violet-500";
  }
}

export function buildTableChangeMarkers(
  events: DatabaseCapuEvent[],
  durationMs: number,
): ReplayTableChangeMarker[] {
  const markers: ReplayTableChangeMarker[] = [];
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event.data.kind !== "tableChange") continue;
    const rows = formatAffectedRows(event.data);
    markers.push({
      id: `db-${String(index)}`,
      t: event.t,
      pct: durationMs > 0 ? (event.t / durationMs) * 100 : 0,
      type: event.data.type,
      table: event.data.table,
      affectedRows: event.data.affectedRows,
      title: `${event.data.table} · ${event.data.type} · ${rows}`,
    });
  }
  return markers;
}
