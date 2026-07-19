import type { LogcatEntry, LogcatErrorPayload } from "@/types/console.types";
import type { PerfMetrics } from "@/types/perf.types";
import type { SessionEvent } from "@/types/session.types";
import type { UpdaterProgressPayload } from "@/types/updater.types";

export interface MockServerRequestEvent {
  ruleId: string;
  method: string;
  url: string;
  statusCode: number;
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

export interface IpcEventMap {
  "capubridge:session-event": SessionEvent;
  "capubridge:mirror-device-clipboard": MirrorClipboardEvent;
  "capubridge:set-inspect-mode": { enabled: boolean };
  "capubridge:open-inspect": void;
  "capubridge:inspect-hover": MirrorPointEvent;
  "capubridge:inspect-select": MirrorPointEvent;
  "capubridge:inspect-leave": void;
  "capubridge:close-inspect": void;
  "logcat:line": LogcatEntry;
  "logcat:error": LogcatErrorPayload;
  "logcat:stopped": string;
  "perf:metrics": PerfMetrics;
  "perf:error": string;
  "perf:stopped": string;
  "mock-server-request": MockServerRequestEvent;
  "updater://progress": UpdaterProgressPayload;
}

export type IpcEventName = keyof IpcEventMap;
export type IpcEventPayload<Name extends IpcEventName> = IpcEventMap[Name];
