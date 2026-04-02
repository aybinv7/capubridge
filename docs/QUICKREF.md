# DevBridge — Quick Reference

## Run

```bash
pnpm tauri dev          # dev mode
pnpm tauri build        # production build
pnpm vitest             # unit tests (watch)
pnpm vitest run         # unit tests (CI)
pnpm vue-tsc --noEmit   # type check
pnpm eslint src/        # lint
```

## Key files

| File                               | Purpose                                               |
| ---------------------------------- | ----------------------------------------------------- |
| `SPEC.md`                          | Full product spec — read before implementing anything |
| `CLAUDE.md`                        | AI coding guide — conventions, patterns, gotchas      |
| `PHASE-1-TASKS.md`                 | Current sprint task list                              |
| `src/lib/cdp/client.ts`            | CDP WebSocket client                                  |
| `src/lib/cdp/domains/indexeddb.ts` | IDB CDP domain                                        |
| `src-tauri/src/commands/adb.rs`    | All ADB Tauri commands                                |
| `src/types/`                       | All TypeScript interfaces                             |
| `src/stores/`                      | All Pinia stores                                      |
| `src/composables/`                 | All composables                                       |

## CDP flow

```
USB device → adb forward tcp:9222 → fetch localhost:9222/json → pick target
→ new CDPClient(wsUrl) → CDPClient.send('IndexedDB.enable') → ready
```

## Add a new ADB command

1. Write function in `src-tauri/src/commands/adb.rs`
2. Register in `src-tauri/src/lib.rs` invoke_handler
3. Add type to `src/types/ipc.types.ts`
4. Call with `invoke<ReturnType>('command_name', { params })`

## Add a new panel

1. Create `src/modules/mypanel/MyPanel.vue`
2. Add route in `src/router/index.ts`
3. Add icon + nav item in `Sidebar.vue`

## IDB write pattern

Always write through CDP Runtime.evaluate — never mutate local state directly:

```typescript
await client.send("Runtime.evaluate", {
  expression: `new Promise((res, rej) => {
    const req = indexedDB.open('${dbName}');
    req.onsuccess = () => {
      const tx = req.result.transaction('${store}', 'readwrite');
      tx.objectStore('${store}').put(${JSON.stringify(record)});
      tx.oncomplete = () => res(true);
      tx.onerror = () => rej(tx.error?.message);
    };
  })`,
  awaitPromise: true,
  returnByValue: true,
});
```

## Design tokens

Import CSS vars from `src/assets/styles/tokens.css`.  
Never hardcode colors. Use `var(--surface-base)`, `var(--text-primary)`, `var(--status-error)` etc.
