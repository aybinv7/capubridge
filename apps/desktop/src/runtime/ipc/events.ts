import type { PerfMetrics } from "@/types/perf.types";
import type { SessionEvent } from "@/types/session.types";
import type { CDPTarget } from "@/types/cdp.types";
import type { UpdaterProgressPayload } from "@/types/updater.types";
import type { AutomationTaskEvent } from "@/types/automation.types";
import type { PairingStateEvent } from "@/types/wireless.types";

export interface MockServerRequestEvent {
  ruleId: string | null;
  method: string;
  url: string;
  statusCode: number;
  delayMs: number;
  timestamp: number;
}

export interface MirrorClipboardEvent {
  serial: string;
  text: string;
}

export interface MirrorPointEvent {
  x: number;
  y: number;
}

/** A request from the MCP server (Rust) for the frontend to perform an action
 * it alone can do (see `useMcpBridge`). Answered via the `mcp_bridge_respond`
 * command carrying the same `requestId`. */
export interface McpBridgeRequestEvent {
  requestId: string;
  action: string;
  payload: unknown;
}

export interface OpfsPullProgressEvent {
  opfsPath: string;
  loaded: number;
  total: number;
}

export interface AutomationTaskEventPayload {
  event: AutomationTaskEvent;
}

/** The main window's selected target, sent to popped-out console windows. */
export interface DockTargetEvent {
  target: CDPTarget | null;
}

export interface IpcEventMap {
  "capubridge:dock-target": DockTargetEvent;
  "capubridge:dock-target-request": { requestedAt: number };
  "capubridge:drawer-return": { view: "logs" | "console" };
  "capubridge:session-event": SessionEvent;
  "capubridge:mirror-device-clipboard": MirrorClipboardEvent;
  "capubridge:set-inspect-mode": { enabled: boolean };
  "capubridge:open-inspect": void;
  "capubridge:inspect-hover": MirrorPointEvent;
  "capubridge:inspect-select": MirrorPointEvent;
  "capubridge:inspect-leave": void;
  "capubridge:close-inspect": void;
  "perf:metrics": PerfMetrics;
  "perf:error": string;
  "perf:stopped": string;
  "mock-server-request": MockServerRequestEvent;
  "updater://progress": UpdaterProgressPayload;
  "mcp://bridge/request": McpBridgeRequestEvent;
  "capubridge:opfs-pull-progress": OpfsPullProgressEvent;
  "capubridge:automation-task-event": AutomationTaskEventPayload;
  "capubridge:wireless-pairing": PairingStateEvent;
}

export type IpcEventName = keyof IpcEventMap;
export type IpcEventPayload<Name extends IpcEventName> = IpcEventMap[Name];
