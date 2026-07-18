/** Track names supported in Phase 1 */
export type TrackName = "rrweb" | "network" | "console" | "perf" | "databases";

export interface DatabaseTrackConfig {
  localStorage: boolean;
  indexedDB?: boolean;
  localForage?: boolean;
  sqlite?: boolean;
}

/** Per-track enable flags in a recording config */
export interface TrackConfig {
  rrweb: boolean;
  network: boolean;
  console: boolean;
  perf?: boolean;
  databases?: boolean;
}

/** Written as manifest.json at the root of the .capu zip */
export interface SessionManifest {
  version: 1;
  sessionId: string;
  label: string;
  startedAt: number; // Unix ms — the epoch for all `t` offsets
  duration: number; // ms, filled in when session stops
  deviceSerial: string | null;
  targetUrl: string | null;
  appPackage: string | null;
  tracks: TrackConfig;
  databaseTracks?: DatabaseTrackConfig;
}

/** Minimal metadata for the session library (read from manifest without loading tracks) */
export interface SessionListItem {
  sessionId: string;
  label: string;
  startedAt: number;
  duration: number;
  deviceSerial: string | null;
  targetUrl: string | null;
  filePath: string; // absolute path to .capu file on disk
  fileSizeBytes: number;
}

/** Every event written to any NDJSON track file has this shape */
export interface CapuEvent<T = unknown> {
  t: number; // ms offset from manifest.startedAt
  data: T;
}

export interface NetworkCapuTiming {
  dnsStart: number;
  dnsEnd: number;
  connectStart: number;
  connectEnd: number;
  sslStart: number;
  sslEnd: number;
  sendStart: number;
  sendEnd: number;
  receiveHeadersEnd: number;
}

/** Shape of a network event in network.ndjson */
export type NetworkCapuEvent = CapuEvent<{
  requestId: string;
  url: string;
  method: string;
  status: number | null;
  resourceType: string;
  duration: number | null;
  transferSize: number;
  state: string;
  mimeType: string | null;
  requestHeaders: Record<string, string> | null;
  responseHeaders: Record<string, string> | null;
  requestBody: string | null;
  responseBody: string | null;
  responseBodyBase64: boolean;
  timing: NetworkCapuTiming | null;
  initiator: string | null;
}>;

/** Shape of a console event in console.ndjson */
export type ConsoleCapuEvent = CapuEvent<{
  level: string;
  text: string;
  source: string | null;
  line: number | null;
  id?: string;
  parentId?: string | null;
  isGroup?: boolean;
  groupCollapsed?: boolean;
  args?: ConsoleArgRecord[];
}>;

export type ConsoleArgRecord =
  | { kind: "primitive"; text: string }
  | {
      kind: "object";
      description: string;
      subtype: string | null;
      properties: ConsolePropRecord[];
      overflow: boolean;
    };

export interface ConsolePropRecord {
  name: string;
  value: ConsoleArgRecord;
}

export interface PerfCapuSample {
  cpuTotal: number;
  cpuCores: Array<{ core: number; usage: number }>;
  memUsedPct: number;
  memUsedKb: number;
  memTotalKb: number;
  rxBps: number;
  txBps: number;
  batteryLevel: number;
  batteryCharging: boolean;
  batteryTemp: number;
  cpuTemp: number | null;
  jsHeapUsedMb: number | null;
  jsHeapTotalMb: number | null;
  domNodes: number | null;
}

export type PerfCapuEvent = CapuEvent<PerfCapuSample>;

export interface LocalStorageReplayEntry {
  key: string;
  value: string;
}

export type DatabaseCapuEvent = CapuEvent<{
  kind: "localStorage";
  origin: string;
  entries: LocalStorageReplayEntry[];
  reason: "initial" | "change" | "final";
}>;

export interface ReplayDatabaseSource {
  id: string;
  kind: "indexedDB" | "sqlite";
  origin: string;
  databaseName: string;
  storeName: string;
  label: string;
  recordCount: number;
  metadataJson: string | null;
  firstSeenMs: number | null;
  lastSeenMs: number | null;
}

export interface ReplayDatabaseRow {
  keyJson: string;
  valueJson: string;
}

export interface ReplayDatabaseRowsResult {
  rows: ReplayDatabaseRow[];
  total: number;
}

export interface ReplayDatabaseChange {
  id: number;
  sourceId: string;
  tMs: number;
  operation: "add" | "update" | "delete";
  keyHash: string;
  keyJson: string;
  beforeJson: string | null;
  afterJson: string | null;
}

export interface ReplayDatabaseChangesResult {
  changes: ReplayDatabaseChange[];
  total: number;
}

export interface ReplayDatabaseChangeSummary {
  add: number;
  update: number;
  delete: number;
  total: number;
  latestMs: number | null;
}

export interface ReplayDatabaseSourceChangeSummary extends ReplayDatabaseChangeSummary {
  sourceId: string;
}

/** rrweb events are passed through as-is from the rrweb recorder */
export type RrwebCapuEvent = CapuEvent<unknown>; // rrweb types its own events internally

/** User config from the recording modal before starting */
export interface RecordingConfig {
  label: string;
  tracks: TrackConfig;
  databaseTracks?: DatabaseTrackConfig;
  reloadTarget: boolean; // whether to reload the target page for clean rrweb init
}

/** What the Rust recording_list_sessions command returns (snake_case from Rust) */
export interface RustSessionListItem {
  session_id: string;
  label: string;
  started_at: number;
  duration: number;
  device_serial: string | null;
  target_url: string | null;
  file_path: string;
  file_size_bytes: number;
}

/** Element data extracted from the rrweb iframe on inspect-click */
export interface ReplayInspectElement {
  tag: string;
  id: string;
  cls: string; // space-separated class string
  attrs: Array<{ name: string; value: string }>;
  computedStyles: Array<{ name: string; value: string }>;
  width: number; // content box px from getBoundingClientRect
  height: number;
}

// ipc.types.ts signatures reference (Tauri commands added by recording.rs):
// invoke<{ manifest_json: string; tracks: Record<string, string> }>('recording_read_session', { filePath: string })
