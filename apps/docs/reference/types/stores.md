# Store Types

Type definitions for Pinia stores.

```typescript
// src/types/session.types.ts
export interface SessionRegistrySnapshot {
  devices: ADBDevice[];
  activeSerial: string | null;
  fetchedAt: number;
}
export interface ADBDevice {
  serial: string;
  product: string;
  model: string;
  device: string;
  transportId: string;
  status: "online" | "offline" | "unauthorized";
}
export type SessionTemperature = "hot" | "warm" | "cold";
// src/types/targets.types.ts
export interface CDPTarget {
  id: string;
  title: string;
  url: string;
  type: "page" | "webview" | "service-worker" | "browser" | "other";
  webSocketDebuggerUrl: string;
}
```
