import { DeviceEvaluationError, evaluateChecked } from "../evaluate.js";
import type { CDPClient } from "../client.js";
import {
  deleteScript,
  folderScript,
  foldersScript,
  type OPFSDeleteTarget,
} from "./opfs-files-scripts.js";

export type { OPFSDeleteTarget } from "./opfs-files-scripts.js";
export {
  OPFS_FOLDER_READ_LIMIT,
  OPFS_FOLDER_WALK_DEPTH,
  OPFS_FOLDER_WALK_LIMIT,
} from "./opfs-files-scripts.js";

/** One file or folder of a folder listing. */
export interface OPFSItem {
  name: string;
  /** From the OPFS root, without a leading slash. */
  path: string;
  kind: "file" | "directory";
  /** `null` for folders, and for files the phone could not open. */
  size: number | null;
  lastModified: number | null;
  /** The app holds the file open (a SQLite VFS sync access handle), so it could not be read. */
  locked?: boolean;
  /** Why the file could not be opened, in the phone's words. */
  unreadable?: string;
}

export interface OPFSFolderListing {
  /** The page's origin; OPFS belongs to it. */
  origin: string;
  path: string;
  entries: OPFSItem[];
  /** Entries in the folder; more than `entries.length` when the read stopped at its limit. */
  total: number;
}

/** One folder of the walk; the root has the empty path and depth 0. */
export interface OPFSFolderNode {
  path: string;
  name: string;
  depth: number;
  files: number;
  folders: number;
}

export interface OPFSFolderTree {
  origin: string;
  /** `false` when the page has no OPFS (not a secure page); `reason` says why. */
  available: boolean;
  reason?: string;
  folders: OPFSFolderNode[];
  /** The walk stopped at its folder or depth limit. */
  truncated: boolean;
}

export interface OPFSDeleteFailure {
  path: string;
  error: string;
}

/** What a delete did, by path: deleted, already gone, kept because changed or held open, failed. */
export interface OPFSDeleteResult {
  deleted: string[];
  gone: string[];
  changed: string[];
  busy: string[];
  failed: OPFSDeleteFailure[];
}

/** The folder is not on the phone any more (or is now a file). */
export class OPFSGoneError extends Error {
  override name = "OPFSGoneError";
}

/** The page shows another origin than the one read, or has no OPFS; nothing changed. */
export class OPFSWrongOriginError extends Error {
  override name = "OPFSWrongOriginError";
}

interface DeviceReply {
  error?: string;
  gone?: boolean;
  notFolder?: boolean;
  wrongOrigin?: boolean;
  unavailable?: boolean;
}

function parseReply<T>(raw: unknown): T & DeviceReply {
  if (typeof raw !== "string") throw new DeviceEvaluationError("The phone sent no answer");
  const reply = JSON.parse(raw) as T & DeviceReply;
  if (reply.error != null) {
    if (reply.gone || reply.notFolder) throw new OPFSGoneError(reply.error);
    if (reply.wrongOrigin || reply.unavailable) throw new OPFSWrongOriginError(reply.error);
    throw new DeviceEvaluationError(reply.error);
  }
  return reply;
}

/**
 * The origin private file system of the page, browsed and changed on the phone through
 * `Runtime.evaluate`, with host data entering scripts only as literals. Deletes check the page
 * still shows the origin that was read and refuse a file that changed since it was read.
 */
export class OPFSFilesDomain {
  constructor(private client: CDPClient) {}

  private async evaluate(expression: string): Promise<unknown> {
    const result = await evaluateChecked(this.client, {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    return result.result.value;
  }

  /** Every folder, breadth first (see `OPFS_FOLDER_WALK_LIMIT`). */
  async folders(): Promise<OPFSFolderTree> {
    const reply = parseReply<OPFSFolderTree>(await this.evaluate(foldersScript()));
    return {
      origin: reply.origin,
      available: reply.available,
      ...(reply.reason ? { reason: reply.reason } : {}),
      folders: reply.folders,
      truncated: reply.truncated,
    };
  }

  /** The entries of one folder; `origin` (when given) must still be the page's. */
  async folder(path: string, origin: string | null = null): Promise<OPFSFolderListing> {
    const reply = parseReply<OPFSFolderListing>(await this.evaluate(folderScript(origin, path)));
    return { origin: reply.origin, path: reply.path, entries: reply.entries, total: reply.total };
  }

  /** Deletes files and folders as the person saw them; see `OPFSDeleteResult`. */
  async remove(
    origin: string,
    targets: readonly OPFSDeleteTarget[],
    force = false,
  ): Promise<OPFSDeleteResult> {
    const reply = parseReply<OPFSDeleteResult>(
      await this.evaluate(deleteScript(origin, targets, force)),
    );
    return {
      deleted: reply.deleted,
      gone: reply.gone,
      changed: reply.changed,
      busy: reply.busy,
      failed: reply.failed,
    };
  }
}
