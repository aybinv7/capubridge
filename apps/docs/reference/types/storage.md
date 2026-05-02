# Storage Types

Type definitions for storage inspection.

```typescript
// src/types/storage.types.ts
export interface IDBDatabaseMeta {
  name: string;
  version: number;
  objectStores: IDBObjectStoreMeta[];
}
export interface IDBObjectStoreMeta {
  name: string;
  keyPath: string;
  autoIncrement: boolean;
  indexes: IDBIndexMeta[];
}
export interface IDBRecord {
  key: IDBValidKey;
  value: unknown;
}
export interface LSEntry {
  key: string;
  value: string;
}
export interface CacheEntry {
  requestUrl: string;
  responseStatus: number;
  responseTime: number;
  bodySize: number;
}
// src/types/sqlite.types.ts
export interface SQLiteTableMeta {
  name: string;
  columns: SQLiteColumnMeta[];
  rowCount: number;
}
export interface SQLiteRow {
  [column: string]: unknown;
}
```
