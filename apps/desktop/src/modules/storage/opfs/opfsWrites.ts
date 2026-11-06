import { toast } from "vue-sonner";
import type { OPFSDeleteResult, OPFSDeleteTarget, OPFSFilesDomain } from "@capubridge/cdp-protocol";
import type { ConfirmRequest } from "@/shared/components/presentation/confirm";
import { isLiveDatabaseRole, type OpfsRow } from "./opfsModel";

function quoted(text: string): string {
  return `“${text}”`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const HELD_OPEN =
  "The app has it open (a live database). Close the app, or the database in it, then try again.";

/** What deleting these rows can do to the app beyond losing the files. */
export function deleteWarnings(rows: readonly OpfsRow[]): string[] {
  const warnings: string[] = [];
  if (rows.some((row) => row.role === "pool-slot")) {
    warnings.push(
      "A SAH-Pool slot holds a whole SQLite database: it goes with the slot, and the pool may refuse to open until the app sets it up again.",
    );
  }
  if (rows.some((row) => isLiveDatabaseRole(row.role) && row.role !== "pool-slot")) {
    warnings.push(
      "SQLite files belong together: deleting one while the app has the database open can corrupt or lose the app's data. Close the app first.",
    );
  }
  if (rows.some((row) => row.kind === "directory")) {
    warnings.push("A folder goes with everything inside it.");
  }
  return warnings;
}

/** The question every delete asks first, naming what goes, where, and what it can break. */
export function deleteQuestion(rows: readonly OpfsRow[], folder: string): ConfirmRequest {
  const single = rows.length === 1 ? rows[0] : undefined;
  const where = folder ? `the folder ${quoted(folder)}` : "the top of OPFS";
  const what = single
    ? `${single.kind === "directory" ? "The folder" : "The file"} ${quoted(single.name)}`
    : `${rows.length} items`;
  const warnings = deleteWarnings(rows);
  return {
    title: single ? `Delete ${quoted(single.name)}?` : `Delete ${rows.length} items?`,
    text: [
      `${what} ${single ? "is" : "are"} deleted from ${where} in the app's OPFS on the phone. This cannot be undone.`,
      ...warnings,
    ].join(" "),
    confirmLabel: single
      ? single.kind === "directory"
        ? "Delete folder"
        : "Delete file"
      : `Delete ${rows.length} items`,
    danger: true,
    ...(single ? {} : { details: rows.map((row) => row.name) }),
  };
}

function changedQuestion(count: number): ConfirmRequest {
  return {
    title: count === 1 ? "This file changed on the phone" : `${count} files changed on the phone`,
    text: "The app wrote to it after the list was read, so it is not what you saw. Delete it anyway?",
    confirmLabel: count === 1 ? "Delete it anyway" : "Delete them anyway",
    danger: true,
  };
}

function targetOf(row: OpfsRow): OPFSDeleteTarget {
  return { path: row.path, kind: row.kind, size: row.size, lastModified: row.lastModified };
}

function merged(first: OPFSDeleteResult, forced: OPFSDeleteResult | null): OPFSDeleteResult {
  if (!forced) return first;
  return {
    deleted: [...first.deleted, ...forced.deleted],
    gone: [...first.gone, ...forced.gone],
    changed: forced.changed,
    busy: [...first.busy, ...forced.busy],
    failed: [...first.failed, ...forced.failed],
  };
}

function reportSingle(row: OpfsRow, result: OPFSDeleteResult) {
  const name = quoted(row.name);
  if (result.deleted.length > 0) toast.success(`Deleted ${name} on the phone`);
  else if (result.gone.length > 0) toast.info(`${name} was already gone from the phone`);
  else if (result.busy.length > 0)
    toast.error(`${name} was not deleted`, { description: HELD_OPEN });
  else if (result.failed[0]) {
    toast.error(`${name} was not deleted`, { description: result.failed[0].error });
  } else toast.info("Nothing was deleted", { description: "The app's newer file was kept." });
}

function reportMany(result: OPFSDeleteResult) {
  const parts = [
    result.gone.length > 0 ? `${plural(result.gone.length, "was", "were")} already gone` : "",
    result.changed.length > 0 ? `${result.changed.length} changed on the phone and kept` : "",
    result.busy.length > 0 ? `${result.busy.length} held open by the app and kept` : "",
    result.failed.length > 0
      ? `${result.failed.length} failed: ${result.failed[0]?.error ?? "unknown error"}`
      : "",
  ].filter(Boolean);
  const description = parts.length ? `${parts.join("; ")}.` : undefined;
  if (result.deleted.length > 0) {
    toast.success(`Deleted ${plural(result.deleted.length, "item", "items")} on the phone`, {
      description,
    });
  } else if (result.busy.length + result.failed.length > 0) {
    toast.error("Nothing was deleted", { description });
  } else {
    toast.info("Nothing was deleted", { description });
  }
}

/**
 * Deletes in the folder on screen. The phone refuses a file the app wrote to since the list was
 * read; that is asked about in plain words and only then forced. A file the app holds open is
 * never forced. Success is reported after the phone answered; `forget` drops the local copies of
 * what is no longer on the phone.
 */
export function opfsWrites(
  domain: OPFSFilesDomain,
  origin: string,
  confirm: (request: ConfirmRequest) => Promise<boolean>,
  forget: (paths: readonly OpfsRow[]) => void,
) {
  /** Deletes `rows`; resolves how many are no longer on the phone (deleted or already gone). */
  async function removeRows(rows: readonly OpfsRow[]): Promise<number> {
    if (rows.length === 0) return 0;
    try {
      const first = await domain.remove(origin, rows.map(targetOf));
      let forced: OPFSDeleteResult | null = null;
      if (first.changed.length > 0 && (await confirm(changedQuestion(first.changed.length)))) {
        const again = rows.filter((row) => first.changed.includes(row.path)).map(targetOf);
        forced = await domain.remove(origin, again, true);
      }
      const result = merged(first, forced);
      const removed = new Set([...result.deleted, ...result.gone]);
      forget(rows.filter((row) => removed.has(row.path)));
      const single = rows.length === 1 ? rows[0] : undefined;
      if (single) reportSingle(single, result);
      else reportMany(result);
      return removed.size;
    } catch (error) {
      const single = rows.length === 1 ? rows[0] : undefined;
      toast.error(single ? `${quoted(single.name)} was not deleted` : "Nothing was deleted", {
        description: messageOf(error),
      });
      return 0;
    }
  }

  return { removeRows };
}
