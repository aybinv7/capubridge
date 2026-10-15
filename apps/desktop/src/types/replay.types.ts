import type { AssertionResult } from "@/modules/automation/assertions";
import type {
  Decision,
  Flow,
  ResolvedTarget,
  RunStatus,
  SessionSignalState,
  StepOutcome,
  StepRecord,
} from "@/types/automation.types";

/** Track names supported in Phase 1 */
export type TrackName = "rrweb" | "network" | "console" | "perf" | "databases" | "automation";

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
  automation?: boolean;
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
  automation?: AutomationManifest;
  incomplete?: {
    errors: string[];
    missingTracks: string[];
  };
  producer?: { name: string; version: string; platform: string };
  device?: {
    model: string | null;
    osVersion: string | null;
    webviewVersion: string | null;
    appId: string | null;
    appVersion: string | null;
  };
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
  incomplete: boolean;
  missingTracks: string[];
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
  responseBodyError?: string | null;
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
  cpuTotal: number | null;
  cpuCores: Array<{ core: number; usage: number }> | null;
  memUsedPct: number | null;
  memUsedKb: number | null;
  memTotalKb: number | null;
  rxBps: number | null;
  txBps: number | null;
  batteryLevel: number | null;
  batteryCharging: boolean | null;
  batteryTemp: number | null;
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

export interface LocalStorageCapuData {
  kind: "localStorage";
  origin: string;
  entries: LocalStorageReplayEntry[];
  reason: "initial" | "change" | "final";
}

export type TableChangeType = "insert" | "update" | "delete" | "bulk";

export interface TableChangeCapuData {
  kind: "tableChange";
  engine: "sqlite";
  table: string;
  type: TableChangeType;
  affectedRows: number | null;
  affectedIds: Array<string | number> | null;
  transactionId: string | null;
}

export type DatabaseCapuData = LocalStorageCapuData | TableChangeCapuData;

export type DatabaseCapuEvent = CapuEvent<DatabaseCapuData>;

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

/** What the Rust recording_list_sessions command returns (camelCase on the wire). */
export interface RustSessionListItem {
  sessionId: string;
  label: string;
  startedAt: number;
  duration: number;
  deviceSerial: string | null;
  targetUrl: string | null;
  filePath: string;
  fileSizeBytes: number;
  incomplete: boolean;
  missingTracks: string[];
  automation: AutomationSummary | null;
}

/** Automation summary embedded in session list items. Null for non-automation sessions. */
export interface AutomationSummary {
  runStatus: string;
  policyId: string;
  flowName: string | null;
  goal: string | null;
  stepCount: number;
  failedStepIndex: number | null;
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

/** What kind of automation run a session records. Absent on pre-milestone sessions. */
export interface AutomationManifest {
  runStatus: RunStatus;
  policyId: string;
  flowId: string | null;
  flowName: string | null;
  goal: string | null;
  taskId?: string;
  taskRunId?: string;
  taskOrigin?: "local-chat" | "mcp" | "artemis" | "flow";
  /**
   * The flow exactly as it was when this run started. `flowId` alone makes a
   * trace a lie the moment the flow is edited, because the steps the run
   * executed no longer match the steps the id resolves to. Absent on sessions
   * recorded before this field existed and on goal runs with no flow.
   */
  flowSnapshot?: Flow | null;
}

/**
 * One automation step in automation.ndjson. The screenshot is an archive
 * entry name, never an inline payload.
 */
export interface AutomationCapuEventData {
  stepId: string;
  decision: Decision;
  resolvedTarget: ResolvedTarget | null;
  outcome: StepOutcome;
  error: string | null;
  screenshot: string | null;
  policyId: string;
  confidence: number;
  assertions: AssertionResult[];
  signals?: SessionSignalState;
  timings?: StepRecord["timings"];
  beforeFingerprint?: string;
  afterFingerprint?: string;
  screenChanged?: boolean;
  dispatchStatus?: StepRecord["dispatchStatus"];
  verificationStatus?: StepRecord["verificationStatus"];
}

/** Shape of an automation event in automation.ndjson */
export type AutomationCapuEvent = CapuEvent<AutomationCapuEventData>;

// ipc.types.ts signatures reference (Tauri commands added by recording.rs):
// invoke<{ manifest_json: string; tracks: Record<string, string> }>('recording_read_session', { filePath: string })
