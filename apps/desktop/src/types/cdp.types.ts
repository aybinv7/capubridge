export interface CDPTarget {
  id: string;
  type: "page" | "background_page" | "worker" | "iframe";
  title: string;
  url: string;
  devtoolsFrontendUrl?: string;
  webSocketDebuggerUrl?: string;
  source: "adb" | "chrome" | "local";
  deviceSerial?: string;
  faviconUrl?: string;
  packageName?: string;
  localWebviewLabel?: string;
  isStale?: boolean;
  lastUpdatedAt?: number;
}

export interface CDPConnection {
  targetId: string;
  ws: WebSocket;
  sessionId?: string;
  status: "connecting" | "connected" | "disconnected" | "error";
}

/** What the device DevTools endpoint reports about one target (see `cdp_probe_target`). */
export type TargetPresence = "visible" | "hidden" | "gone" | "unresponsive" | "unknown";

export interface TargetProbe {
  presence: TargetPresence;
  siblingVisible: boolean;
}
