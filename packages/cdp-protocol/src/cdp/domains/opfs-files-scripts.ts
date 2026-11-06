import { jsLiteral } from "../evaluate.js";

/** How many entries of one folder a read describes at most. */
export const OPFS_FOLDER_READ_LIMIT = 5000;

/** How many folders the folder walk lists at most, and how deep it goes. */
export const OPFS_FOLDER_WALK_LIMIT = 500;
export const OPFS_FOLDER_WALK_DEPTH = 12;

/** How many files a look inside a folder goes through at most. */
export const OPFS_INSPECT_FILE_LIMIT = 20_000;

/** How many files are opened at once to read their size. */
export const OPFS_STAT_POOL = 16;

/** How many files a folder listing opens at once, and how long it spends on sizes and dates. */
const OPFS_LIST_POOL = 24;
const OPFS_LIST_BUDGET_MS = 5000;

/** One file or folder to delete, as the person saw it. */
export interface OPFSDeleteTarget {
  path: string;
  kind: "file" | "directory";
  /**
   * Bytes and modification time the person saw; `null` when unknown, and then the file is kept
   * unless forced (read them with `inspectScript` first).
   */
  size: number | null;
  lastModified: number | null;
  /**
   * A folder's contents as `inspectScript` read them; `null` or absent when nobody looked
   * inside, and then the folder is kept unless forced.
   */
  fingerprint?: string | null;
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
function __opfsHash(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
async function __opfsPool(items, size, work) {
  let next = 0;
  async function lane() {
    while (next < items.length) {
      const index = next++;
      await work(items[index], index);
    }
  }
  const lanes = [];
  for (let index = 0; index < Math.min(size, items.length); index++) lanes.push(lane());
  await Promise.all(lanes);
}
async function __opfsWalk(dir, path, limit) {
  const files = [];
  let folders = 0;
  let truncated = false;
  const queue = [[dir, path]];
  while (queue.length > 0) {
    const current = queue.shift();
    for await (const [name, handle] of current[0].entries()) {
      const itemPath = current[1] ? current[1] + '/' + name : name;
      if (handle.kind === 'directory') {
        folders++;
        queue.push([handle, itemPath]);
      } else if (files.length < limit) {
        files.push({ path: itemPath, name, handle, size: null, lastModified: null, locked: false, sqlite: false });
      } else {
        truncated = true;
      }
    }
  }
  await __opfsPool(files, ${OPFS_STAT_POOL}, async function (file) {
    try {
      const blob = await file.handle.getFile();
      file.size = blob.size;
      file.lastModified = blob.lastModified;
      if (blob.size >= 16) {
        const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
        file.sqlite = String.fromCharCode.apply(null, Array.from(head)) === 'SQLite format 3\0';
      }
    } catch (e) {
      file.locked = __opfsBusy(e);
    }
  });
  return { files, folders, truncated };
}
function __opfsFingerprint(walk) {
  return __opfsHash(walk.files
    .map(function (file) { return file.path + '|' + file.size + '|' + file.lastModified + '|' + (file.locked ? 'L' : ''); })
    .sort()
    .join('\n') + '|' + walk.folders);
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
 * modification time read a few at a time for up to five seconds (later files come back
 * `unread`). A file the app holds open is listed as `locked`.
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
      const started = Date.now();
      const entries = new Array(handles.length);
      await __opfsPool(handles, ${OPFS_LIST_POOL}, async function (pair, index) {
        const name = pair[0];
        const handle = pair[1];
        const itemPath = path ? path + '/' + name : name;
        if (handle.kind === 'directory') {
          entries[index] = { name, path: itemPath, kind: 'directory', size: null, lastModified: null };
          return;
        }
        if (Date.now() - started > ${OPFS_LIST_BUDGET_MS}) {
          entries[index] = { name, path: itemPath, kind: 'file', size: null, lastModified: null, unread: true };
          return;
        }
        try {
          const file = await handle.getFile();
          entries[index] = { name, path: itemPath, kind: 'file', size: file.size, lastModified: file.lastModified };
        } catch (e) {
          entries[index] = { name, path: itemPath, kind: 'file', size: null, lastModified: null, locked: __opfsBusy(e), unreadable: __opfsMessage(e) };
        }
      });
      return JSON.stringify({ origin: location.origin, path, entries, total });
    } catch (e) {
      return __opfsFailure(e);
    }
  })()`;
}

/**
 * What deleting each target would take with it, read just before the person is asked: a file's
 * size and time; for a folder, every file inside (up to `OPFS_INSPECT_FILE_LIMIT`) with how
 * many there are, their bytes, which are SQLite databases, journals or SAH-Pool slots, which the
 * app holds open, and a fingerprint a delete compares.
 */
export function inspectScript(
  origin: string,
  targets: readonly Pick<OPFSDeleteTarget, "path" | "kind">[],
): string {
  return `(async () => {
    ${HELPERS}
    const origin = ${jsLiteral(origin)};
    const targets = ${jsLiteral(targets)};
    try {
      const refused = __opfsGuard(origin);
      if (refused) return refused;
      const out = [];
      for (const target of targets) {
        const report = { path: target.path, kind: target.kind, gone: false, files: 0, folders: 0, bytes: 0, databases: [], journals: [], poolSlots: 0, locked: [], size: null, lastModified: null, fingerprint: null, truncated: false };
        out.push(report);
        const parts = __opfsParts(target.path);
        const name = parts.pop();
        try {
          const dir = await __opfsDir(parts);
          if (target.kind === 'file') {
            if (!name) throw new Error('The root folder is not a file');
            const handle = await dir.getFileHandle(name);
            try {
              const file = await handle.getFile();
              report.size = file.size;
              report.lastModified = file.lastModified;
            } catch (e) {
              if (__opfsBusy(e)) report.locked.push(target.path);
              else throw e;
            }
            continue;
          }
          const folder = name ? await dir.getDirectoryHandle(name) : dir;
          const walk = await __opfsWalk(folder, target.path, ${OPFS_INSPECT_FILE_LIMIT});
          report.files = walk.files.length;
          report.folders = walk.folders;
          report.truncated = walk.truncated;
          report.fingerprint = walk.truncated ? null : __opfsFingerprint(walk);
          for (const file of walk.files) {
            report.bytes += file.size || 0;
            if (file.locked) report.locked.push(file.path);
            if (/sahpool/i.test(file.path)) report.poolSlots++;
            else if (file.sqlite || /\\.(sqlite3?|db3?)$/i.test(file.name)) report.databases.push(file.path);
            if (/-(wal|journal|shm)$/i.test(file.name)) report.journals.push(file.path);
          }
        } catch (e) {
          if (__opfsName(e) === 'NotFoundError' || __opfsName(e) === 'TypeMismatchError') report.gone = true;
          else throw e;
        }
      }
      return JSON.stringify({ inspections: out });
    } catch (e) {
      return __opfsFailure(e);
    }
  })()`;
}

/**
 * Deletes files and folders of the origin's OPFS. A file whose size or modification time is not
 * what the person saw (or was never read) is kept (listed in `changed`) unless `force`; so is a
 * folder whose contents differ from its `fingerprint` (or that nobody looked inside). A folder
 * with any file inside that the app holds open is never touched (listed in `busy`, even when
 * forced), so a recursive delete cannot stop half way; one already gone is listed in `gone`.
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
        if (!force && target.kind === 'file') {
          try {
            const file = await handle.getFile();
            if (target.size === null || file.size !== target.size || file.lastModified !== target.lastModified) {
              result.changed.push(target.path);
              continue;
            }
          } catch (e) {
            if (__opfsBusy(e)) result.busy.push(target.path);
            else result.failed.push({ path: target.path, error: __opfsMessage(e) });
            continue;
          }
        }
        if (target.kind === 'directory') {
          try {
            const walk = await __opfsWalk(handle, target.path, ${OPFS_INSPECT_FILE_LIMIT});
            if (walk.files.some(function (file) { return file.locked; })) {
              result.busy.push(target.path);
              continue;
            }
            if (!force && (walk.truncated || !target.fingerprint || __opfsFingerprint(walk) !== target.fingerprint)) {
              result.changed.push(target.path);
              continue;
            }
          } catch (e) {
            result.failed.push({ path: target.path, error: __opfsMessage(e) });
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
