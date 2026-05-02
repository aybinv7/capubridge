# Device Sessions

Capubridge manages devices through a **session runtime** in Rust. Understanding sessions helps you work with the app's lifecycle model.

## Session states

Each device connected to Capubridge has a **session state**:

### Hot

The **active device** you're currently working with. Only one device can be hot at a time.

- Live features are allowed (logcat, perf, mirror, console)
- Target and package snapshots are considered **fresh**
- UI shows an active status dot

### Warm

A **known device** that was connected before.

- Snapshot data may still be usable
- Live features are **not** allowed
- UI shows a warm status

### Cold

A **stale device** — offline, disconnected, or restored from a previous session.

- Snapshot data is **marked stale**
- UI shows a gray or stale indicator

## Active device switching

When you switch the active device:

1. The previous device becomes **cold** (data stays visible, marked stale)
2. The new device becomes **hot** (live features allowed)
3. Snapshot data for the new device is **refreshed**

## Session leases

Live features are **explicit leases** bound to the hot device:

- **Logcat** — streams live system logs
- **Perf** — streams CPU/memory metrics
- **Mirror** — streams device screen
- **Console** — attaches to the selected target
  When you navigate away from a feature, the lease is **stopped automatically**. This is managed by the session runtime — no manual cleanup needed.

## Explicit intents

The frontend **never** drives transport through watchers. All behavior starts from **explicit user intents**:

- Clicking **Connect** starts the device session
- Clicking **Refresh** refreshes the snapshot
- Clicking **Logcat** starts the logcat lease
- Navigating away stops the lease
  This prevents hidden transport fanout and keeps the app predictable. <div class="tip">The key rule: no watcher-driven transport orchestration. Rust owns the session state. Vue renders snapshots and sends intents.</div>
