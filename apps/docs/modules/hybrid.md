# Hybrid Tools

Migration and sync tools for hybrid (web-to-native) apps. Helps you migrate web components to native, sync storage between web and native, and manage Capacitor plugins.

## Migrations

Step-by-step assistant for migrating web components to native:![Screenshot showing the migrations assistant with step-by-step migration guide]
Each migration shows:

- **Step** — a migration step
- **Status** — pending, in-progress, or done
- **Instructions** — what to do
- **Verification** — how to verify it worked

### Migration catalog

Pre-built migrations for common Capacitor patterns:
| Migration | Description |
|-----------|-------------|
| Camera plugin | Migrate to `@capacitor/camera` |
| Geolocation | Migrate to `@capacitor/geolocation` |
| Push notifications | Migrate to `@capacitor/push-notifications` |
| Haptics | Migrate to `@capacitor/haptics` |

## Sync

Sync storage between the web layer and native:![Screenshot showing the storage sync panel]

- **Source** — choose IndexedDB or LocalStorage
- **Target** — choose native storage (plugin)
- **Direction** — web-to-native, native-to-web, or bidirectional
- **Conflict resolution** — last-write-wins or manual

### Sync rules

Define rules for syncing specific keys:![Screenshot showing the sync rules editor]

- **Key pattern** — glob to match storage keys
- **Direction** — one-way or bidirectional
- **Transform** — optional transformation (base64, JSON, etc.)

## Plugin management

Install and manage Capacitor plugins:![Screenshot showing the plugin manager]

- **Search** — find plugins by name
- **Install** — add a plugin to the project
- **Configure** — set plugin-specific options
- **Remove** — uninstall a plugin
