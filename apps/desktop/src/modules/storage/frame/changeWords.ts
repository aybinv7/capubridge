import type { DataChangeCounts } from "./dataFrame.types";

export const NO_CHANGES: DataChangeCounts = { add: 0, update: 0, delete: 0, total: 0 };

/** "2 added, 1 changed on the device" — what a change mark means, in words. */
export function describeChanges(changes: DataChangeCounts): string {
  const parts = [
    changes.add > 0 ? `${changes.add} added` : "",
    changes.update > 0 ? `${changes.update} changed` : "",
    changes.delete > 0 ? `${changes.delete} deleted` : "",
  ].filter(Boolean);
  return parts.length ? `${parts.join(", ")} on the device` : "No changes seen";
}

/** "just now", "12 s ago", "4 min ago", "2 h ago". */
export function formatAge(milliseconds: number): string {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds} s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} h ago`;
}
