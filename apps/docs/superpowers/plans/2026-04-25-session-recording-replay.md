# Session Recording & Replay — Phase 1 Vertical Slice

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record network + console + DOM (via rrweb) from any CDP target into a portable `.capu` zip bundle, then replay it on a synchronized timeline at `/replay`.

**Architecture:** Three layers — (1) Rust streams NDJSON event batches to disk and packages the final `.capu` zip; (2) TypeScript composables orchestrate CDP injection (rrweb via `Page.addScriptToEvaluateOnNewDocument` + `Runtime.addBinding`), collect events from existing stores, and flush 2s batches to Rust; (3) Vue renders the TitleBar recording button, config modal, and the `/replay` timeline player. All event timestamps are stored as `t: ms-offset-from-startedAt` so the timeline never needs clock normalization.

**Tech Stack:** `rrweb` (recorder injected into target WebView, Replayer in Vue), `zip` Rust crate (bundle packaging), Pinia setup store (recording state machine), Vue Router hash history (existing pattern), Vite `?raw` import for IIFE script injection.

---

## Design Decisions (locked — do not re-litigate)

| Decision          | Choice                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Session format    | `.capu` zip: `manifest.json` + `tracks/*.ndjson` (one per track)                                                               |
| All timestamps    | `t: number` = ms offset from `manifest.startedAt`                                                                              |
| DOM recording     | rrweb injected via `Page.addScriptToEvaluateOnNewDocument` + `Runtime.addBinding('__capuEmit')` with 50ms client-side batching |
| Event pipeline    | TS batches events every 2s → `invoke('recording_session_append')` → Rust appends to NDJSON files                               |
| Recording trigger | TitleBar button (always visible, enabled when target selected, independent of mirror panel)                                    |
| Mid-session start | Warn + offer page reload when rrweb track enabled; other tracks work without reload                                            |
| Phase 1 tracks    | rrweb (DOM) + network + console only — storage/perf/screen added in later phases                                               |
| Replay location   | `/replay` dedicated route, uses hash router (existing pattern)                                                                 |
| Session library   | Auto-save to `$APPDATA/capubridge/sessions/`; library shown in `/replay`                                                       |

---

## File Map

### New files to create

```
apps/desktop/
├── src/
│   ├── types/
│   │   └── replay.types.ts                    # All session/event/manifest types
│   ├── stores/
│   │   └── recording.store.ts                 # Recording state machine (Pinia setup store)
│   ├── lib/
│   │   └── replay/
│   │       └── rrweb-inject-script.ts         # Builds injectable rrweb script string
│   ├── composables/
│   │   ├── useRrwebRecorder.ts                # CDP injection lifecycle
│   │   ├── useSessionWriter.ts                # 2s batch flush to Rust
│   │   └── useRecordingSession.ts             # Orchestrates all tracks (top-level)
│   └── modules/
│       ├── recording/
│       │   ├── RecordingConfigModal.vue       # Simple/advanced config sheet
│       │   └── RecordingButton.vue            # TitleBar button + dropdown
│       └── replay/
│           ├── useReplaySession.ts            # Load + parse .capu file
│           ├── useTimelineClock.ts            # rAF-based playback clock + seek
│           ├── ReplayView.vue                 # /replay route root (import + library)
│           ├── ReplayTimeline.vue             # Scrubber + lane composition
│           ├── ReplayPlayer.vue               # rrweb Replayer wrapper
│           ├── ReplayNetworkLane.vue          # Network events on timeline
│           └── ReplayConsoleLane.vue          # Console events on timeline
└── src-tauri/
    └── src/
        └── commands/
            └── recording.rs                   # 5 new Tauri commands
```

### Files to modify

| File                                              | Change                                      |
| ------------------------------------------------- | ------------------------------------------- |
| `apps/desktop/package.json`                       | Add `rrweb` dependency                      |
| `apps/desktop/src-tauri/Cargo.toml`               | Add `zip` crate                             |
| `apps/desktop/src-tauri/src/commands/mod.rs`      | Add `pub mod recording;`                    |
| `apps/desktop/src-tauri/src/lib.rs`               | Register 5 new commands in `invoke_handler` |
| `apps/desktop/src/components/layout/TitleBar.vue` | Import + mount `RecordingButton`            |
| `apps/desktop/src/router/index.ts`                | Add `/replay` route                         |

---

## Task 1: Dependencies

**Files:**

- Modify: `apps/desktop/package.json`
- Modify: `apps/desktop/src-tauri/Cargo.toml`

- [ ] **Step 1: Add rrweb to desktop package**

```bash
cd apps/desktop && vp install rrweb
```

- [ ] **Step 2: Verify the rrweb IIFE build path**

After install, check what IIFE/UMD builds are available:

```bash
ls node_modules/rrweb/dist/
```

Look for a file ending in `.umd.min.js`, `.iife.min.js`, or similar. Note the exact filename — you'll use it in Task 5. If only an ESM build exists, check `node_modules/@rrweb/record/dist/` instead.

- [ ] **Step 3: Add zip crate + tauri-plugin-dialog to Cargo.toml**

Open `apps/desktop/src-tauri/Cargo.toml`. In the `[dependencies]` section, add both:

```toml
zip = { version = "2", default-features = false, features = ["deflate"] }
tauri-plugin-dialog = "2"
```

- [ ] **Step 4: Install tauri-plugin-dialog on the JS side**

```bash
cd apps/desktop && vp install @tauri-apps/plugin-dialog
```

- [ ] **Step 5: Register tauri-plugin-dialog in lib.rs**

Open `apps/desktop/src-tauri/src/lib.rs`. Find the Tauri builder chain (the `.build()`/`.run()` call). Add the dialog plugin registration **before** `.invoke_handler(...)`:

```rust
.plugin(tauri_plugin_dialog::init())
```

The builder chain should look like:

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())   // ← add this
    .plugin(tauri_plugin_shell::init())    // (existing)
    // ... other plugins ...
    .invoke_handler(tauri::generate_handler![...])
```

- [ ] **Step 6: Verify Rust builds**

```bash
cd apps/desktop/src-tauri && cargo check
```

Expected: no errors. If `zip` version conflicts, try `version = "1"`.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/package.json apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/src/lib.rs
git commit -m "feat(recording): add rrweb + zip crate + tauri-plugin-dialog dependencies"
```

---

## Task 2: Core Types

**Files:**

- Create: `apps/desktop/src/types/replay.types.ts`

All other tasks import from here. Define this first so TypeScript catches mismatches early.

- [ ] **Step 1: Create the types file**

```typescript
// apps/desktop/src/types/replay.types.ts

/** Track names supported in Phase 1 */
export type TrackName = "rrweb" | "network" | "console";

/** All tracks (Phase 1 enabled tracks are TrackName, future tracks extend this) */
export interface TrackConfig {
  rrweb: boolean;
  network: boolean;
  console: boolean;
}

/** Written as manifest.json at the root of the .capu zip */
export interface SessionManifest {
  version: 1;
  sessionId: string;
  label: string;
  startedAt: number; // Unix ms — the epoch for all `t` offsets
  duration: number; // ms, filled in when session stops
  deviceSerial: string | null;
  targetUrl: string | null;
  appPackage: string | null;
  tracks: TrackConfig;
}

/** Minimal metadata for the session library (read from manifest without loading tracks) */
export interface SessionListItem {
  sessionId: string;
  label: string;
  startedAt: number;
  duration: number;
  deviceSerial: string | null;
  targetUrl: string | null;
  filePath: string; // absolute path to .capu file on disk
  fileSizeBytes: number;
}

/** Every event written to any NDJSON track file has this shape */
export interface CapuEvent<T = unknown> {
  t: number; // ms offset from manifest.startedAt
  data: T;
}

/** Shape of a network event in network.ndjson */
export type NetworkCapuEvent = CapuEvent<{
  requestId: string;
  url: string;
  method: string;
  status: number | null;
  resourceType: string;
  duration: number | null; // ms, null if not yet complete
  transferSize: number;
  state: string;
}>;

/** Shape of a console event in console.ndjson */
export type ConsoleCapuEvent = CapuEvent<{
  level: string;
  text: string;
  source: string | null;
  line: number | null;
}>;

/** rrweb events are passed through as-is from the rrweb recorder */
export type RrwebCapuEvent = CapuEvent<unknown>; // rrweb types its own events internally

/** User config from the recording modal before starting */
export interface RecordingConfig {
  label: string;
  tracks: TrackConfig;
  reloadTarget: boolean; // whether to reload the target page for clean rrweb init
}

/** What the Rust recording_list_sessions command returns */
export interface RustSessionListItem {
  session_id: string;
  label: string;
  started_at: number;
  duration: number;
  device_serial: string | null;
  target_url: string | null;
  file_path: string;
  file_size_bytes: number;
}
```

- [ ] **Step 2: No runtime tests needed (pure types), but verify TypeScript accepts the file**

```bash
cd apps/desktop && vp check
```

Expected: no type errors from the new file.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/types/replay.types.ts
git commit -m "feat(recording): add replay.types.ts with session/track/event types"
```

---

## Task 3: Rust Recording Commands

**Files:**

- Create: `apps/desktop/src-tauri/src/commands/recording.rs`
- Modify: `apps/desktop/src-tauri/src/commands/mod.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

Five commands: `start`, `append`, `stop`, `list`, `delete`. Rust owns all file I/O. TypeScript never touches the filesystem directly for sessions.

- [ ] **Step 1: Create recording.rs**

```rust
// apps/desktop/src-tauri/src/commands/recording.rs

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use tauri::Manager;
use zip::write::{SimpleFileOptions, ZipWriter};
use zip::ZipArchive;

fn sessions_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("sessions");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn session_work_dir(app: &tauri::AppHandle, session_id: &str) -> Result<PathBuf, String> {
    let dir = sessions_dir(app)?.join(format!("{}_work", session_id));
    Ok(dir)
}

/// Creates the working directory structure for a new recording session.
#[tauri::command]
pub async fn recording_session_start(
    app: tauri::AppHandle,
    session_id: String,
) -> Result<(), String> {
    let work_dir = session_work_dir(&app, &session_id)?;
    let tracks_dir = work_dir.join("tracks");
    fs::create_dir_all(&tracks_dir).map_err(|e| format!("Failed to create session dir: {}", e))?;
    Ok(())
}

/// Appends a batch of NDJSON lines to a track file.
/// `ndjson_batch` is pre-formatted: each line is a JSON object, lines separated by '\n'.
#[tauri::command]
pub async fn recording_session_append(
    app: tauri::AppHandle,
    session_id: String,
    track: String,
    ndjson_batch: String,
) -> Result<(), String> {
    let track_file = session_work_dir(&app, &session_id)?
        .join("tracks")
        .join(format!("{}.ndjson", track));

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&track_file)
        .map_err(|e| format!("Failed to open track file: {}", e))?;

    // Ensure batch ends with newline
    let batch = if ndjson_batch.ends_with('\n') {
        ndjson_batch
    } else {
        format!("{}\n", ndjson_batch)
    };

    file.write_all(batch.as_bytes())
        .map_err(|e| format!("Failed to write batch: {}", e))?;

    Ok(())
}

/// Finalizes the session: writes manifest.json, zips everything into a .capu file,
/// removes the work directory, and returns the absolute path to the .capu file.
#[tauri::command]
pub async fn recording_session_stop(
    app: tauri::AppHandle,
    session_id: String,
    manifest_json: String,
) -> Result<String, String> {
    let work_dir = session_work_dir(&app, &session_id)?;
    let sessions_dir = sessions_dir(&app)?;

    // Create the .capu zip file (manifest.json written directly into zip — no temp file needed)
    let capu_path = sessions_dir.join(format!("{}.capu", session_id));
    let capu_file =
        fs::File::create(&capu_path).map_err(|e| format!("Failed to create .capu file: {}", e))?;

    let mut zip = ZipWriter::new(capu_file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    // Add manifest.json
    zip.start_file("manifest.json", options)
        .map_err(|e| format!("zip error: {}", e))?;
    zip.write_all(manifest_json.as_bytes())
        .map_err(|e| format!("zip write error: {}", e))?;

    // Add all track files
    let tracks_dir = work_dir.join("tracks");
    if tracks_dir.exists() {
        for entry in
            fs::read_dir(&tracks_dir).map_err(|e| format!("Failed to read tracks dir: {}", e))?
        {
            let entry = entry.map_err(|e| e.to_string())?;
            let file_name = entry.file_name();
            let name_str = file_name.to_string_lossy();
            if name_str.ends_with(".ndjson") {
                let content =
                    fs::read(&entry.path()).map_err(|e| format!("Failed to read track: {}", e))?;
                zip.start_file(format!("tracks/{}", name_str), options)
                    .map_err(|e| format!("zip error: {}", e))?;
                zip.write_all(&content)
                    .map_err(|e| format!("zip write error: {}", e))?;
            }
        }
    }

    zip.finish().map_err(|e| format!("Failed to finalize zip: {}", e))?;

    // Clean up work directory
    let _ = fs::remove_dir_all(&work_dir);

    Ok(capu_path.to_string_lossy().into_owned())
}

#[derive(Serialize)]
pub struct RustSessionListItem {
    pub session_id: String,
    pub label: String,
    pub started_at: u64,
    pub duration: u64,
    pub device_serial: Option<String>,
    pub target_url: Option<String>,
    pub file_path: String,
    pub file_size_bytes: u64,
}

/// Lists all .capu sessions from the app data directory.
/// Reads manifest.json from inside each zip without fully extracting.
#[tauri::command]
pub async fn recording_list_sessions(
    app: tauri::AppHandle,
) -> Result<Vec<RustSessionListItem>, String> {
    let sessions_dir = sessions_dir(&app)?;
    let mut items = Vec::new();

    let entries =
        fs::read_dir(&sessions_dir).map_err(|e| format!("Failed to read sessions dir: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("capu") {
            continue;
        }

        let file_size_bytes = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);

        // Read manifest from inside the zip
        if let Ok(file) = fs::File::open(&path) {
            if let Ok(mut archive) = zip::ZipArchive::new(file) {
                if let Ok(manifest_file) = archive.by_name("manifest.json") {
                    if let Ok(manifest) =
                        serde_json::from_reader::<_, serde_json::Value>(manifest_file)
                    {
                        let session_id = manifest["sessionId"]
                            .as_str()
                            .unwrap_or_default()
                            .to_string();
                        let label = manifest["label"].as_str().unwrap_or("").to_string();
                        let started_at = manifest["startedAt"].as_u64().unwrap_or(0);
                        let duration = manifest["duration"].as_u64().unwrap_or(0);
                        let device_serial = manifest["deviceSerial"].as_str().map(String::from);
                        let target_url = manifest["targetUrl"].as_str().map(String::from);

                        items.push(RustSessionListItem {
                            session_id,
                            label,
                            started_at,
                            duration,
                            device_serial,
                            target_url,
                            file_path: path.to_string_lossy().into_owned(),
                            file_size_bytes,
                        });
                    }
                }
            }
        }
    }

    // Sort by started_at descending (newest first)
    items.sort_by(|a, b| b.started_at.cmp(&a.started_at));
    Ok(items)
}

/// Deletes a session .capu file by session ID.
#[tauri::command]
pub async fn recording_delete_session(
    app: tauri::AppHandle,
    session_id: String,
) -> Result<(), String> {
    let capu_path = sessions_dir(&app)?.join(format!("{}.capu", session_id));
    if capu_path.exists() {
        fs::remove_file(&capu_path).map_err(|e| format!("Failed to delete session: {}", e))?;
    }
    // Also clean up any leftover work dir
    let work_dir = session_work_dir(&app, &session_id)?;
    if work_dir.exists() {
        let _ = fs::remove_dir_all(&work_dir);
    }
    Ok(())
}
```

- [ ] **Step 2: Register the module in mod.rs**

Open `apps/desktop/src-tauri/src/commands/mod.rs` and add:

```rust
pub mod recording;
```

- [ ] **Step 3: Register commands in lib.rs**

In `apps/desktop/src-tauri/src/lib.rs`, find the `.invoke_handler(tauri::generate_handler![` block and add the five new commands alongside the existing ones:

```rust
commands::recording::recording_session_start,
commands::recording::recording_session_append,
commands::recording::recording_session_stop,
commands::recording::recording_list_sessions,
commands::recording::recording_delete_session,
```

- [ ] **Step 4: Verify it compiles**

```bash
cd apps/desktop/src-tauri && cargo check
```

Expected: no errors. Fix any import issues (add `use zip::write::ZipWriter;` etc. if the linter complains).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src-tauri/src/commands/recording.rs \
        apps/desktop/src-tauri/src/commands/mod.rs \
        apps/desktop/src-tauri/src/lib.rs
git commit -m "feat(recording): add Rust recording commands (start/append/stop/list/delete)"
```

---

## Task 4: Recording Store

**Files:**

- Create: `apps/desktop/src/stores/recording.store.ts`
- Create: `apps/desktop/src/stores/__tests__/recording.store.test.ts`

The store is the single source of truth for recording state. Everything reads from here; only `useRecordingSession` writes to it.

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/src/stores/__tests__/recording.store.test.ts` (create the `__tests__` directory if needed):

```typescript
import { describe, test, expect, beforeEach } from "vite-plus/test";
import { setActivePinia, createPinia } from "pinia";
import { useRecordingStore } from "../recording.store";

describe("recording store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test("initial state is idle", () => {
    const store = useRecordingStore();
    expect(store.phase).toBe("idle");
    expect(store.isRecording).toBe(false);
    expect(store.sessionId).toBeNull();
  });

  test("setPhase transitions state", () => {
    const store = useRecordingStore();
    store.setPhase("recording", "session-123");
    expect(store.phase).toBe("recording");
    expect(store.sessionId).toBe("session-123");
    expect(store.isRecording).toBe(true);
  });

  test("reset returns to idle", () => {
    const store = useRecordingStore();
    store.setPhase("recording", "session-123");
    store.reset();
    expect(store.phase).toBe("idle");
    expect(store.sessionId).toBeNull();
    expect(store.startedAt).toBeNull();
  });

  test("isRecording computed is true only during recording phase", () => {
    const store = useRecordingStore();
    store.setPhase("configuring");
    expect(store.isRecording).toBe(false);
    store.setPhase("recording", "abc");
    expect(store.isRecording).toBe(true);
    store.setPhase("stopping");
    expect(store.isRecording).toBe(false);
  });

  test("startedAt is set on first transition to recording", () => {
    const store = useRecordingStore();
    expect(store.startedAt).toBeNull();
    store.setPhase("recording", "abc");
    expect(store.startedAt).toBeGreaterThan(0);
    // Subsequent setPhase calls do not reset startedAt
    const t = store.startedAt;
    store.setPhase("stopping");
    expect(store.startedAt).toBe(t);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd apps/desktop && vp test src/stores/__tests__/recording.store.test.ts
```

Expected: FAIL — `recording.store` not found.

- [ ] **Step 3: Create the store**

```typescript
// apps/desktop/src/stores/recording.store.ts
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { TrackConfig, RecordingConfig } from "@/types/replay.types";

export type RecordingPhase = "idle" | "configuring" | "recording" | "stopping";

export const useRecordingStore = defineStore("recording", () => {
  // State
  const phase = ref<RecordingPhase>("idle");
  const sessionId = ref<string | null>(null);
  const startedAt = ref<number | null>(null);
  const config = ref<RecordingConfig | null>(null);
  const errorMessage = ref<string | null>(null);

  // Getters
  const isRecording = computed(() => phase.value === "recording");
  const isConfiguring = computed(() => phase.value === "configuring");
  const isStopping = computed(() => phase.value === "stopping");

  // NOTE: do NOT add an elapsedMs computed here — Date.now() is not reactive and
  // computed() won't re-evaluate it. Components that need a live timer should
  // implement their own setInterval that reads startedAt directly.

  // Actions
  function setPhase(newPhase: RecordingPhase, newSessionId?: string) {
    phase.value = newPhase;
    if (newSessionId !== undefined) sessionId.value = newSessionId;
    if (newPhase === "recording" && startedAt.value === null) {
      startedAt.value = Date.now();
    }
    errorMessage.value = null;
  }

  function setConfig(newConfig: RecordingConfig) {
    config.value = newConfig;
  }

  function setError(msg: string) {
    errorMessage.value = msg;
    phase.value = "idle";
  }

  function reset() {
    phase.value = "idle";
    sessionId.value = null;
    startedAt.value = null;
    config.value = null;
    errorMessage.value = null;
  }

  return {
    phase,
    sessionId,
    startedAt,
    config,
    errorMessage,
    isRecording,
    isConfiguring,
    isStopping,
    setPhase,
    setConfig,
    setError,
    reset,
  };
});
```

- [ ] **Step 4: Run test — verify it passes**

```bash
cd apps/desktop && vp test src/stores/__tests__/recording.store.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/stores/recording.store.ts \
        apps/desktop/src/stores/__tests__/recording.store.test.ts
git commit -m "feat(recording): add recording store with phase state machine"
```

---

## Task 5: rrweb Inject Script Builder

**Files:**

- Create: `apps/desktop/src/lib/replay/rrweb-inject-script.ts`
- Create: `apps/desktop/src/lib/replay/__tests__/rrweb-inject-script.test.ts`

This module builds the self-contained JS string that gets injected into the target WebView via CDP. It must be a valid IIFE — no ES module syntax.

- [ ] **Step 1: Find the rrweb IIFE build path**

```bash
ls apps/desktop/node_modules/rrweb/dist/
```

Look for any file ending in `.umd.min.js`, `.iife.min.js`, or `rrweb-all.min.js`. Note the exact filename. If you don't find a UMD/IIFE build, check `@rrweb/record`:

```bash
ls apps/desktop/node_modules/@rrweb/record/dist/ 2>/dev/null || echo "not found"
```

Use whatever IIFE/UMD path you find in the import below. If only ESM builds exist, check rrweb's GitHub for the correct dist path for your installed version.

- [ ] **Step 2: Write the failing test**

```typescript
// apps/desktop/src/lib/replay/__tests__/rrweb-inject-script.test.ts
import { describe, test, expect } from "vite-plus/test";
import { buildInjectionScript } from "../rrweb-inject-script";

describe("buildInjectionScript", () => {
  test("returns a non-empty string", () => {
    const script = buildInjectionScript();
    expect(typeof script).toBe("string");
    expect(script.length).toBeGreaterThan(100);
  });

  test("includes __capuEmit binding call", () => {
    const script = buildInjectionScript();
    expect(script).toContain("__capuEmit");
  });

  test("includes pushState interception for SPA routes", () => {
    const script = buildInjectionScript();
    expect(script).toContain("pushState");
  });

  test("includes batching setTimeout", () => {
    const script = buildInjectionScript();
    expect(script).toContain("setTimeout");
  });
});
```

- [ ] **Step 3: Run test — verify it fails**

```bash
cd apps/desktop && vp test src/lib/replay/__tests__/rrweb-inject-script.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Create the inject script builder**

Replace `rrweb/dist/rrweb-all.min.js` with whatever path you found in Step 1.

```typescript
// apps/desktop/src/lib/replay/rrweb-inject-script.ts

// Vite ?raw import: loads the file content as a plain string at build time.
// This IIFE build of rrweb exposes `window.rrweb` when executed.
// IMPORTANT: verify the exact path matches your installed rrweb version.
import rrwebIife from "rrweb/dist/rrweb-all.min.js?raw";

/**
 * Builds the script string to inject into a target WebView via CDP
 * `Page.addScriptToEvaluateOnNewDocument`.
 *
 * The injected script:
 * 1. Initialises the rrweb recorder (from the embedded IIFE)
 * 2. Batches emitted events every 50ms into a single JSON array
 * 3. Sends each batch via `window.__capuEmit(json)` — the Runtime.addBinding bridge
 * 4. Intercepts `history.pushState` to emit route-change custom events
 *
 * The binding `window.__capuEmit` is set up by `Runtime.addBinding` BEFORE this
 * script runs. Events missing the binding (race condition on first load) are buffered
 * and flushed on the next timer tick after the binding is available.
 */
export function buildInjectionScript(): string {
  const initCode = `
(function() {
  'use strict';

  var __capuBuffer = [];
  var __capuTimer = null;

  function __capuFlush() {
    if (__capuBuffer.length > 0 && typeof window.__capuEmit === 'function') {
      try {
        window.__capuEmit(JSON.stringify(__capuBuffer));
      } catch (e) {
        // binding not yet ready — will retry on next tick
      }
      __capuBuffer = [];
    }
    __capuTimer = null;
  }

  function __capuScheduleFlush() {
    if (!__capuTimer) {
      __capuTimer = setTimeout(__capuFlush, 50);
    }
  }

  // Start rrweb recorder (rrweb must be available from the IIFE above)
  if (typeof rrweb !== 'undefined' && typeof rrweb.record === 'function') {
    rrweb.record({
      emit: function(event) {
        __capuBuffer.push(event);
        __capuScheduleFlush();
      },
      recordCanvas: false,
      recordCrossOriginIframes: false,
      collectFonts: false,
    });
  }

  // SPA route-change boundary injection
  var __capuLastUrl = window.location.href;
  var __capuOrigPush = history.pushState;
  var __capuOrigReplace = history.replaceState;

  function __capuEmitRouteChange(url) {
    if (url !== __capuLastUrl) {
      __capuLastUrl = url;
      if (typeof rrweb !== 'undefined' && typeof rrweb.addCustomEvent === 'function') {
        rrweb.addCustomEvent('capu:route-change', { url: url });
      }
    }
  }

  history.pushState = function() {
    __capuOrigPush.apply(this, arguments);
    __capuEmitRouteChange(window.location.href);
  };

  history.replaceState = function() {
    __capuOrigReplace.apply(this, arguments);
    __capuEmitRouteChange(window.location.href);
  };

  window.addEventListener('popstate', function() {
    __capuEmitRouteChange(window.location.href);
  });
})();
`;

  return `${rrwebIife}\n${initCode}`;
}
```

- [ ] **Step 5: Run test — verify it passes**

```bash
cd apps/desktop && vp test src/lib/replay/__tests__/rrweb-inject-script.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/lib/replay/rrweb-inject-script.ts \
        apps/desktop/src/lib/replay/__tests__/rrweb-inject-script.test.ts
git commit -m "feat(recording): add rrweb CDP injection script builder with SPA route tracking"
```

---

## Task 6: useSessionWriter

**Files:**

- Create: `apps/desktop/src/composables/useSessionWriter.ts`
- Create: `apps/desktop/src/composables/__tests__/useSessionWriter.test.ts`

Accumulates events in memory and flushes batches to Rust every 2 seconds. All other composables call `push(track, event)` on this.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/desktop/src/composables/__tests__/useSessionWriter.test.ts
import { describe, test, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { useSessionWriter } from "../useSessionWriter";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

describe("useSessionWriter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  test("push accumulates events in buffer", () => {
    const writer = useSessionWriter("session-1", 1_700_000_000_000);
    writer.push("network", { requestId: "abc", url: "https://example.com" });
    writer.push("console", { level: "error", text: "fail" });
    expect(writer.bufferSize()).toBe(2);
  });

  test("flush sends events to Rust and clears buffer", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const writer = useSessionWriter("session-1", 1_700_000_000_000);
    writer.push("network", { requestId: "abc" });
    await writer.flush();
    expect(invoke).toHaveBeenCalledWith(
      "recording_session_append",
      expect.objectContaining({
        sessionId: "session-1",
        track: "network",
      }),
    );
    expect(writer.bufferSize()).toBe(0);
  });

  test("events get t offset relative to startedAt", () => {
    const startedAt = 1_700_000_000_000;
    const writer = useSessionWriter("session-1", startedAt);
    const eventTime = startedAt + 5000;
    writer.pushAt("console", { text: "hello" }, eventTime);
    const ndjson = writer.drainAsNdjson("console");
    const parsed = JSON.parse(ndjson.trim());
    expect(parsed.t).toBe(5000);
  });

  test("flush is a no-op when buffer is empty", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const writer = useSessionWriter("session-1", 1_700_000_000_000);
    await writer.flush();
    expect(invoke).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd apps/desktop && vp test src/composables/__tests__/useSessionWriter.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the composable**

```typescript
// apps/desktop/src/composables/useSessionWriter.ts
import { invoke } from "@tauri-apps/api/core";
import type { TrackName } from "@/types/replay.types";

interface BufferedEvent {
  t: number;
  data: unknown;
}

/**
 * Per-session event writer. Call push() from any track collector.
 * Internally batches events and flushes to Rust every `flushIntervalMs`.
 *
 * Usage:
 *   const writer = useSessionWriter(sessionId, startedAt)
 *   writer.start()
 *   writer.push('network', networkEntry)  // from useNetworkStore watcher
 *   writer.pushAt('rrweb', event, event.timestamp)
 *   await writer.stop()  // flushes remainder and clears interval
 */
export function useSessionWriter(sessionId: string, startedAt: number, flushIntervalMs = 2000) {
  const buffers: Record<TrackName, BufferedEvent[]> = {
    rrweb: [],
    network: [],
    console: [],
  };

  let intervalId: ReturnType<typeof setInterval> | null = null;

  /** Push an event with the current wall-clock time as offset */
  function push(track: TrackName, data: unknown) {
    pushAt(track, data, Date.now());
  }

  /** Push an event with an explicit wall-clock timestamp (e.g. from CDP events) */
  function pushAt(track: TrackName, data: unknown, wallMs: number) {
    buffers[track].push({ t: wallMs - startedAt, data });
  }

  /** Returns total number of buffered events across all tracks */
  function bufferSize(): number {
    return Object.values(buffers).reduce((sum, arr) => sum + arr.length, 0);
  }

  /** Drains a track buffer and returns NDJSON string (for testing) */
  function drainAsNdjson(track: TrackName): string {
    const events = buffers[track].splice(0);
    return events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  }

  /** Sends all buffered events to Rust and clears buffers */
  async function flush() {
    const tracks = Object.entries(buffers) as [TrackName, BufferedEvent[]][];
    for (const [track, events] of tracks) {
      if (events.length === 0) continue;
      const batch = events.splice(0); // drain atomically
      const ndjson = batch.map((e) => JSON.stringify(e)).join("\n") + "\n";
      try {
        await invoke("recording_session_append", {
          sessionId,
          track,
          ndjsonBatch: ndjson,
        });
      } catch (err) {
        // Put events back at front of buffer so they're retried next flush
        events.unshift(...batch);
        console.error(`[SessionWriter] flush failed for track ${track}:`, err);
      }
    }
  }

  /** Start periodic flushing */
  function start() {
    if (intervalId !== null) return;
    intervalId = setInterval(flush, flushIntervalMs);
  }

  /** Flush remaining events and stop the interval */
  async function stop() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    await flush();
  }

  return { push, pushAt, flush, start, stop, bufferSize, drainAsNdjson };
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
cd apps/desktop && vp test src/composables/__tests__/useSessionWriter.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/composables/useSessionWriter.ts \
        apps/desktop/src/composables/__tests__/useSessionWriter.test.ts
git commit -m "feat(recording): add useSessionWriter with 2s batch flush to Rust"
```

---

## Task 7: useRrwebRecorder

**Files:**

- Create: `apps/desktop/src/composables/useRrwebRecorder.ts`

Handles the full CDP injection lifecycle: add binding, inject script, handle incoming events, and clean up on stop. No unit tests (pure CDP side effects) — tested end-to-end manually.

- [ ] **Step 1: Create the composable**

```typescript
// apps/desktop/src/composables/useRrwebRecorder.ts
import { buildInjectionScript } from "@/lib/replay/rrweb-inject-script";
import type { CDPClient } from "utils";
import type { useSessionWriter } from "./useSessionWriter";

type Writer = ReturnType<typeof useSessionWriter>;

/**
 * Manages rrweb injection into a CDP target WebView.
 *
 * Flow:
 * 1. Call Runtime.addBinding to create the `__capuEmit` bridge in the target
 * 2. Call Page.addScriptToEvaluateOnNewDocument to inject the rrweb recorder
 *    (persists across full navigations, rrweb keeps running on SPA pushState)
 * 3. Listen for Runtime.bindingCalled events → parse batch → push to writer
 * 4. On stop: remove the script + binding
 *
 * @param client — The CDPClient instance for the active target
 * @param writer — The session writer for this recording session
 */
export function useRrwebRecorder(client: CDPClient, writer: Writer) {
  const BINDING_NAME = "__capuEmit";
  let scriptIdentifier: string | null = null;
  let cleanupHandler: (() => void) | null = null;

  async function start(opts: { reloadTarget: boolean }) {
    // 1. Register the binding — creates window.__capuEmit in the target JS context
    await client.send("Runtime.addBinding", { name: BINDING_NAME });

    // 2. Inject the rrweb recorder script (survives full-page navigations)
    const script = buildInjectionScript();
    const response = await client.send<{ identifier: string }>(
      "Page.addScriptToEvaluateOnNewDocument",
      { source: script },
    );
    scriptIdentifier = response.identifier;

    // 3. Listen for binding calls (each call = one batch of rrweb events).
    // CDPClient.on() returns an unsubscribe function — store it for cleanup.
    const handler = (params: unknown) => {
      const p = params as { name: string; payload: string };
      if (p.name !== BINDING_NAME) return;
      try {
        const events = JSON.parse(p.payload) as Array<{ timestamp: number; [k: string]: unknown }>;
        for (const event of events) {
          // Use rrweb's own timestamp as the wall time for accurate offsets
          writer.pushAt("rrweb", event, event.timestamp);
        }
      } catch {
        // Malformed payload — skip
      }
    };

    // on() returns an unsubscribe fn — CDPClient has no separate .off() method
    const unsub = client.on("Runtime.bindingCalled", handler);
    cleanupHandler = unsub;

    // 4. Optionally reload the target so rrweb initialises from a clean page load
    if (opts.reloadTarget) {
      await client.send("Page.reload", {});
    }
  }

  async function stop() {
    // Remove the persistent script injection
    if (scriptIdentifier) {
      try {
        await client.send("Page.removeScriptToEvaluateOnNewDocument", {
          identifier: scriptIdentifier,
        });
      } catch {
        // Best-effort — target may have disconnected
      }
      scriptIdentifier = null;
    }

    // Remove the binding
    try {
      await client.send("Runtime.removeBinding", { name: BINDING_NAME });
    } catch {
      // Best-effort
    }

    // Detach event listener
    cleanupHandler?.();
    cleanupHandler = null;
  }

  return { start, stop };
}
```

- [ ] **Step 2: Run type check — verify no TypeScript errors**

```bash
cd apps/desktop && vp check
```

Expected: no errors in `useRrwebRecorder.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/composables/useRrwebRecorder.ts
git commit -m "feat(recording): add useRrwebRecorder CDP injection composable"
```

---

## Task 8: useRecordingSession (Orchestrator)

**Files:**

- Create: `apps/desktop/src/composables/useRecordingSession.ts`

Top-level composable that coordinates everything: starts the Rust session, wires up each track collector, starts the writer, and tears it all down on stop.

- [ ] **Step 1: Create the composable**

```typescript
// apps/desktop/src/composables/useRecordingSession.ts
import { invoke } from "@tauri-apps/api/core";
import { watch } from "vue";
import { useRecordingStore } from "@/stores/recording.store";
// IMPORTANT: verify these store paths with `find apps/desktop/src -name "*.store.ts" -o -name "use*Store.ts"`
// The network store is in the network module, not the root stores/ directory.
import { useNetworkStore } from "@/modules/network/stores/useNetworkStore";
import { useConsoleStore } from "@/stores/console.store";
import { useSessionWriter } from "./useSessionWriter";
import { useRrwebRecorder } from "./useRrwebRecorder";
import { useCDP } from "./useCDP";
import type { RecordingConfig, SessionManifest } from "@/types/replay.types";
import { useDevicesStore } from "@/stores/devices.store";
import { useTargetsStore } from "@/stores/targets.store";
import { toast } from "vue-sonner";

function generateSessionId(): string {
  return `capu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Orchestrates a full recording session.
 *
 * Call start(config) to begin. Call stop() to finalize and get the .capu path.
 * The recording store reflects the current phase throughout.
 */
export function useRecordingSession() {
  const recordingStore = useRecordingStore();
  const networkStore = useNetworkStore();
  const devicesStore = useDevicesStore();
  const targetsStore = useTargetsStore();
  const { activeClient } = useCDP();

  let writer: ReturnType<typeof useSessionWriter> | null = null;
  let rrwebRecorder: ReturnType<typeof useRrwebRecorder> | null = null;
  let networkUnwatch: (() => void) | null = null;
  let consoleUnwatch: (() => void) | null = null;
  let startedAt = 0;
  let activeSessionId = "";

  async function start(config: RecordingConfig): Promise<void> {
    if (recordingStore.isRecording) return;

    const sessionId = generateSessionId();
    startedAt = Date.now();
    activeSessionId = sessionId;

    recordingStore.setConfig(config);

    // 1. Tell Rust to create the session directory FIRST — only transition to
    //    "recording" phase after Rust confirms success to avoid a false-positive
    //    recording indicator in the UI.
    try {
      await invoke<void>("recording_session_start", { sessionId });
    } catch (err) {
      recordingStore.setError(`Failed to start session: ${err}`);
      return;
    }

    recordingStore.setPhase("recording", sessionId);

    // 2. Start the event writer
    writer = useSessionWriter(sessionId, startedAt);
    writer.start();

    // 3. Wire network track
    if (config.tracks.network) {
      const seenIds = new Set<string>();
      networkUnwatch = watch(
        () => networkStore.allEntries,
        (entries) => {
          for (const entry of entries) {
            if (seenIds.has(entry.requestId)) continue;
            seenIds.add(entry.requestId);
            writer!.pushAt(
              "network",
              {
                requestId: entry.requestId,
                url: entry.url,
                method: entry.method,
                status: entry.httpStatus,
                resourceType: entry.resourceType,
                duration:
                  entry.finishedTimestamp && entry.startedAt
                    ? entry.finishedTimestamp - entry.startedAt
                    : null,
                transferSize: entry.transferSize,
                state: entry.state,
              },
              entry.startedAt ?? startedAt,
            );
          }
        },
        { immediate: false },
      );
    }

    // 4. Wire console track
    // console.store exposes `entries` as a reactive ref<ConsoleEntry[]>.
    // We watch the array length and drain new entries since the last index.
    if (config.tracks.console) {
      const consoleStore = useConsoleStore();
      let lastConsoleIndex = consoleStore.entries.length;
      consoleUnwatch = watch(
        () => consoleStore.entries.length,
        () => {
          const newEntries = consoleStore.entries.slice(lastConsoleIndex);
          lastConsoleIndex = consoleStore.entries.length;
          for (const entry of newEntries) {
            writer!.pushAt(
              "console",
              {
                level: entry.level ?? "log",
                text: entry.text ?? "",
                source: entry.source ?? null,
                line: entry.line ?? null,
              },
              entry.timestamp ?? startedAt,
            );
          }
        },
      );
    }

    // 5. Wire rrweb track
    if (config.tracks.rrweb && activeClient.value) {
      rrwebRecorder = useRrwebRecorder(activeClient.value, writer);
      try {
        await rrwebRecorder.start({ reloadTarget: config.reloadTarget });
      } catch (err) {
        toast.error(`rrweb injection failed: ${err}`);
        // Non-fatal — continue recording other tracks
      }
    }
  }

  async function stop(): Promise<string | null> {
    if (!recordingStore.isRecording) return null;
    recordingStore.setPhase("stopping");

    // 1. Stop rrweb first (removes script injection)
    await rrwebRecorder?.stop();
    rrwebRecorder = null;

    // 2. Unwatch network/console
    networkUnwatch?.();
    networkUnwatch = null;
    consoleUnwatch?.();
    consoleUnwatch = null;

    // 3. Flush remaining events to Rust
    await writer?.stop();
    writer = null;

    // 4. Build manifest
    const manifest: SessionManifest = {
      version: 1,
      sessionId: activeSessionId,
      label: recordingStore.config?.label ?? "Unnamed session",
      startedAt,
      duration: Date.now() - startedAt,
      deviceSerial: devicesStore.selectedDevice?.serial ?? null,
      targetUrl: targetsStore.selectedTarget?.url ?? null,
      appPackage: devicesStore.selectedDevice
        ? null // populated later when package detection is wired
        : null,
      tracks: recordingStore.config?.tracks ?? { rrweb: false, network: false, console: false },
    };

    // 5. Tell Rust to finalize the zip
    let capuPath: string | null = null;
    try {
      capuPath = await invoke<string>("recording_session_stop", {
        sessionId: activeSessionId,
        manifestJson: JSON.stringify(manifest),
      });
    } catch (err) {
      recordingStore.setError(`Failed to package session: ${err}`);
      return null;
    }

    recordingStore.reset();
    return capuPath;
  }

  return { start, stop };
}
```

- [ ] **Step 2: Type check**

```bash
cd apps/desktop && vp check
```

Expected: no errors. If `useConsoleStore` import path is wrong, find the correct path with:

```bash
find apps/desktop/src/stores -name "console*"
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/composables/useRecordingSession.ts
git commit -m "feat(recording): add useRecordingSession orchestrator (network + rrweb tracks)"
```

---

## Task 9: Recording UI — Button + Config Modal

**Files:**

- Create: `apps/desktop/src/modules/recording/RecordingConfigModal.vue`
- Create: `apps/desktop/src/modules/recording/RecordingButton.vue`
- Modify: `apps/desktop/src/components/layout/TitleBar.vue`

- [ ] **Step 1: Create RecordingConfigModal.vue**

```vue
<!-- apps/desktop/src/modules/recording/RecordingConfigModal.vue -->
<script setup lang="ts">
import { ref, computed } from "vue";
import { X, ChevronDown, ChevronUp, Video, Globe, MonitorDot } from "lucide-vue-next";
import { useTargetsStore } from "@/stores/targets.store";
import type { RecordingConfig } from "@/types/replay.types";

const emit = defineEmits<{
  start: [config: RecordingConfig];
  cancel: [];
}>();

const targetsStore = useTargetsStore();
const showAdvanced = ref(false);
const label = ref(`Session ${new Date().toLocaleTimeString()}`);
const reloadTarget = ref(true);

// Track toggles (simple mode shows all-or-nothing; advanced shows per-track)
const trackRrweb = ref(true);
const trackNetwork = ref(true);
const trackConsole = ref(true);

const hasTarget = computed(() => targetsStore.selectedTarget !== null);
const targetUrl = computed(() => targetsStore.selectedTarget?.url ?? "No target selected");

function handleStart() {
  emit("start", {
    label: label.value.trim() || "Unnamed session",
    tracks: {
      rrweb: trackRrweb.value && hasTarget.value,
      network: trackNetwork.value,
      console: trackConsole.value,
    },
    reloadTarget: reloadTarget.value && trackRrweb.value,
  });
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
    <div
      class="w-[420px] rounded-xl border border-border/30 bg-background shadow-2xl overflow-hidden"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-border/20">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          <span class="text-sm font-medium text-foreground">New Recording</span>
        </div>
        <button
          class="w-6 h-6 flex items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-surface-2 transition-colors"
          @click="emit('cancel')"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Body -->
      <div class="px-5 py-4 space-y-4">
        <!-- Session label -->
        <div class="space-y-1.5">
          <label class="text-xs text-muted-foreground font-medium">Session name</label>
          <input
            v-model="label"
            type="text"
            placeholder="Describe the scenario..."
            class="w-full h-8 px-3 text-sm rounded-md border border-border/30 bg-surface-1 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-accent/50 transition-colors"
          />
        </div>

        <!-- Target info -->
        <div
          class="flex items-center gap-2 px-3 py-2 rounded-md bg-surface-1 border border-border/20"
        >
          <Globe class="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
          <span class="text-xs text-muted-foreground truncate">{{ targetUrl }}</span>
        </div>

        <!-- Simple track toggles -->
        <div class="space-y-1.5">
          <label class="text-xs text-muted-foreground font-medium">Capture</label>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="item in [
                { key: 'rrweb', label: 'DOM Replay', icon: MonitorDot, model: trackRrweb },
                { key: 'network', label: 'Network', icon: Globe, model: trackNetwork },
                { key: 'console', label: 'Console', icon: Video, model: trackConsole },
              ]"
              :key="item.key"
              class="flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg border transition-colors text-center"
              :class="
                item.model
                  ? 'border-accent/40 bg-accent/8 text-accent'
                  : 'border-border/20 bg-surface-1 text-muted-foreground/40 hover:text-muted-foreground hover:border-border/40'
              "
              @click="
                item.key === 'rrweb'
                  ? (trackRrweb = !trackRrweb)
                  : item.key === 'network'
                    ? (trackNetwork = !trackNetwork)
                    : (trackConsole = !trackConsole)
              "
            >
              <component :is="item.icon" class="w-4 h-4" />
              <span class="text-[10px] font-medium leading-tight">{{ item.label }}</span>
            </button>
          </div>
        </div>

        <!-- Reload warning (shown when rrweb enabled) -->
        <div
          v-if="trackRrweb && hasTarget"
          class="flex items-start gap-2 px-3 py-2.5 rounded-md bg-amber-500/8 border border-amber-500/20"
        >
          <span class="text-amber-400 text-xs leading-relaxed">
            DOM replay requires reloading the target page for a clean capture.
          </span>
          <label class="flex items-center gap-1.5 shrink-0 cursor-pointer">
            <input v-model="reloadTarget" type="checkbox" class="accent-accent" />
            <span class="text-xs text-muted-foreground">Reload</span>
          </label>
        </div>

        <!-- rrweb disabled warning -->
        <div
          v-if="trackRrweb && !hasTarget"
          class="px-3 py-2 rounded-md bg-surface-1 border border-border/20 text-xs text-muted-foreground/60"
        >
          DOM Replay requires a selected target — select a target first.
        </div>

        <!-- Advanced toggle -->
        <button
          class="flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          @click="showAdvanced = !showAdvanced"
        >
          <component :is="showAdvanced ? ChevronUp : ChevronDown" class="w-3 h-3" />
          Advanced options
        </button>

        <!-- Advanced section (Phase 2 — storage depth, screen capture etc.) -->
        <div
          v-if="showAdvanced"
          class="px-3 py-2.5 rounded-md border border-border/20 bg-surface-1 text-xs text-muted-foreground/50"
        >
          Storage capture, screen recording, and performance tracks coming in Phase 2.
        </div>
      </div>

      <!-- Footer -->
      <div class="flex gap-2 px-5 py-4 border-t border-border/20">
        <button
          class="flex-1 h-8 text-sm rounded-md border border-border/25 text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
          @click="emit('cancel')"
        >
          Cancel
        </button>
        <button
          class="flex-1 h-8 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors font-medium"
          @click="handleStart"
        >
          Start Recording
        </button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Create RecordingButton.vue**

```vue
<!-- apps/desktop/src/modules/recording/RecordingButton.vue -->
<script setup lang="ts">
import { ref, computed } from "vue";
import { Circle, Square, FolderOpen } from "lucide-vue-next";
import { useRouter } from "vue-router";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "vue-sonner";
import { useRecordingStore } from "@/stores/recording.store";
import { useTargetsStore } from "@/stores/targets.store";
import { useRecordingSession } from "@/composables/useRecordingSession";
import RecordingConfigModal from "./RecordingConfigModal.vue";
import type { RecordingConfig } from "@/types/replay.types";

const router = useRouter();
const recordingStore = useRecordingStore();
const targetsStore = useTargetsStore();
const { start, stop } = useRecordingSession();

const showModal = ref(false);
const canRecord = computed(() => targetsStore.selectedTarget !== null || true); // also allow without target (network-only)

async function handleStart(config: RecordingConfig) {
  showModal.value = false;
  await start(config);
}

async function handleStop() {
  const capuPath = await stop();
  if (capuPath) {
    toast.success("Session saved", {
      description: "Recording complete",
      action: {
        label: "View",
        onClick: () => router.push(`/replay?session=${encodeURIComponent(capuPath)}`),
      },
    });
  }
}
</script>

<template>
  <div>
    <!-- Idle: show record button -->
    <button
      v-if="!recordingStore.isRecording && !recordingStore.isStopping"
      class="flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] transition-all border"
      :class="
        canRecord
          ? 'border-border/25 text-muted-foreground/50 hover:text-destructive hover:border-destructive/40 hover:bg-destructive/8'
          : 'border-border/15 text-muted-foreground/20 cursor-not-allowed'
      "
      :disabled="!canRecord"
      title="Start recording session"
      @click="canRecord && (showModal = true)"
    >
      <Circle class="w-2.5 h-2.5" />
      <span>Record</span>
    </button>

    <!-- Recording: show stop button + live timer -->
    <button
      v-else-if="recordingStore.isRecording"
      class="flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] border border-destructive/40 bg-destructive/10 text-destructive transition-all hover:bg-destructive/20"
      title="Stop recording"
      @click="handleStop"
    >
      <span class="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
      <Square class="w-2 h-2 fill-current" />
      <span>Stop</span>
    </button>

    <!-- Stopping: disabled spinner state -->
    <button
      v-else
      disabled
      class="flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] border border-border/20 text-muted-foreground/30 cursor-not-allowed"
    >
      <span class="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-pulse" />
      <span>Saving…</span>
    </button>

    <!-- Config modal -->
    <RecordingConfigModal v-if="showModal" @start="handleStart" @cancel="showModal = false" />
  </div>
</template>
```

- [ ] **Step 3: Add RecordingButton to TitleBar.vue**

Open `apps/desktop/src/components/layout/TitleBar.vue`. Add the import after the existing imports:

```typescript
import RecordingButton from "@/modules/recording/RecordingButton.vue";
```

In the template, find the right section (between the Mirror button and window controls):

```html
<!-- Add between the Mirror button and the window controls div -->
<RecordingButton />
```

Specifically, place it after the existing Mirror button (`</button>` that has the ScreenShare icon), before the window controls `<div class="flex items-center ml-1">`.

- [ ] **Step 4: Type check**

```bash
cd apps/desktop && vp check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/recording/RecordingConfigModal.vue \
        apps/desktop/src/modules/recording/RecordingButton.vue \
        apps/desktop/src/components/layout/TitleBar.vue
git commit -m "feat(recording): add RecordingButton and config modal in TitleBar"
```

---

## Task 10: Timeline Clock

**Files:**

- Create: `apps/desktop/src/modules/replay/useTimelineClock.ts`
- Create: `apps/desktop/src/modules/replay/__tests__/useTimelineClock.test.ts`

The clock drives the scrubber position during playback. It is the single source of current time `T` that all lane components read to know which events are visible.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/desktop/src/modules/replay/__tests__/useTimelineClock.test.ts
import { describe, test, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { useTimelineClock } from "../useTimelineClock";

describe("useTimelineClock", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("initial position is 0", () => {
    const clock = useTimelineClock(60_000);
    expect(clock.positionMs.value).toBe(0);
    expect(clock.isPlaying.value).toBe(false);
  });

  test("seekTo clamps to [0, duration]", () => {
    const clock = useTimelineClock(60_000);
    clock.seekTo(-1000);
    expect(clock.positionMs.value).toBe(0);
    clock.seekTo(999_999);
    expect(clock.positionMs.value).toBe(60_000);
  });

  test("seekTo sets exact position within bounds", () => {
    const clock = useTimelineClock(60_000);
    clock.seekTo(30_000);
    expect(clock.positionMs.value).toBe(30_000);
  });

  test("progress computed is position / duration", () => {
    const clock = useTimelineClock(60_000);
    clock.seekTo(30_000);
    expect(clock.progress.value).toBeCloseTo(0.5);
  });

  test("seekTo at end stops playback", () => {
    const clock = useTimelineClock(60_000);
    clock.play();
    clock.seekTo(60_000);
    expect(clock.isPlaying.value).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd apps/desktop && vp test src/modules/replay/__tests__/useTimelineClock.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create useTimelineClock.ts**

```typescript
// apps/desktop/src/modules/replay/useTimelineClock.ts
import { ref, computed, onUnmounted } from "vue";

/**
 * Controls the replay timeline position.
 *
 * The clock advances positionMs in real time when playing (via rAF).
 * All replay components read positionMs to know the current time T.
 *
 * @param durationMs — total session duration from the manifest
 */
export function useTimelineClock(durationMs: number) {
  const positionMs = ref(0);
  const isPlaying = ref(false);

  let rafId: number | null = null;
  let lastTimestamp: number | null = null;

  const progress = computed(() =>
    durationMs > 0 ? Math.min(positionMs.value / durationMs, 1) : 0,
  );

  const remainingMs = computed(() => Math.max(durationMs - positionMs.value, 0));

  function seekTo(ms: number) {
    const clamped = Math.max(0, Math.min(ms, durationMs));
    positionMs.value = clamped;
    if (clamped >= durationMs) {
      pause();
    }
  }

  function seekToProgress(p: number) {
    seekTo(p * durationMs);
  }

  function play() {
    if (isPlaying.value) return;
    if (positionMs.value >= durationMs) seekTo(0); // restart if at end
    isPlaying.value = true;
    lastTimestamp = null;
    rafId = requestAnimationFrame(tick);
  }

  function pause() {
    isPlaying.value = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastTimestamp = null;
  }

  function toggle() {
    isPlaying.value ? pause() : play();
  }

  function tick(ts: number) {
    if (!isPlaying.value) return;
    if (lastTimestamp !== null) {
      const delta = ts - lastTimestamp;
      positionMs.value = Math.min(positionMs.value + delta, durationMs);
      if (positionMs.value >= durationMs) {
        pause();
        return;
      }
    }
    lastTimestamp = ts;
    rafId = requestAnimationFrame(tick);
  }

  onUnmounted(pause);

  return {
    positionMs,
    isPlaying,
    progress,
    remainingMs,
    play,
    pause,
    toggle,
    seekTo,
    seekToProgress,
  };
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
cd apps/desktop && vp test src/modules/replay/__tests__/useTimelineClock.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/replay/useTimelineClock.ts \
        apps/desktop/src/modules/replay/__tests__/useTimelineClock.test.ts
git commit -m "feat(replay): add useTimelineClock with rAF-based playback and seek"
```

---

## Task 11: Replay Session Loader

**Files:**

- Create: `apps/desktop/src/modules/replay/useReplaySession.ts`

Loads a `.capu` file from the filesystem, extracts the manifest and track NDJSON, and exposes parsed event arrays for the lane components.

- [ ] **Step 1: Create useReplaySession.ts**

```typescript
// apps/desktop/src/modules/replay/useReplaySession.ts
import { ref, computed } from "vue";
import { invoke } from "@tauri-apps/api/core";
import type {
  SessionManifest,
  NetworkCapuEvent,
  ConsoleCapuEvent,
  RrwebCapuEvent,
} from "@/types/replay.types";

interface LoadedSession {
  manifest: SessionManifest;
  rrwebEvents: RrwebCapuEvent[];
  networkEvents: NetworkCapuEvent[];
  consoleEvents: ConsoleCapuEvent[];
}

/**
 * Loads and parses a .capu session file.
 *
 * The Rust command `recording_read_session` extracts the zip and returns
 * the manifest + raw NDJSON strings for each track. This composable parses
 * them into typed event arrays.
 */
export function useReplaySession() {
  const session = ref<LoadedSession | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const manifest = computed(() => session.value?.manifest ?? null);
  const rrwebEvents = computed(() => session.value?.rrwebEvents ?? []);
  const networkEvents = computed(() => session.value?.networkEvents ?? []);
  const consoleEvents = computed(() => session.value?.consoleEvents ?? []);

  async function loadFromPath(filePath: string): Promise<void> {
    isLoading.value = true;
    error.value = null;
    session.value = null;

    try {
      // Rust extracts the zip and returns raw content as strings
      const raw = await invoke<{ manifest_json: string; tracks: Record<string, string> }>(
        "recording_read_session",
        { filePath },
      );

      const manifest: SessionManifest = JSON.parse(raw.manifest_json);

      const rrwebEvents: RrwebCapuEvent[] = raw.tracks["rrweb"]
        ? parseNdjson<RrwebCapuEvent>(raw.tracks["rrweb"])
        : [];

      const networkEvents: NetworkCapuEvent[] = raw.tracks["network"]
        ? parseNdjson<NetworkCapuEvent>(raw.tracks["network"])
        : [];

      const consoleEvents: ConsoleCapuEvent[] = raw.tracks["console"]
        ? parseNdjson<ConsoleCapuEvent>(raw.tracks["console"])
        : [];

      session.value = { manifest, rrwebEvents, networkEvents, consoleEvents };
    } catch (err) {
      error.value = String(err);
    } finally {
      isLoading.value = false;
    }
  }

  function clear() {
    session.value = null;
    error.value = null;
  }

  return {
    session,
    manifest,
    rrwebEvents,
    networkEvents,
    consoleEvents,
    isLoading,
    error,
    loadFromPath,
    clear,
  };
}

function parseNdjson<T>(ndjson: string): T[] {
  return ndjson
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      try {
        return JSON.parse(line) as T;
      } catch {
        return null;
      }
    })
    .filter((e): e is T => e !== null);
}
```

- [ ] **Step 2: Add `recording_read_session` Rust command**

Open `apps/desktop/src-tauri/src/commands/recording.rs` and add (note: `HashMap` and `ZipArchive` are already imported at the top of the file from Task 3 — do not duplicate those `use` statements):

```rust
#[derive(Serialize)]
pub struct RustSessionContents {
    pub manifest_json: String,
    pub tracks: HashMap<String, String>,
}

/// Reads a .capu file and returns the manifest + all track NDJSON as strings.
/// The frontend is responsible for parsing NDJSON into typed objects.
#[tauri::command]
pub async fn recording_read_session(file_path: String) -> Result<RustSessionContents, String> {
    let file = std::fs::File::open(&file_path)
        .map_err(|e| format!("Cannot open session file: {}", e))?;

    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Invalid .capu file: {}", e))?;

    let manifest_json = {
        let mut manifest_file = archive
            .by_name("manifest.json")
            .map_err(|_| "manifest.json not found in .capu file".to_string())?;
        let mut content = String::new();
        std::io::Read::read_to_string(&mut manifest_file, &mut content)
            .map_err(|e| format!("Failed to read manifest: {}", e))?;
        content
    };

    let mut tracks = HashMap::new();
    let track_names = ["rrweb", "network", "console"];

    for track in &track_names {
        let zip_path = format!("tracks/{}.ndjson", track);
        if let Ok(mut track_file) = archive.by_name(&zip_path) {
            let mut content = String::new();
            if std::io::Read::read_to_string(&mut track_file, &mut content).is_ok() {
                tracks.insert(track.to_string(), content);
            }
        }
    }

    Ok(RustSessionContents { manifest_json, tracks })
}
```

Register the new command in `lib.rs`:

```rust
commands::recording::recording_read_session,
```

- [ ] **Step 3: Verify Rust compiles**

```bash
cd apps/desktop/src-tauri && cargo check
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/replay/useReplaySession.ts \
        apps/desktop/src-tauri/src/commands/recording.rs \
        apps/desktop/src-tauri/src/lib.rs
git commit -m "feat(replay): add useReplaySession loader + Rust recording_read_session command"
```

---

## Task 12: ReplayPlayer (rrweb Replayer wrapper)

**Files:**

- Create: `apps/desktop/src/modules/replay/ReplayPlayer.vue`

Wraps rrweb's `Replayer` class. Reacts to `positionMs` from the timeline clock by calling `player.play(t)` and `player.pause()`.

- [ ] **Step 1: Create ReplayPlayer.vue**

```vue
<!-- apps/desktop/src/modules/replay/ReplayPlayer.vue -->
<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from "vue";
import { Replayer } from "rrweb";
import type { eventWithTime } from "rrweb";
import type { RrwebCapuEvent } from "@/types/replay.types";

const props = defineProps<{
  events: RrwebCapuEvent[];
  positionMs: number; // driven by useTimelineClock
  isPlaying: boolean;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
let replayer: Replayer | null = null;

function initReplayer() {
  if (!containerRef.value || props.events.length === 0) return;

  // Destroy any existing instance
  replayer?.destroy?.();

  // Each RrwebCapuEvent wraps the raw rrweb eventWithTime under `.data`.
  // JSON.stringify/parse in the recording pipeline preserves all rrweb fields
  // (type, timestamp, data), so this cast is safe.
  replayer = new Replayer(props.events.map((e) => e.data) as eventWithTime[], {
    root: containerRef.value,
    skipInactive: false,
    showWarning: false,
    showDebug: false,
    speed: 1,
    // Use the container dimensions
    mouseTail: {
      duration: 500,
      lineCap: "round",
      lineWidth: 3,
      strokeStyle: "rgba(220,38,38,0.6)",
    },
  });
}

onMounted(() => {
  if (props.events.length > 0) initReplayer();
});

onUnmounted(() => {
  replayer?.destroy?.();
  replayer = null;
});

// Re-init when events load
watch(
  () => props.events,
  (events) => {
    if (events.length > 0) initReplayer();
  },
  { deep: false },
);

// Sync playback state from parent clock
watch(
  () => props.isPlaying,
  (playing) => {
    if (!replayer) return;
    if (playing) {
      replayer.play(props.positionMs);
    } else {
      replayer.pause(props.positionMs);
    }
  },
);

// Seek when position changes while paused (user dragging scrubber)
watch(
  () => props.positionMs,
  (ms) => {
    if (!replayer || props.isPlaying) return;
    replayer.pause(ms);
  },
);
</script>

<template>
  <div class="relative w-full h-full overflow-hidden bg-surface-1 rounded-lg">
    <!-- rrweb mounts its iframe here -->
    <div ref="containerRef" class="w-full h-full" />

    <!-- Empty state -->
    <div
      v-if="events.length === 0"
      class="absolute inset-0 flex items-center justify-center text-muted-foreground/40 text-sm"
    >
      No DOM events recorded
    </div>
  </div>
</template>
```

- [ ] **Step 2: Type check**

```bash
cd apps/desktop && vp check
```

If rrweb types aren't found, install them:

```bash
cd apps/desktop && vp install @types/rrweb
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/replay/ReplayPlayer.vue
git commit -m "feat(replay): add ReplayPlayer component wrapping rrweb Replayer"
```

---

## Task 13: ReplayNetworkLane + ReplayConsoleLane

**Files:**

- Create: `apps/desktop/src/modules/replay/ReplayNetworkLane.vue`
- Create: `apps/desktop/src/modules/replay/ReplayConsoleLane.vue`

Each lane shows events up to the current `positionMs`. Clicking an event seeks the timeline to that event's `t`.

- [ ] **Step 1: Create ReplayNetworkLane.vue**

```vue
<!-- apps/desktop/src/modules/replay/ReplayNetworkLane.vue -->
<script setup lang="ts">
import { computed } from "vue";
import type { NetworkCapuEvent } from "@/types/replay.types";

const props = defineProps<{
  events: NetworkCapuEvent[];
  positionMs: number;
}>();

const emit = defineEmits<{
  seek: [t: number];
}>();

const visibleEvents = computed(
  () => props.events.filter((e) => e.t <= props.positionMs).slice(-100), // last 100
);

function statusColor(status: number | null): string {
  if (!status) return "text-muted-foreground/40";
  if (status < 300) return "text-emerald-400";
  if (status < 400) return "text-amber-400";
  return "text-destructive";
}

function methodColor(method: string): string {
  const colors: Record<string, string> = {
    GET: "text-blue-400",
    POST: "text-emerald-400",
    PUT: "text-amber-400",
    DELETE: "text-destructive",
    PATCH: "text-purple-400",
  };
  return colors[method] ?? "text-muted-foreground";
}

function formatMs(t: number): string {
  const s = Math.floor(t / 1000);
  const ms = t % 1000;
  return `${s}.${String(ms).padStart(3, "0")}s`;
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="px-3 py-2 border-b border-border/20 flex items-center gap-2">
      <span class="text-xs font-medium text-muted-foreground">Network</span>
      <span class="text-[10px] text-muted-foreground/40">{{ visibleEvents.length }} requests</span>
    </div>
    <div class="flex-1 overflow-y-auto">
      <div
        v-for="event in visibleEvents"
        :key="event.data.requestId"
        class="flex items-center gap-2 px-3 py-1.5 border-b border-border/10 hover:bg-surface-2 cursor-pointer group text-xs"
        @click="emit('seek', event.t)"
      >
        <span class="text-[10px] text-muted-foreground/40 w-14 shrink-0 font-mono">
          {{ formatMs(event.t) }}
        </span>
        <span
          :class="[
            'w-10 shrink-0 font-mono font-medium text-[10px]',
            methodColor(event.data.method),
          ]"
        >
          {{ event.data.method }}
        </span>
        <span :class="['w-8 shrink-0 text-[10px] font-mono', statusColor(event.data.status)]">
          {{ event.data.status ?? "—" }}
        </span>
        <span
          class="flex-1 truncate text-foreground/70 group-hover:text-foreground transition-colors"
        >
          {{ event.data.url }}
        </span>
        <span v-if="event.data.duration" class="text-[10px] text-muted-foreground/40 shrink-0">
          {{ event.data.duration }}ms
        </span>
      </div>
      <div v-if="visibleEvents.length === 0" class="px-3 py-4 text-xs text-muted-foreground/40">
        No network requests yet
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Create ReplayConsoleLane.vue**

```vue
<!-- apps/desktop/src/modules/replay/ReplayConsoleLane.vue -->
<script setup lang="ts">
import { computed } from "vue";
import type { ConsoleCapuEvent } from "@/types/replay.types";

const props = defineProps<{
  events: ConsoleCapuEvent[];
  positionMs: number;
}>();

const emit = defineEmits<{
  seek: [t: number];
}>();

const visibleEvents = computed(() =>
  props.events.filter((e) => e.t <= props.positionMs).slice(-200),
);

const levelStyle: Record<string, string> = {
  error: "text-destructive bg-destructive/8 border-destructive/20",
  warn: "text-amber-400 bg-amber-400/8 border-amber-400/20",
  info: "text-blue-400 bg-blue-400/8 border-blue-400/20",
  log: "text-foreground/70 bg-transparent border-border/10",
  debug: "text-muted-foreground/50 bg-transparent border-border/10",
};

function formatMs(t: number): string {
  const s = Math.floor(t / 1000);
  const ms = t % 1000;
  return `${s}.${String(ms).padStart(3, "0")}s`;
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="px-3 py-2 border-b border-border/20 flex items-center gap-2">
      <span class="text-xs font-medium text-muted-foreground">Console</span>
      <span class="text-[10px] text-muted-foreground/40">{{ visibleEvents.length }}</span>
    </div>
    <div class="flex-1 overflow-y-auto font-mono">
      <div
        v-for="(event, i) in visibleEvents"
        :key="i"
        class="flex items-start gap-2 px-3 py-1 border-b cursor-pointer hover:bg-surface-2 text-[11px]"
        :class="levelStyle[event.data.level] ?? levelStyle.log"
        @click="emit('seek', event.t)"
      >
        <span class="text-muted-foreground/40 w-14 shrink-0 pt-px">
          {{ formatMs(event.t) }}
        </span>
        <span
          class="uppercase text-[9px] w-8 shrink-0 pt-px font-semibold tracking-wide opacity-70"
        >
          {{ event.data.level }}
        </span>
        <span class="flex-1 break-all whitespace-pre-wrap">{{ event.data.text }}</span>
      </div>
      <div v-if="visibleEvents.length === 0" class="px-3 py-4 text-xs text-muted-foreground/40">
        No console output yet
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Type check**

```bash
cd apps/desktop && vp check
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/replay/ReplayNetworkLane.vue \
        apps/desktop/src/modules/replay/ReplayConsoleLane.vue
git commit -m "feat(replay): add ReplayNetworkLane and ReplayConsoleLane timeline lanes"
```

---

## Task 14: ReplayTimeline (Scrubber + Lane Composition)

**Files:**

- Create: `apps/desktop/src/modules/replay/ReplayTimeline.vue`

The scrubber bar and the container that composes all lane components.

- [ ] **Step 1: Create ReplayTimeline.vue**

```vue
<!-- apps/desktop/src/modules/replay/ReplayTimeline.vue -->
<script setup lang="ts">
import { ref, computed } from "vue";
import { Play, Pause, SkipBack } from "lucide-vue-next";
import type { useTimelineClock } from "./useTimelineClock";
import type { NetworkCapuEvent, ConsoleCapuEvent, RrwebCapuEvent } from "@/types/replay.types";
import ReplayPlayer from "./ReplayPlayer.vue";
import ReplayNetworkLane from "./ReplayNetworkLane.vue";
import ReplayConsoleLane from "./ReplayConsoleLane.vue";

type Clock = ReturnType<typeof useTimelineClock>;

const props = defineProps<{
  clock: Clock;
  durationMs: number;
  rrwebEvents: RrwebCapuEvent[];
  networkEvents: NetworkCapuEvent[];
  consoleEvents: ConsoleCapuEvent[];
}>();

const scrubberRef = ref<HTMLDivElement | null>(null);
const isDragging = ref(false);

const progressPct = computed(() => `${props.clock.progress.value * 100}%`);

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function handleScrubClick(e: MouseEvent) {
  if (!scrubberRef.value) return;
  const rect = scrubberRef.value.getBoundingClientRect();
  const p = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1));
  props.clock.seekToProgress(p);
}

function handleSeekFromLane(t: number) {
  props.clock.seekTo(t);
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Top: rrweb player + event lanes -->
    <div class="flex flex-1 overflow-hidden gap-px bg-border/20">
      <!-- rrweb DOM replay -->
      <div class="flex-1 min-w-0 bg-background">
        <ReplayPlayer
          :events="rrwebEvents"
          :position-ms="clock.positionMs.value"
          :is-playing="clock.isPlaying.value"
        />
      </div>

      <!-- Right panel: stacked lanes -->
      <div class="w-[360px] shrink-0 flex flex-col bg-background divide-y divide-border/20">
        <div class="flex-1 overflow-hidden">
          <ReplayNetworkLane
            :events="networkEvents"
            :position-ms="clock.positionMs.value"
            @seek="handleSeekFromLane"
          />
        </div>
        <div class="flex-1 overflow-hidden">
          <ReplayConsoleLane
            :events="consoleEvents"
            :position-ms="clock.positionMs.value"
            @seek="handleSeekFromLane"
          />
        </div>
      </div>
    </div>

    <!-- Bottom: timeline scrubber bar -->
    <div class="shrink-0 border-t border-border/20 bg-background px-4 py-3 space-y-2">
      <!-- Scrubber track -->
      <div
        ref="scrubberRef"
        class="relative h-1.5 rounded-full bg-surface-2 cursor-pointer group"
        @click="handleScrubClick"
        @mousedown="isDragging = true"
        @mouseup="isDragging = false"
      >
        <!-- Progress fill -->
        <div
          class="absolute inset-y-0 left-0 rounded-full bg-accent transition-none"
          :style="{ width: progressPct }"
        />
        <!-- Thumb -->
        <div
          class="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-accent border-2 border-background shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
          :style="{ left: progressPct, transform: 'translate(-50%, -50%)' }"
        />
      </div>

      <!-- Controls row -->
      <div class="flex items-center gap-3">
        <button
          class="w-6 h-6 flex items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-surface-2 transition-colors"
          title="Restart"
          @click="clock.seekTo(0)"
        >
          <SkipBack class="w-3 h-3" />
        </button>

        <button
          class="w-7 h-7 flex items-center justify-center rounded-full bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
          @click="clock.toggle()"
        >
          <Pause v-if="clock.isPlaying.value" class="w-3.5 h-3.5" />
          <Play v-else class="w-3.5 h-3.5 translate-x-px" />
        </button>

        <span class="text-xs font-mono text-muted-foreground/60">
          {{ formatTime(clock.positionMs.value) }} / {{ formatTime(durationMs) }}
        </span>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Type check**

```bash
cd apps/desktop && vp check
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/replay/ReplayTimeline.vue
git commit -m "feat(replay): add ReplayTimeline with scrubber and lane composition"
```

---

## Task 15: ReplayView + Router

**Files:**

- Create: `apps/desktop/src/modules/replay/ReplayView.vue`
- Modify: `apps/desktop/src/router/index.ts`

The `/replay` route root: shows the session library, handles import, and renders the full timeline once a session is loaded.

- [ ] **Step 1: Create ReplayView.vue**

```vue
<!-- apps/desktop/src/modules/replay/ReplayView.vue -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { useRoute } from "vue-router";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Trash2, Clock, MonitorDot } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { useReplaySession } from "./useReplaySession";
import { useTimelineClock } from "./useTimelineClock";
import ReplayTimeline from "./ReplayTimeline.vue";
import type { SessionListItem, RustSessionListItem } from "@/types/replay.types";

const route = useRoute();
const { manifest, rrwebEvents, networkEvents, consoleEvents, isLoading, error, loadFromPath } =
  useReplaySession();

const sessions = ref<SessionListItem[]>([]);
const loadingSessions = ref(false);

// IMPORTANT: Do NOT call useTimelineClock inside computed() — composables that
// use onUnmounted cannot run outside component setup context. Use ref + watch instead.
const clock = ref<ReturnType<typeof useTimelineClock> | null>(null);
watch(
  manifest,
  (m) => {
    // Pause any running clock before replacing it
    clock.value?.pause();
    clock.value = m ? useTimelineClock(m.duration) : null;
  },
  { immediate: true },
);

// useTimelineClock calls onUnmounted(pause) internally, but onUnmounted only
// registers when called synchronously during component setup — NOT inside a
// watch callback. We must clean up explicitly here to prevent rAF loop leaks.
onUnmounted(() => clock.value?.pause());

// Load session list on mount
onMounted(async () => {
  await refreshSessions();

  // If route has ?session= query param, load it directly (from toast "View" click)
  const sessionParam = route.query.session as string | undefined;
  if (sessionParam) {
    await loadFromPath(decodeURIComponent(sessionParam));
  }
});

async function refreshSessions() {
  loadingSessions.value = true;
  try {
    const raw = await invoke<RustSessionListItem[]>("recording_list_sessions");
    sessions.value = raw.map((r) => ({
      sessionId: r.session_id,
      label: r.label,
      startedAt: r.started_at,
      duration: r.duration,
      deviceSerial: r.device_serial,
      targetUrl: r.target_url,
      filePath: r.file_path,
      fileSizeBytes: r.file_size_bytes,
    }));
  } catch (err) {
    toast.error(`Failed to load sessions: ${err}`);
  } finally {
    loadingSessions.value = false;
  }
}

async function handleImport() {
  const selected = await open({
    filters: [{ name: "Capubridge Session", extensions: ["capu"] }],
    multiple: false,
  });
  if (selected && typeof selected === "string") {
    await loadFromPath(selected);
  }
}

async function handleDelete(sessionId: string) {
  try {
    await invoke<void>("recording_delete_session", { sessionId });
    await refreshSessions();
  } catch (err) {
    toast.error(`Failed to delete session: ${err}`);
  }
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString();
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <!-- Sidebar: session library -->
    <div
      class="w-[280px] shrink-0 flex flex-col border-r border-border/20 bg-background overflow-hidden"
    >
      <div class="px-4 py-3 border-b border-border/20 flex items-center justify-between">
        <span class="text-sm font-medium text-foreground">Sessions</span>
        <button
          class="flex items-center gap-1.5 h-6 px-2 rounded text-xs text-muted-foreground/60 hover:text-foreground hover:bg-surface-2 transition-colors"
          @click="handleImport"
        >
          <FolderOpen class="w-3 h-3" />
          Import
        </button>
      </div>

      <div class="flex-1 overflow-y-auto">
        <div
          v-if="loadingSessions"
          class="flex items-center justify-center py-8 text-sm text-muted-foreground/40"
        >
          Loading…
        </div>

        <div v-else-if="sessions.length === 0" class="px-4 py-8 text-center space-y-2">
          <MonitorDot class="w-8 h-8 text-muted-foreground/20 mx-auto" />
          <p class="text-xs text-muted-foreground/40">No sessions yet</p>
          <p class="text-[11px] text-muted-foreground/30">
            Start a recording or import a .capu file
          </p>
        </div>

        <button
          v-for="session in sessions"
          :key="session.sessionId"
          class="w-full px-4 py-3 border-b border-border/10 text-left hover:bg-surface-1 transition-colors group"
          :class="
            manifest?.sessionId === session.sessionId
              ? 'bg-accent/8 border-l-2 border-l-accent'
              : ''
          "
          @click="loadFromPath(session.filePath)"
        >
          <div class="flex items-start justify-between gap-2">
            <span class="text-xs font-medium text-foreground truncate">{{ session.label }}</span>
            <button
              class="shrink-0 opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all"
              @click.stop="handleDelete(session.sessionId)"
            >
              <Trash2 class="w-3 h-3" />
            </button>
          </div>
          <div class="flex items-center gap-2 mt-1">
            <Clock class="w-2.5 h-2.5 text-muted-foreground/30" />
            <span class="text-[10px] text-muted-foreground/40">
              {{ formatDuration(session.duration) }} · {{ formatSize(session.fileSizeBytes) }}
            </span>
          </div>
          <div class="text-[10px] text-muted-foreground/30 mt-0.5">
            {{ formatDate(session.startedAt) }}
          </div>
        </button>
      </div>
    </div>

    <!-- Main: replay player or empty state -->
    <div class="flex-1 overflow-hidden">
      <!-- Loading -->
      <div
        v-if="isLoading"
        class="h-full flex items-center justify-center text-muted-foreground/40 text-sm"
      >
        Loading session…
      </div>

      <!-- Error -->
      <div
        v-else-if="error"
        class="h-full flex items-center justify-center text-destructive text-sm"
      >
        {{ error }}
      </div>

      <!-- Replay timeline (session loaded) -->
      <ReplayTimeline
        v-else-if="manifest && clock"
        :clock="clock"
        :duration-ms="manifest.duration"
        :rrweb-events="rrwebEvents"
        :network-events="networkEvents"
        :console-events="consoleEvents"
      />

      <!-- Empty state -->
      <div v-else class="h-full flex flex-col items-center justify-center gap-4 text-center px-8">
        <MonitorDot class="w-12 h-12 text-muted-foreground/15" />
        <div class="space-y-1">
          <p class="text-sm text-muted-foreground/50">Select a session to replay</p>
          <p class="text-xs text-muted-foreground/30">
            Or import a .capu file from another machine
          </p>
        </div>
        <button
          class="flex items-center gap-2 h-8 px-4 rounded-md text-sm border border-border/25 text-muted-foreground/60 hover:text-foreground hover:bg-surface-2 transition-colors"
          @click="handleImport"
        >
          <FolderOpen class="w-3.5 h-3.5" />
          Import .capu file
        </button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Add `/replay` route to the router**

Open `apps/desktop/src/router/index.ts`. Following the existing lazy-load pattern, add:

```typescript
{
  path: "/replay",
  component: () => import("@/modules/replay/ReplayView.vue"),
},
```

Add it alongside the other top-level routes (before or after `/settings`).

- [ ] **Step 3: Install the dialog plugin if not present**

The `open()` call from `@tauri-apps/plugin-dialog` requires the plugin. Check if it's already in `package.json`. If not:

```bash
cd apps/desktop && vp install @tauri-apps/plugin-dialog
```

And ensure it's registered in `src-tauri/src/lib.rs` (check for `tauri_plugin_dialog`).

- [ ] **Step 4: Update ipc.types.ts with new command signatures**

Per project convention (CLAUDE.md), all new Tauri commands must be typed in `apps/desktop/src/types/ipc.types.ts`. Open that file and add comment-style signatures for the 6 new commands:

```typescript
// Recording commands (recording.rs)
// invoke('recording_session_start', { sessionId: string }): Promise<void>
// invoke('recording_session_append', { sessionId: string, track: string, ndjsonBatch: string }): Promise<void>
// invoke('recording_session_stop', { sessionId: string, manifestJson: string }): Promise<string>  // returns capu file path
// invoke('recording_list_sessions'): Promise<RustSessionListItem[]>
// invoke('recording_delete_session', { sessionId: string }): Promise<void>
// invoke('recording_read_session', { filePath: string }): Promise<{ manifest_json: string, tracks: Record<string, string> }>
```

- [ ] **Step 5: Type check + lint**

```bash
cd apps/desktop && vp check
```

Fix any remaining type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/modules/replay/ReplayView.vue \
        apps/desktop/src/router/index.ts \
        apps/desktop/src/types/ipc.types.ts
git commit -m "feat(replay): add ReplayView and /replay route — vertical slice complete"
```

---

## Manual End-to-End Test Checklist

Before considering Phase 1 done, verify this full flow manually:

- [ ] **Recording flow:**
  - Select a CDP target (any Chrome tab or WebView)
  - Click Record button in TitleBar → config modal opens
  - Set a session name, keep all tracks on → Start Recording
  - Modal warns about page reload → accept
  - Target page reloads, recording indicator appears (red dot in TitleBar)
  - Browse the target app for 30+ seconds — trigger network requests, console logs
  - Click Stop → "Session saved" toast appears with "View" action

- [ ] **Session library:**
  - Navigate to `/replay` — session appears in left sidebar
  - Session shows correct label, duration, and file size

- [ ] **Replay playback:**
  - Click session in sidebar → timeline loads
  - rrweb player renders the recorded DOM on the right
  - Network lane shows requests with timestamps
  - Console lane shows log entries
  - Click Play → timeline advances, network + console lanes fill in progressively
  - Drag scrubber → player seeks, lanes update

- [ ] **Import flow:**
  - Copy a `.capu` file to another location
  - Click Import in `/replay` → file picker → select the copied file
  - Session loads and plays correctly

- [ ] **Without target (network-only):**
  - Deselect target, leave only network + console tracks on
  - Start recording → no page reload warning
  - Verify recording starts and saves without rrweb track

---

## What's NOT in Phase 1 (future phases)

| Feature                                                      | Phase |
| ------------------------------------------------------------ | ----- |
| Storage tracks (IDB baseline + deltas, localStorage, SQLite) | 2     |
| Performance tracks (native ADB perf, CDP heap metrics)       | 2     |
| Screen capture tracks (scrcpy MP4, getDisplayMedia)          | 3     |
| Pop-out ReplayWindow (separate Tauri webview)                | 3     |
| Advanced config modal (per-store depth, quality settings)    | 2     |
| Clickmap / activity heatmap overlay                          | 4     |
| Session comments + collaboration                             | 5     |
| E2E framework export                                         | 5     |
| Skip-silence feature                                         | 3     |
