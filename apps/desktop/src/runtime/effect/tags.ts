import { Context, Data, Effect } from "effect";
import type { IpcError } from "@/runtime/ipc/error";
import type { SessionPackageScope } from "@/runtime/ipc/contracts/session";
import type { AdbPackage, DeviceInfo, ReverseRule, WebViewSocket } from "@/types/adb.types";
import type {
  SessionDeviceSnapshot,
  SessionEvent,
  SessionLeaseState,
  SessionRegistrySnapshot,
  SessionTargetSnapshot,
} from "@/types/session.types";

export type { SessionPackageScope } from "@/runtime/ipc/contracts/session";

export class SessionInterruptedError extends Data.TaggedError("SessionInterruptedError")<{
  operation: string;
}> {}

export class SessionCommandFailedError extends Data.TaggedError("SessionCommandFailedError")<{
  operation: string;
  cause: unknown;
}> {}

export interface SessionBridgeService {
  getRegistryState: () => Effect.Effect<SessionRegistrySnapshot, IpcError>;
  listDevices: () => Effect.Effect<SessionDeviceSnapshot[], IpcError>;
  refreshDevices: () => Effect.Effect<SessionRegistrySnapshot, IpcError>;
  setActiveDevice: (serial: string | null) => Effect.Effect<SessionRegistrySnapshot, IpcError>;
  getDeviceInfo: (serial: string) => Effect.Effect<DeviceInfo, IpcError>;
  shellCommand: (serial: string, command: string) => Effect.Effect<string, IpcError>;
  tcpip: (serial: string, port: number) => Effect.Effect<void, IpcError>;
  root: (serial: string) => Effect.Effect<void, IpcError>;
  reboot: (serial: string, mode?: "recovery" | "bootloader") => Effect.Effect<void, IpcError>;
  listPackages: (
    serial: string,
    scope?: SessionPackageScope,
  ) => Effect.Effect<AdbPackage[], IpcError>;
  refreshPackages: (
    serial: string,
    scope?: SessionPackageScope,
  ) => Effect.Effect<AdbPackage[], IpcError>;
  cancelPackages: (serial: string) => Effect.Effect<void, IpcError>;
  openPackage: (serial: string, packageName: string) => Effect.Effect<string, IpcError>;
  reverse: (serial: string, remotePort: number, localPort: number) => Effect.Effect<void, IpcError>;
  removeReverse: (serial: string, remotePort: number) => Effect.Effect<void, IpcError>;
  listReverse: (serial: string) => Effect.Effect<ReverseRule[], IpcError>;
  listWebViewSockets: (serial: string) => Effect.Effect<WebViewSocket[], IpcError>;
  listTargets: (serial: string) => Effect.Effect<SessionTargetSnapshot[], IpcError>;
  refreshTargets: (serial: string) => Effect.Effect<SessionTargetSnapshot[], IpcError>;
  startLogcatLease: (serial: string) => Effect.Effect<SessionLeaseState, IpcError>;
  stopLogcatLease: (serial: string) => Effect.Effect<SessionLeaseState, IpcError>;
  startPerfLease: (serial: string) => Effect.Effect<SessionLeaseState, IpcError>;
  stopPerfLease: (serial: string) => Effect.Effect<SessionLeaseState, IpcError>;
  startMirrorLease: (serial: string) => Effect.Effect<SessionLeaseState, IpcError>;
  stopMirrorLease: (serial: string) => Effect.Effect<SessionLeaseState, IpcError>;
  attachConsoleTarget: (
    serial: string,
    targetId: string,
  ) => Effect.Effect<SessionLeaseState, IpcError>;
  detachConsoleTarget: (serial: string) => Effect.Effect<SessionLeaseState, IpcError>;
  subscribe: (onEvent: (event: SessionEvent) => void) => Effect.Effect<() => void, IpcError>;
}

export class SessionBridge extends Context.Tag("SessionBridge")<
  SessionBridge,
  SessionBridgeService
>() {}

export function isSessionInterruptedError(error: unknown): error is SessionInterruptedError {
  return error instanceof SessionInterruptedError;
}
