import type { LogcatEntry } from "@/types/console.types";
import type { PerfMetrics } from "@/types/perf.types";

export type SessionTrackerStatus = "stopped" | "starting" | "running" | "error";

export type SessionTemperature = "cold" | "warm" | "hot";

export type SessionCleanupState = "active" | "shuttingDown" | "detached" | "stopped";

export interface SessionHealthSnapshot {
  queueDepth: number;
  queueCapacity: number;
  activeOperation: string | null;
  lastTerminalFailure: string | null;
  connectionAgeMs: number;
  cleanupState: SessionCleanupState;
}

export type SessionDeviceStatus =
  | "online"
  | "offline"
  | "unauthorized"
  | "connecting"
  | "bootloader"
  | "host"
  | "recovery"
  | "sideload"
  | "no_device"
  | "authorizing"
  | "no_perm"
  | "detached"
  | "rescue";

export interface SessionDeviceSnapshot {
  serial: string;
  model: string;
  product: string;
  transportId: string;
  connectionType: string;
  status: SessionDeviceStatus;
  temperature: SessionTemperature;
  isStale: boolean;
  lastSeenAt: number | null;
  lastUpdatedAt: number;
  health?: SessionHealthSnapshot | null;
}

export interface SessionRegistrySnapshot {
  devices: SessionDeviceSnapshot[];
  activeSerial: string | null;
  trackerStatus: SessionTrackerStatus;
  revision: number;
  lastError: string | null;
  updatedAt: number;
}

export interface SessionTargetSnapshot {
  serial: string;
  id: string;
  type: string;
  title: string;
  url: string;
  devtoolsFrontendUrl?: string;
  webSocketDebuggerUrl: string;
  faviconUrl?: string;
  packageName?: string;
  isStale: boolean;
  lastUpdatedAt: number;
}

export type SessionLeaseKind = "logcat" | "perf" | "mirror" | "console";

export interface SessionLeaseState {
  serial: string;
  kind: SessionLeaseKind;
  active: boolean;
  targetId?: string | null;
  updatedAt: number;
}

export type SessionEvent =
  | {
      type: "registryUpdated";
      snapshot: SessionRegistrySnapshot;
    }
  | {
      type: "leaseStateChanged";
      lease: SessionLeaseState;
    }
  | {
      type: "logcatEntry";
      serial: string;
      entry: LogcatEntry;
    }
  | {
      type: "logcatError";
      serial: string;
      message: string;
    }
  | {
      type: "perfMetrics";
      serial: string;
      metrics: PerfMetrics;
    }
  | {
      type: "perfError";
      serial: string;
      message: string;
    };
