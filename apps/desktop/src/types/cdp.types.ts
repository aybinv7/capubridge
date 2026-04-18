export interface CDPTarget {
  id: string;
  type: "page" | "background_page" | "worker" | "iframe";
  title: string;
  url: string;
  devtoolsFrontendUrl?: string;
  webSocketDebuggerUrl: string;
  source: "adb" | "chrome";
  deviceSerial?: string;
  faviconUrl?: string;
  packageName?: string;
}

export interface CDPConnection {
  targetId: string;
  ws: WebSocket;
  sessionId?: string;
  status: "connecting" | "connected" | "disconnected" | "error";
}
