# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

---

## Development Commands

This is a **Vite+ monorepo**. All tooling goes through the `vp` global CLI — never use `pnpm`, `npm`, or tool binaries (`vitest`, `eslint`, `oxlint`) directly. See `apps/docs/viteplus.md` for the full reference.

```bash
# Install dependencies (after pulling)
vp install

# Run the Tauri desktop app (Vite dev server + Tauri window)
vp run tauri

# Run the website dev server
vp dev

# Format + lint + typecheck (run before committing)
vp check

# Run tests (watch mode)
vp test

# Build all packages
vp run -r build

# Check everything is ready (fmt, lint, test, build)
vp run ready
```

**Critical rules for Vite+:**

- `vp check` replaces `vue-tsc`, `eslint`, and `oxfmt` — use it, not them
- `vp test` replaces `vitest` — never install or run vitest directly
- `vp lint` and `vp fmt` work standalone if you need just one step
- To run a custom `package.json` script that shares a name with a built-in (e.g. a custom `dev`), use `vp run dev` not `vp dev`
- All imports use `vite-plus`: `import { defineConfig } from 'vite-plus'` and `import { expect, test } from 'vite-plus/test'`

---

## Monorepo Structure

```
capubridge/
├── apps/
│   ├── desktop/        # Tauri 2 desktop app (Vue 3 + TypeScript)
│   │   ├── src/        # Frontend Vue source
│   │   └── src-tauri/  # Rust backend (Tauri commands)
│   ├── docs/           # VitePress documentation app
│   └── website2/       # Marketing/docs website (Vite)
├── packages/
│   └── utils/          # Shared TypeScript utilities (imported as "utils" workspace dep)
└── vite.config.ts      # Root Vite+ config (fmt, lint, staged hooks)
```

The `desktop` app imports `utils` as `import { ... } from "utils"` via workspace.

---

## Project Overview

Capubridge is a Tauri 2 desktop app built with Vue 3 + TypeScript.
It is a developer tool for hybrid app (Capacitor/Ionic) developers that combines:

- ADB device management GUI
- Deep browser storage inspector (IndexedDB, LocalStorage, Cache API, OPFS)
- Remote Chrome DevTools Protocol (CDP) connection to physical Android devices
- Capacitor-specific tooling

Full specification: see `apps/docs/SPEC.md`

---

## Tech Stack Quick Reference

| Layer              | Technology                                  |
| ------------------ | ------------------------------------------- |
| Frontend framework | Vue 3 (Composition API, `<script setup>`)   |
| Language           | TypeScript (strict)                         |
| Build              | Vite 5                                      |
| Styling            | UnoCSS (atomic CSS)                         |
| State              | Pinia (setup store syntax) + TanStack Query |
| Tables             | TanStack Table v8                           |
| Terminal           | xterm.js v5                                 |
| Code editor        | Monaco Editor                               |
| Desktop            | Tauri 2                                     |
| Backend            | Rust (thin — shell plugin + file I/O only)  |

---

## Mandatory Coding Conventions

### CRITICAL: No new `adb.exe` process spawns

**Never** spawn a new `adb.exe` process via `std::process::Command::new("adb")`. All ADB commands must go through the shared `ADB_SERVER` static `LazyLock<Mutex<ADBServer>>` which maintains a single TCP connection to the ADB daemon on port 5037.

Spawning new `adb.exe` processes causes:

- RunDLL error dialog popups on Windows (third-party DLL injection into spawned processes)
- Performance overhead (process startup, connection negotiation)
- Potential race conditions with multiple ADB server instances

**Correct pattern:**

```rust
let mut server = get_server().lock();
let mut device = server
    .get_device_by_name(&serial)
    .map_err(|e| format!("Device not found: {e}"))?;
device.shell_command(&cmd, Some(&mut stdout), None)?;
device.pull(&remote_path, &mut out)?;
```

**Wrong pattern — NEVER do this:**

```rust
let adb = which::which("adb")?;
let output = std::process::Command::new(adb)
    .args(["-s", &serial, "shell", "cmd"])
    .output()?;
```

The only exception is the global `suppress_error_dialogs()` call in `lib.rs` setup, and `CREATE_NO_WINDOW` flags for essential process spawns (like Chrome launch).

### Comments policy

- **TypeScript**: Only JSDoc comments. No inline `//` comments.
- **Rust**: Only doc comments (`///`) for public functions. No inline `//` comments.

### Vue components

```vue
<!-- ALWAYS use <script setup lang="ts"> -->
<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import type { IDBRecord } from "@/types/storage.types";

// Props with defineProps
const props = defineProps<{
  dbName: string;
  records: IDBRecord[];
  isLoading?: boolean;
}>();

// Emits with defineEmits
const emit = defineEmits<{
  refresh: [];
  recordEdit: [record: IDBRecord];
  recordDelete: [key: IDBValidKey];
}>();
</script>

<template>
  <!-- template here -->
</template>
```

### Composables

```typescript
// Always named export, always start with 'use'
// File: src/composables/useIDB.ts
export function useIDB(targetId: Ref<string>) {
  // implementation
  return {
    /* named returns only */
  };
}
```

### Pinia stores

```typescript
// Always use setup store syntax (NOT defineStore with options object)
export const useDevicesStore = defineStore("devices", () => {
  // state = refs
  const devices = ref<ADBDevice[]>([]);

  // getters = computed
  const onlineDevices = computed(() => devices.value.filter((d) => d.status === "online"));

  // actions = regular functions (async ok)
  async function refreshDevices() {}

  return { devices, onlineDevices, refreshDevices };
});
```

### TypeScript rules

- **No `any`** except in CDP response deserialization (`src/lib/cdp/`)
- **No non-null assertions (`!`)** without a comment explaining why it's safe
- All `invoke()` calls must be typed: `invoke<ReturnType>('command_name', params)`
- All CDP `send()` calls must be typed: `client.send<ResponseType>('Domain.method', params)`
- Import types with `import type { }` not `import { }`

### Error handling

```typescript
// Every invoke() needs try/catch that surfaces to UI
try {
  const devices = await invoke<ADBDevice[]>("adb_list_devices");
  devicesStore.setDevices(devices);
} catch (err) {
  toast.error(`Failed to list devices: ${err}`);
}

// CDP errors: let them propagate to useQuery error state
// useQuery handles display via isError + error properties
```

---

## Architecture Rules

### CDP writes go through Runtime.evaluate

**Never** fake local mutations. Always write through CDP so the actual target receives the change.

```typescript
// CORRECT — write goes to actual device IDB
await cdpClient.send("Runtime.evaluate", {
  expression: `new Promise((res, rej) => {
    const req = indexedDB.open('${dbName}');
    req.onsuccess = () => {
      const tx = req.result.transaction('${storeName}', 'readwrite');
      tx.objectStore('${storeName}').put(${JSON.stringify(record)});
      tx.oncomplete = () => res(true);
      tx.onerror = () => rej(tx.error?.message);
    };
  })`,
  awaitPromise: true,
  returnByValue: true,
});

// WRONG — never do this
storageStore.records.push(newRecord); // local mutation only, not on device
```

### CDP port per device

Each ADB-connected Android device gets its own forwarded port:

- Device 1 (first selected): port 9222
- Device 2: port 9223
- etc.

Port assignment is managed in `useTargetsStore`. Never hardcode 9222 directly in components.

### Virtual scrolling for all long lists

Any list that could exceed 50 items must use virtual scrolling:

- Logcat: xterm.js handles this natively
- IDB table: TanStack Table with `useVirtualizer`
- Network requests: Vue Virtual Scroller
- File explorer: Vue Virtual Scroller

### Module boundaries

Each `src/modules/*/` directory owns its own components. Cross-module imports should
go through composables or stores, not direct component imports.

```typescript
// OK — import from stores or composables (shared)
import { useDevicesStore } from "@/stores/devices.store";
import { useCDP } from "@/composables/useCDP";

// OK — import shared primitives
import Button from "@/components/primitives/Button.vue";

// AVOID — cross-module component imports
import LogcatViewer from "@/modules/devices/LogcatViewer.vue"; // from another module
```

---

## Implementing Features — Step by Step

When Codex is asked to implement a feature:

1. **Check SPEC.md** for the feature's spec section
2. **Check existing types** in `src/types/` before creating new ones
3. **Check existing composables** in `src/composables/` before duplicating logic
4. **Start with the type definitions**, then composables, then components
5. **TanStack Table** for any tabular data (not custom table HTML)
6. **TanStack Query** for CDP data fetching (not raw `ref` + `onMounted`)

### TanStack Table pattern

```typescript
// Standard pattern for any data table in this project
import {
  useVueTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from "@tanstack/vue-table";

const table = useVueTable({
  get data() {
    return records.value;
  },
  columns,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  // For large datasets, add virtualizer — see SPEC.md §5.2.2
});
```

### TanStack Query pattern

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/vue-query";

// Fetch IDB records
const { data, isLoading, isError, error, refetch } = useQuery({
  queryKey: computed(() => ["idb", targetId.value, dbName.value, storeName.value]),
  queryFn: () =>
    idbDomain.getData({
      /* params */
    }),
  enabled: computed(() => !!targetId.value && !!dbName.value),
});

// Mutate (create/update/delete)
const qc = useQueryClient();
const { mutate: deleteRecord } = useMutation({
  mutationFn: (key: IDBValidKey) => idbDomain.deleteRecord(/* params */),
  onSuccess: () => qc.invalidateQueries({ queryKey: ["idb", targetId.value] }),
});
```

---

## Rust Commands Reference

When adding a new Tauri command:

1. Add the function in `src-tauri/src/commands/adb.rs` (or appropriate file)
2. Add `#[tauri::command]` attribute
3. Register in `src-tauri/src/lib.rs` `invoke_handler`
4. Add type signature to `src/types/ipc.types.ts`

### Rust command template

```rust
#[tauri::command]
pub async fn my_command(
    app: tauri::AppHandle,
    serial: String,          // params come from JS invoke() call
) -> Result<SomeReturnType, String> {  // Err(String) maps to JS rejection
    let output = app.shell()
        .command("adb")
        .args(["-s", &serial, "some-command"])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    parse_output(&output.stdout).map_err(|e| e.to_string())
}
```

### Streaming command template (events)

```rust
#[tauri::command]
pub async fn start_streaming_command(
    app: tauri::AppHandle,
    serial: String,
    window: tauri::WebviewWindow,
) -> Result<(), String> {
    let (mut rx, _child) = app.shell()
        .command("adb")
        .args(["-s", &serial, "logcat"])
        .spawn()
        .map_err(|e| e.to_string())?;

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            if let CommandEvent::Stdout(line) = event {
                let _ = window.emit("event-name", parse_line(&line));
            }
        }
    });

    Ok(())
}
```

---

## Common Gotchas

### ADB command errors

`adb` returns exit code 0 even for some errors. Always check both stdout and stderr:

```rust
let output = app.shell().command("adb").args(&args).output().await?;
if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr);
    return Err(format!("adb error: {}", stderr));
}
```

### CDP target disconnects

WebSocket connections to CDP targets disconnect when:

- User navigates the page
- App goes to background on Android
- USB cable unplugged

Handle in `useCDP.ts`:

```typescript
ws.addEventListener("close", () => {
  connectionStore.setStatus(targetId, "disconnected");
  // Do not auto-reconnect — let user manually reconnect via F5 or button
});
```

### Large IDB datasets

CDP `IndexedDB.requestData` has a hard limit of 10,000 records per call.
Always use pagination — never try to load all records at once.
TanStack Table's server-side pagination handles this — see IDBTable.vue implementation.

### Monaco Editor in Tauri

Monaco needs a worker configuration to work correctly in Tauri's WebView.
See `vite.config.ts` for the `monaco-vite-plugin` setup.
Load Monaco lazily — it's large (~3MB). Only import in `IDBQueryConsole.vue` and `REPL.vue`.

### sql.js (WASM) in Vite

sql.js requires the WASM file to be served correctly.
Copy `sql.js/dist/sql-wasm.wasm` to `public/` and configure the locateFile option:

```typescript
import initSqlJs from "sql.js";
const SQL = await initSqlJs({
  locateFile: (file) => `/public/${file}`,
});
```

---

## File Naming Conventions

| Type                  | Convention           | Example            |
| --------------------- | -------------------- | ------------------ |
| Vue components        | PascalCase           | `IDBTable.vue`     |
| Composables           | camelCase            | `useIDB.ts`        |
| Stores                | camelCase + `.store` | `devices.store.ts` |
| Lib files             | camelCase            | `cdp-client.ts`    |
| Types files           | camelCase + `.types` | `storage.types.ts` |
| Tauri commands (Rust) | snake_case           | `adb_list_devices` |

---

## Phase 1 Task Tracking

See `apps/docs/SPEC.md` and `apps/docs/QUICKREF.md` for current product guidance.

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.

<!--VITE PLUS END-->
