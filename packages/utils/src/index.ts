export { CDPClient } from "./cdp/client.js";
export { fetchLocalTargets } from "./cdp/targets.js";
export type { RawCDPTarget } from "./cdp/targets.js";
export { IDBDomain } from "./cdp/domains/indexeddb.js";
export type {
  IDBDatabaseInfo,
  IDBObjectStoreInfo,
  IDBIndexInfo,
  IDBRecord,
  GetDataParams,
  GetDataResult,
  StoreInfo,
} from "./cdp/domains/indexeddb.js";
export { LocalStorageDomain, CacheAPIDomain, OPFSDomain } from "./cdp/domains/storage.js";
export type { LSOrigin, CacheName, CacheEntry, OPFSEntry } from "./cdp/domains/storage.js";
export { LocalForageDomain } from "./cdp/domains/localforage.js";
export type { LocalForageEntry } from "./cdp/domains/localforage.js";
