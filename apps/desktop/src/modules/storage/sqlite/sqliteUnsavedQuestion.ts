import type { ConfirmRequest } from "@/shared/components/presentation/confirm";

interface Staged {
  table: string;
  count: number;
}

function changes(count: number): string {
  return count === 1 ? "1 change" : `${count} changes`;
}

/** "3 changes to “orders” and 1 change to “items”", or `null` when nothing is staged. */
export function stagedText(staged: readonly Staged[]): string | null {
  const parts = staged
    .filter((entry) => entry.count > 0)
    .map((entry) => `${changes(entry.count)} to “${entry.table}”`);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0] ?? null;
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function isOne(staged: readonly Staged[]): boolean {
  return staged.reduce((sum, entry) => sum + entry.count, 0) === 1;
}

/**
 * What closing an opened file asks when it would drop something: staged edits on screen, or
 * changes its working copy holds that never reached the file (`unsavedTo`). `null` when
 * closing loses nothing.
 */
export function closeFileQuestion(
  name: string,
  staged: readonly Staged[],
  unsavedTo: string | null,
): ConfirmRequest | null {
  const pending = stagedText(staged);
  if (!pending && !unsavedTo) return null;
  const lines: string[] = [];
  if (pending) lines.push(`${pending} ${isOne(staged) ? "is" : "are"} not saved.`);
  if (unsavedTo) lines.push(`Changes made here are not written to ${unsavedTo}.`);
  lines.push("Closing the file drops them; the file keeps what it had when it was last saved.");
  return {
    title: `Close “${name}” without saving?`,
    text: lines.join(" "),
    confirmLabel: "Close without saving",
    danger: true,
  };
}

/** The line a sidebar write adds to its confirmation when it drops staged edits, or `""`. */
export function droppedLine(staged: readonly Staged[]): string {
  const pending = stagedText(staged);
  return pending ? ` ${pending} not saved ${isOne(staged) ? "is" : "are"} dropped.` : "";
}

/** What closing the window asks while edits are staged or files are not written. */
export function closeWindowQuestion(
  stagedCount: number,
  unsavedFiles: readonly string[],
): ConfirmRequest | null {
  if (stagedCount === 0 && unsavedFiles.length === 0) return null;
  const lines: string[] = [];
  if (stagedCount > 0) {
    lines.push(
      `${changes(stagedCount)} in the Data tab ${stagedCount === 1 ? "is" : "are"} not saved.`,
    );
  }
  if (unsavedFiles.length > 0) {
    lines.push(`Changes made here are not written to ${unsavedFiles.join(", ")}.`);
  }
  lines.push("Closing Capubridge drops them.");
  return {
    title: "Close Capubridge without saving?",
    text: lines.join(" "),
    confirmLabel: "Close without saving",
    danger: true,
  };
}

function quotedList(names: readonly string[]): string {
  const quoted = names.map((name) => `“${name}”`);
  if (quoted.length <= 1) return quoted[0] ?? "";
  return `${quoted.slice(0, -1).join(", ")} and ${quoted[quoted.length - 1]}`;
}

/**
 * What leaving staged edits behind asks: leaving the database (`Leaving drops them.`) or closing
 * a table's tab (`Closing the tab drops them.`). `null` when nothing is staged. Switching tables
 * or tabs never asks: the edits wait in the unsaved store.
 */
export function leaveQuestion(
  staged: readonly Staged[],
  consequence = "Leaving drops them.",
): ConfirmRequest | null {
  const kept = staged.filter((entry) => entry.count > 0);
  const total = kept.reduce((sum, entry) => sum + entry.count, 0);
  if (total === 0) return null;
  return {
    title: total === 1 ? "Leave 1 change unsaved?" : `Leave ${total} changes unsaved?`,
    text: `The changes to ${quotedList(kept.map((entry) => entry.table))} are not in the file yet. ${consequence}`,
    confirmLabel: "Drop the changes",
    danger: true,
  };
}
