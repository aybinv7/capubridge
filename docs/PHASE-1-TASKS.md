# DevBridge — Phase 1 Tasks

> Cut scope: foundation + IDB read. Done when you can connect a USB Android device and browse its IndexedDB.

---

## Task List

### T01 — Project scaffold

- Init Tauri 2 project: `pnpm create tauri-app devbridge -- --template vue-ts`
- Install all deps from SPEC.md Appendix A
- Configure UnoCSS with Tailwind preset
- Configure TypeScript strict mode in `tsconfig.json`
- Set up ESLint with `@antfu/eslint-config`
- Set up path aliases (`@/` → `src/`) in vite + tsconfig
- Verify `pnpm tauri dev` runs

**Acceptance:** `pnpm tauri dev` opens a window. No TS errors. Linter passes.

---

### T02 — Design tokens + AppShell

- Create `src/assets/styles/tokens.css` with all CSS custom properties from SPEC.md §11
- Create `AppShell.vue` — outer container with sidebar + main area layout
- Create `Sidebar.vue` — icon nav, 52px wide, 5 panel icons + settings at bottom
- Create `PanelHeader.vue` — 40px top bar per panel, accepts title + slot for controls
- Create `StatusBar.vue` — 24px bottom bar, placeholder slots
- Create placeholder views for all 5 panels so routing works

**Acceptance:** App has correct chrome. Sidebar highlights active panel. Correct dark color scheme from tokens.

---

### T03 — Routing

- Install and configure Vue Router 4
- Set up all routes from SPEC.md §12
- All panel routes lazy-load their components
- Default redirect `/` → `/devices`

**Acceptance:** Clicking sidebar icons navigates between panels. Browser history works.

---

### T04 — Pinia + store skeleton

- Install Pinia
- Create `devices.store.ts` with state shape and empty actions
- Create `targets.store.ts` with state shape and empty actions
- Create `connection.store.ts` with state shape and empty actions
- Create `ui.store.ts` for sidebar state, active panel
- Add all stores to `main.ts`

**Acceptance:** `useDevicesStore()` works in any component. Vue DevTools shows all stores.

---

### T05 — Tauri: adb_list_devices

- Add `tauri-plugin-shell` to Cargo.toml and register in `lib.rs`
- Set shell plugin permissions in `capabilities/default.json` to allow `adb` command
- Implement `adb_list_devices()` command in `src-tauri/src/commands/adb.rs`
- Implement `parse_devices()` — parse `adb devices -l` output into `Vec<AdbDevice>`
- Register command in `invoke_handler`
- Add `ADBDevice` type to `src/types/adb.types.ts`
- Test manually: `invoke('adb_list_devices')` in browser console returns device array

**Acceptance:** With a USB device connected, `invoke('adb_list_devices')` returns the device. Without device, returns empty array.

---

### T06 — Device panel: device list UI

- Implement `DevicesPanel.vue` as panel root
- Implement `DeviceList.vue` — polls `invoke('adb_list_devices')` every 3 seconds
- Implement `DeviceCard.vue` — shows model, serial, status badge, battery, connection type
- Wire selection to `devicesStore.selectDevice()`
- Show empty state when no devices connected
- Show loading state on first poll
- Status badges: online (green), offline (gray), unauthorized (yellow with help text)

**Acceptance:** Device appears in list. Selecting it updates store. Unplugging shows offline state within 3s.

---

### T07 — Tauri: adb_forward_cdp

- Implement `adb_forward_cdp(serial, local_port)` command
- Implement `adb_remove_forward(serial, local_port)` command
- Shell: `adb -s <serial> forward tcp:<port> localabstract:chrome_devtools_remote`
- Add to `ipc.types.ts`

**Acceptance:** After running, `fetch('http://localhost:9222/json')` returns a JSON array of targets from the device.

---

### T08 — CDP client

- Implement `CDPClient` class in `src/lib/cdp/client.ts` — full implementation from SPEC.md §9
- Implement `fetchLocalTargets(port)` in `src/lib/cdp/targets.ts`
- Implement `forwardAndFetchTargets(serial, port)` in `src/lib/cdp/targets.ts`
- Add CDP types to `src/types/cdp.types.ts`
- Unit test: `CDPClient.send()` resolves on matching id response, rejects on error response

**Acceptance:** Unit tests pass. Manual test: can connect to `localhost:9222` and send `Runtime.evaluate`.

---

### T09 — Targets store + target picker

- Implement `fetchTargets()` in `targets.store.ts` — calls `forwardAndFetchTargets` for active device
- Implement `connect()` in `connection.store.ts` — creates CDPClient, stores in map
- Implement target picker UI in `PanelHeader.vue`:
  - Dropdown showing all available targets (page title + URL)
  - Connects on selection
  - Shows connection status indicator (dot: gray/green/red)
- Auto-fetch targets when a device is selected
- Auto-port-forward when an Android device target is selected

**Acceptance:** Select USB device → targets appear in dropdown → select a target → CDP connects → status dot turns green.

---

### T10 — IDB domain wrapper

- Implement `IDBDomain` class in `src/lib/cdp/domains/indexeddb.ts` — from SPEC.md §9
- Methods: `enable()`, `getDatabases()`, `getDatabase()`, `getData()`, `deleteRecord()`, `clearStore()`
- Add `deserializeRemoteObject()` helper — convert CDP remote object representation to plain JS value
- Unit test: `getData()` structures paginated results correctly

**Acceptance:** Unit tests pass. `idbDomain.getDatabases(origin)` returns correct databases for a test page.

---

### T11 — Storage panel: IDB table (read-only)

- Implement `StoragePanel.vue` panel root
- Implement `StorageSidebar.vue` with tree showing all IDB databases + stores for active target
- Implement `IDBExplorer.vue` — loads and displays records for selected store
- Implement `IDBTable.vue` using TanStack Table v8:
  - Auto-generated columns from first 50 records
  - Sortable columns
  - Server-side pagination (page size: 50/100/500)
  - Loading skeleton while fetching
  - Record count in toolbar
  - Refresh button
- Use TanStack Query for data fetching with `queryKey` including targetId + db + store + page
- Implement `JsonTree.vue` shared component for rendering nested object values in cells

**Acceptance:** Select a Capacitor app target → IDB sidebar shows all databases → click a store → records appear in table → pagination works → refresh button re-fetches.

---

### T12 — Status bar wiring

- Wire connected device name to status bar left slot
- Wire active target URL to status bar center slot
- Wire CDP connection status to status bar right slot

**Acceptance:** Status bar shows correct info when device + target are selected.

---

## Phase 1 Definition of Done

- [ ] App opens on macOS, Windows, Linux (dev mode)
- [ ] USB Android device appears in device panel within 3 seconds of connecting
- [ ] Selecting a device + target connects CDP (green status dot)
- [ ] IDB sidebar shows all databases and object stores
- [ ] Clicking a store loads records into TanStack Table
- [ ] Pagination works for stores with 1000+ records
- [ ] No TypeScript errors (`pnpm vue-tsc --noEmit`)
- [ ] No ESLint errors (`pnpm eslint src/`)
- [ ] Unit tests pass for CDPClient and IDBDomain (`pnpm vitest run`)
