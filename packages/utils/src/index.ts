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
export {
  LocalStorageDomain,
  CacheAPIDomain,
  OPFSDomain,
  SQLITE_MAGIC,
  SAH_POOL_HEADER_PATH_MAX,
  SAH_POOL_HEADER_FLAGS_OFFSET,
  SAH_POOL_HEADER_FLAGS_SIZE,
  SAH_POOL_HEADER_DIGEST_OFFSET,
  SAH_POOL_HEADER_DIGEST_SIZE,
  SAH_POOL_HEADER_DATA_OFFSET,
  isSqliteMagic,
  decodeSahPoolHeader,
  detectStorageTechs,
} from "./cdp/domains/storage.js";
export type {
  LSOrigin,
  CacheName,
  CacheEntry,
  OPFSEntry,
  SahPoolHeader,
  SahPoolDatabase,
  StorageTechId,
  StorageTechHint,
} from "./cdp/domains/storage.js";
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
export { NetworkDomain } from "./cdp/domains/network.js";
export { FetchDomain } from "./cdp/domains/fetch.js";
export type {
  FetchRequestPattern,
  FetchHeaderEntry,
  RequestPausedEvent,
  FulfillRequestParams,
  ContinueRequestParams,
} from "./cdp/domains/fetch.js";
export type {
  CDPResourceTiming,
  CDPNetworkResponse,
  RequestWillBeSentEvent,
  ResponseReceivedEvent,
  LoadingFinishedEvent,
  LoadingFailedEvent,
  RequestServedFromCacheEvent,
  WebSocketCreatedEvent,
  WebSocketHandshakeEvent,
  WebSocketClosedEvent,
  WebSocketFrameEvent,
  GetResponseBodyResult,
  NetworkEnableParams,
} from "./cdp/domains/network.js";
