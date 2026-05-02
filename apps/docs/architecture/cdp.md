# CDP Transport

CDP (Chrome DevTools Protocol) transport for target inspection.

## WebSocket connection

Capubridge opens a WebSocket to the locally forwarded CDP endpoint:

````text
localhost:9222 (forwarded) → device CDP WebSocket
```## CDP port per device
Each connected device gets its own forwarded port range.![Screenshot showing CDP port forwarding per device]| Device | Selected target | Local port |
|--------|----------------|-----------|
| Device 1 | First target | 9222 |
| Device 1 | Second target | 9223 |
| Device 2 | First target | 9224 |## CDP domains used
| Domain | Used for |
|--------|----------|
| **Page** | Target listing |
| **DOM** | DOM tree |
| **CSS** | Computed styles |
| **Runtime** | JS evaluation |
| **Storage** | IndexedDB, LocalStorage |
| **Network** | Request interception |
| **Log** | Console output |
| **ApplicationInspector** | App inspection |## Writes go through Runtime.evaluate
CDP writes are **never** faked as local mutations. Every write goes through `Runtime.evaluate` so the actual target receives the change:```typescript
await cdp.send('Runtime.evaluate', {
  expression: `indexedDB.open('${dbName}').onsuccess = () => { /* ... */ }`,
  awaitPromise: true,
  returnByValue: true,
});
```## Disconnect handling
WebSocket connections disconnect when:- User navigates the page
- App goes to background on Android
- USB cable unpluggedCapubridge handles this by:1. Listening for WebSocket `close` events
2. Updating the connection store status
3. **Not auto-reconnecting** — user must reconnect manually via F5 or button
````
