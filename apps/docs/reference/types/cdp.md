# CDP Types

Type definitions for Chrome DevTools Protocol.

```typescript
// src/types/cdp.types.ts
export interface CDPRequest {
  id: number;
  method: string;
  params: Record<string, unknown>;
}
export interface CDPResponse {
  id: number;
  result: unknown;
  error?: { code: number; message: string };
}
export interface CDPTarget {
  description: string;
  devtoolsFrontendUrl: string;
  id: string;
  title: string;
  type: string;
  url: string;
  webSocketDebuggerUrl: string;
}
```
