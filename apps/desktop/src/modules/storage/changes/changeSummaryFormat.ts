/** Shared by the IndexedDB and SQLite explorers' sidebar change indicators. */
export interface StorageChangeSummaryLike {
  add: number;
  update: number;
  delete: number;
  total: number;
}

export function hasSummaryChanges(summary: StorageChangeSummaryLike): boolean {
  return summary.total > 0;
}

export function getSummarySegments(summary: StorageChangeSummaryLike) {
  return [
    { key: "add", count: summary.add, class: "bg-emerald-500" },
    { key: "update", count: summary.update, class: "bg-amber-500" },
    { key: "delete", count: summary.delete, class: "bg-red-500" },
  ].filter((entry) => entry.count > 0);
}

export function getDatabaseSummaryStyle(summary: StorageChangeSummaryLike) {
  if (summary.total === 0) return {};

  const color = summary.delete > 0 ? "239,68,68" : summary.update > 0 ? "245,158,11" : "16,185,129";

  return {
    background: `linear-gradient(90deg, rgba(${color}, 0.12), rgba(${color}, 0.035) 42%, transparent 92%)`,
  };
}

export function formatSummary(summary: StorageChangeSummaryLike): string {
  const parts = [
    summary.add > 0 ? `${summary.add} added` : "",
    summary.update > 0 ? `${summary.update} updated` : "",
    summary.delete > 0 ? `${summary.delete} deleted` : "",
  ].filter(Boolean);

  return parts.join(", ");
}
