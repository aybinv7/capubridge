import type { ADBDevice } from "@/types/adb.types";
import type { AppPresence } from "@/lib/gates/presence";

/** What a screen needs before it can show anything truthful. */
export type GateRequirement = "none" | "device" | "target" | "app-target";

export type GateTargetSource = "adb" | "local" | "chrome";

export type GateLinkStatus =
  | "none"
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export type GateAdbStatus = "unknown" | "running" | "starting" | "error";

/** Everything the gate reads, flattened so the resolver stays pure and testable. */
export interface GateInput {
  adb: GateAdbStatus;
  onlineDevices: number;
  device:
    | (Pick<ADBDevice, "serial" | "model" | "status" | "isStale"> & {
        /** The name a person knows the device by ("Redmi Note 14"), when one is known. */
        name?: string;
      })
    | null;
  target: {
    id: string;
    source: GateTargetSource;
    title: string;
    packageName?: string;
  } | null;
  link: GateLinkStatus;
  linkError: string | null;
  presence: AppPresence;
}

export type GateKind =
  | "open"
  | "adb-unavailable"
  | "no-device"
  | "device-unauthorized"
  | "device-offline"
  | "needs-device"
  | "no-target"
  | "needs-app-target"
  | "idle"
  | "connecting"
  | "gone"
  | "disconnected"
  | "error";

/** Non-blocking conditions shown above content that is still usable. */
export type GateNotice = "background" | "view-hidden";

export interface GateResult {
  kind: GateKind;
  notice: GateNotice | null;
}

export type GateTone = "neutral" | "waiting" | "warning" | "error";

export type GateActionId =
  | "choose-target"
  | "choose-device"
  | "pair-wifi"
  | "start-emulator"
  | "open-local-url"
  | "start-adb"
  | "rescan-devices"
  | "scan-targets"
  | "connect"
  | "reconnect"
  | "bring-to-front";

export interface GateCopy {
  title: string;
  detail: string;
  tone: GateTone;
  actions: readonly GateActionId[];
  steps?: readonly string[];
}

export type ChainLinkState = "ok" | "pending" | "broken" | "idle";

/** One hop of the device › app › target › link chain, shown so the break is visible at a glance. */
export interface ChainLink {
  key: "adb" | "host" | "target" | "link";
  label: string;
  value: string;
  state: ChainLinkState;
}
