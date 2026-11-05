export interface SqliteHeaderFacts {
  pageSize: number;
  pageCount: number | null;
  encoding: "UTF-8" | "UTF-16le" | "UTF-16be" | null;
  journal: "Write-ahead log" | "Rollback journal";
  userVersion: number;
}

export interface AppDatabase {
  packageName: string;
  fileName: string;
}

const HEADER_LENGTH = 100;
const ENCODINGS = { 1: "UTF-8", 2: "UTF-16le", 3: "UTF-16be" } as const;

function readUint32(bytes: Uint8Array, offset: number): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getUint32(offset, false);
}

function readUint16(bytes: Uint8Array, offset: number): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getUint16(offset, false);
}

/**
 * Facts from the 100-byte database header. The in-header page count is trusted only when its
 * "version valid for" field matches the change counter, as SQLite itself does; otherwise it is
 * derived from the file size when that is known.
 */
export function parseSqliteHeader(bytes: Uint8Array, fileSize: number): SqliteHeaderFacts | null {
  if (bytes.length < HEADER_LENGTH) return null;
  const rawPageSize = readUint16(bytes, 16);
  const pageSize = rawPageSize === 1 ? 65536 : rawPageSize;
  if (pageSize < 512) return null;
  const changeCounter = readUint32(bytes, 24);
  const validFor = readUint32(bytes, 92);
  const headerPages = readUint32(bytes, 28);
  const derivedPages = fileSize > 0 ? Math.floor(fileSize / pageSize) : null;
  const encodingCode = readUint32(bytes, 56);
  return {
    pageSize,
    pageCount: headerPages > 0 && validFor === changeCounter ? headerPages : derivedPages,
    encoding: ENCODINGS[encodingCode as keyof typeof ENCODINGS] ?? null,
    journal: bytes[18] === 2 ? "Write-ahead log" : "Rollback journal",
    userVersion: readUint32(bytes, 60),
  };
}

const APP_DATABASE = /^\/data\/(?:data|user\/\d+)\/([^/]+)\/databases\/([^/]+)$/;

/** The app and file name when a path is an app's own database, the folder Data › SQLite lists. */
export function appDatabaseFromPath(path: string): AppDatabase | null {
  const match = APP_DATABASE.exec(path);
  if (!match?.[1] || !match[2]) return null;
  return { packageName: match[1], fileName: match[2] };
}
