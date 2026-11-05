export type IdbKeyPath = string | string[] | null;

export interface IdbExportedIndex {
  name: string;
  keyPath: IdbKeyPath;
  unique: boolean;
  multiEntry: boolean;
}

export interface IdbExportedStore {
  name: string;
  keyPath: IdbKeyPath;
  autoIncrement: boolean;
  indexes: IdbExportedIndex[];
  records: Array<{ key: unknown; value: unknown }>;
}

/**
 * A Capubridge IndexedDB export. Version 2 encodes every non-JSON value as a `__type`
 * marker that the import turns back into the real value; version 1 files saved raw JSON.
 */
export interface IdbExportedDatabase {
  format: "capubridge-idb-export";
  version: 1 | 2;
  encoding?: "capubridge-markers-v1";
  /** Values the export could not save in a form that restores them (version 2). */
  lossy?: string[];
  exportedAt: string;
  origin: string;
  database: {
    name: string;
    version: number;
    stores: IdbExportedStore[];
  };
}

/**
 * Where a long transfer is. `check` writes the file into a scratch database on the phone
 * (nothing of the real database is touched yet); `write` replaces the real database.
 */
export interface IdbTransferProgress {
  phase: "export" | "check" | "write";
  store: string;
  storeIndex: number;
  storeCount: number;
  records: number;
  bytes: number;
  /** Total bytes of the transfer when known up front. */
  totalBytes: number | null;
}

export interface IdbTransferOptions {
  onProgress?: (progress: IdbTransferProgress) => void;
  signal?: AbortSignal;
}

export interface IdbImportOptions extends IdbTransferOptions {
  /** Write `null` for every value the file could not save in full (listed by `exportLoss`). */
  acceptLoss?: boolean;
  /** Called once the real database is about to be replaced; from then on it cannot be cancelled. */
  onCommit?: () => void;
}
