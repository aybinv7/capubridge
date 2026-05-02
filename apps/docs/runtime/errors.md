# Error Handling

Errors are normalized at the Tauri/WebSocket boundary and treated as typed values.

## Error classes

```typescript
// runtime/effect/errors.ts
export class TauriInvokeError extends Error {
  /* ... */
}
export class TauriListenError extends Error {
  /* ... */
}
export class SessionInterruptedError extends Error {
  /* ... */
}
export class SessionCommandFailedError extends Error {
  /* ... */
}
```

## Frontend error handling

Every `invoke` call wraps in try/catch:```typescript
try {
  const devices = await invoke<ADBDevice[]>('session_list_devices');
  devicesStore.setDevices(devices);
} catch (err) {
  toast.error(`Failed to list devices: ${err}`);
}

```
## CDP errors
CDP errors propagate to useQuery error state — let them flow through, don't catch in composables.
```
