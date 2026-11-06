import { jsLiteral } from "../evaluate.js";

/** How many entries of one folder a read describes at most. */
export const OPFS_FOLDER_READ_LIMIT = 5000;

/** How many folders the folder walk lists at most, and how deep it goes. */
export const OPFS_FOLDER_WALK_LIMIT = 500;
export const OPFS_FOLDER_WALK_DEPTH = 12;

/** One file or folder to delete, as the person saw it. */
export interface OPFSDeleteTarget {
  path: string;
  kind: "file" | "directory";
  /** Bytes and modification time read with the list; `null` when the phone did not say. */
  size: number | null;
  lastModified: number | null;
}

/**
 * Helpers every OPFS files script shares. Failures carry the DOMException name in plain flags:
 * `gone` (not found), `notFolder` (a file where a folder was expected) and `busy` (the app holds
 * the file open, as a SQLite VFS does with a sync access handle).
 */
const HELPERS = String.raw`
function __opfsParts(path) {
  return String(path).split('/').filter(Boolean);
}
async function __opfsDir(parts) {
  let dir = await navigator.storage.getDirectory();
  for (const part of parts) dir = await dir.getDirectoryHandle(part);
  return dir;
}
function __opfsName(e) {
  return e && e.name ? e.name : '';
}
function __opfsMessage(e) {
  return e && e.message ? e.message : String(e);
}
function __opfsBusy(e) {
  const name = __opfsName(e);
  return name === 'NoModificationAllowedError' || name === 'InvalidModificationError';
}
function __opfsFailure(e) {
  const name = __opfsName(e);
  return JSON.stringify({
    error: __opfsMessage(e),
    gone: name === 'NotFoundError',
    notFolder: name === 'TypeMismatchError',
    busy: __opfsBusy(e),
  });
}
function __opfsGuard(origin) {
  if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.getDirectory !== 'function') {
    return JSON.stringify({ error: 'This page has no OPFS: it needs a secure page (https or localhost)', unavailable: true });
  }
  if (origin !== null && location.origin !== origin) {
    return JSON.stringify({ error: 'The page now shows ' + location.origin + ', not ' + origin + '; nothing was changed', wrongOrigin: true });
  }
  return null;
}
`;

/**
 * Every folder of the origin's OPFS, breadth first from the root: its path, depth and how many
 * files and folders it holds. Only folders are walked (no file is opened), up to
 * `OPFS_FOLDER_WALK_LIMIT` folders and `OPFS_FOLDER_WALK_DEPTH` levels.
 */
export function foldersScript(): string {
  return `(async () => {
    ${HELPERS}
    try {
      const refused = __opfsGuard(null);
      if (refused) return JSON.stringify({ origin: location.origin, available: false, folders: [], truncated: false, reason: JSON.parse(refused).error });
      const root = await navigator.storage.getDirectory();
      const folders = [];
      const queue = [{ path: '', name: '', depth: 0, dir: root }];
      let truncated = false;
      while (queue.length > 0) {
        const current = queue.shift();
        let files = 0;
        let subfolders = 0;
        for await (const [name, handle] of current.dir.entries()) {
          if (handle.kind !== 'directory') { files++; continue; }
          subfolders++;
          if (current.depth + 1 > ${OPFS_FOLDER_WALK_DEPTH}) { truncated = true; continue; }
          if (folders.length + queue.length + 1 >= ${OPFS_FOLDER_WALK_LIMIT}) { truncated = true; continue; }
          queue.push({ path: current.path ? current.path + '/' + name : name, name, depth: current.depth + 1, dir: handle });
        }
        folders.push({ path: current.path, name: current.name, depth: current.depth, files, folders: subfolders });
      }
      return JSON.stringify({ origin: location.origin, available: true, folders, truncated });
    } catch (e) {
      return __opfsFailure(e);
    }
  })()`;
}

/**
 * The entries of one folder: up to `OPFS_FOLDER_READ_LIMIT`, files with their size and
 * modification time read in parallel. A file the app holds open is listed as `locked`.
 */
export function folderScript(origin: string | null, path: string): string {
  return `(async () => {
    ${HELPERS}
    const origin = ${jsLiteral(origin)};
    const path = ${jsLiteral(path)};
    try {
      const refused = __opfsGuard(origin);
      if (refused) return refused;
      const dir = await __opfsDir(__opfsParts(path));
      const handles = [];
      let total = 0;
      for await (const [name, handle] of dir.entries()) {
        total++;
        if (handles.length < ${OPFS_FOLDER_READ_LIMIT}) handles.push([name, handle]);
      }
      const entries = await Promise.all(handles.map(async (pair) => {
        const name = pair[0];
        const handle = pair[1];
        const itemPath = path ? path + '/' + name : name;
        if (handle.kind === 'directory') {
          return { name, path: itemPath, kind: 'directory', size: null, lastModified: null };
        }
        try {
          const file = await handle.getFile();
          return { name, path: itemPath, kind: 'file', size: file.size, lastModified: file.lastModified };
        } catch (e) {
          return { name, path: itemPath, kind: 'file', size: null, lastModified: null, locked: __opfsBusy(e), unreadable: __opfsMessage(e) };
        }
      }));
      return JSON.stringify({ origin: location.origin, path, entries, total });
    } catch (e) {
      return __opfsFailure(e);
    }
  })()`;
}

/**
 * Deletes files and folders of the origin's OPFS. A file whose size or modification time is not
 * what the person saw is kept (listed in `changed`) unless `force`; one the app holds open is
 * listed in `busy`; one already gone in `gone`. Folders go with everything inside them.
 */
export function deleteScript(
  origin: string,
  targets: readonly OPFSDeleteTarget[],
  force: boolean,
): string {
  return `(async () => {
    ${HELPERS}
    const origin = ${jsLiteral(origin)};
    const targets = ${jsLiteral(targets)};
    const force = ${jsLiteral(force)};
    try {
      const refused = __opfsGuard(origin);
      if (refused) return refused;
      const result = { deleted: [], gone: [], changed: [], busy: [], failed: [] };
      for (const target of targets) {
        const parts = __opfsParts(target.path);
        const name = parts.pop();
        if (!name) { result.failed.push({ path: target.path, error: 'The root folder cannot be deleted' }); continue; }
        let dir;
        let handle;
        try {
          dir = await __opfsDir(parts);
          handle = target.kind === 'directory' ? await dir.getDirectoryHandle(name) : await dir.getFileHandle(name);
        } catch (e) {
          if (__opfsName(e) === 'NotFoundError') result.gone.push(target.path);
          else if (__opfsName(e) === 'TypeMismatchError') result.changed.push(target.path);
          else result.failed.push({ path: target.path, error: __opfsMessage(e) });
          continue;
        }
        if (!force && target.kind === 'file' && target.size !== null) {
          try {
            const file = await handle.getFile();
            if (file.size !== target.size || file.lastModified !== target.lastModified) {
              result.changed.push(target.path);
              continue;
            }
          } catch (e) {
            if (__opfsBusy(e)) result.busy.push(target.path);
            else result.failed.push({ path: target.path, error: __opfsMessage(e) });
            continue;
          }
        }
        try {
          await dir.removeEntry(name, { recursive: target.kind === 'directory' });
          result.deleted.push(target.path);
        } catch (e) {
          if (__opfsName(e) === 'NotFoundError') result.gone.push(target.path);
          else if (__opfsBusy(e)) result.busy.push(target.path);
          else result.failed.push({ path: target.path, error: __opfsMessage(e) });
        }
      }
      return JSON.stringify(result);
    } catch (e) {
      return __opfsFailure(e);
    }
  })()`;
}
