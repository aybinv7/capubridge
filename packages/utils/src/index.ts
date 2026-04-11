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
export { DOMDomain } from "./cdp/domains/dom.js";
export type { DOMNode, BoxModel, NodeForLocation } from "./cdp/domains/dom.js";
export { CSSDomain } from "./cdp/domains/css.js";
export type {
  CSSProperty,
  CSSRule,
  CSSStyle,
  ComputedStyle,
  MatchedStyles,
} from "./cdp/domains/css.js";
export { OverlayDomain } from "./cdp/domains/overlay.js";
export type { HighlightConfig, RGBA } from "./cdp/domains/overlay.js";
