export type MdnsServiceKind = "pairing" | "connect" | "legacy";

/** An adb service seen on the network over mDNS. */
export interface MdnsService {
  /** Instance name: `studio-…` for a QR pairing, `adb-<serial>-<id>` for a phone's own services. */
  name: string;
  kind: MdnsServiceKind;
  host: string;
  port: number;
}

export type DiscoveryBackend = "adb" | "native";
export type DiscoveryStatus = "ready" | "adbUnavailable" | "discoveryUnavailable";

export interface WirelessDiscovery {
  status: DiscoveryStatus;
  backend: DiscoveryBackend | null;
  services: MdnsService[];
  detail: string | null;
}

/** A QR code as one SVG path over a `size` × `size` grid, without the quiet zone. */
export interface QrMatrix {
  size: number;
  path: string;
}

export interface QrPairingStart {
  sessionId: number;
  serviceName: string;
  qr: QrMatrix;
}

export type PairingFailure =
  | "phoneNotSeen"
  | "nothingDiscovered"
  | "phoneUnreachable"
  | "pairingRejected"
  | "connectFailed"
  | "discoveryUnavailable"
  | "adbUnavailable";

export type PairingPhase =
  | { phase: "waiting" }
  | { phase: "pairing" }
  | { phase: "connecting" }
  | { phase: "connected"; serial: string; guid: string | null }
  | { phase: "failed"; reason: PairingFailure; detail: string | null };

export interface PairingStateEvent {
  sessionId: number;
  state: PairingPhase;
}
