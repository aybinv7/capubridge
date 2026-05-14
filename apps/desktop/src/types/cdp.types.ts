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
