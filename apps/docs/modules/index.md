# Module Overview

Capubridge organizes its functionality into **feature modules** — self-contained areas that own their own components, composables, and stores. Modules are accessed through the sidebar navigation.

## Module list

Capubridge ships with 11 feature modules plus a Dock:
| Module | Description | Route |
|--------|------------|-------|
| **Devices** | ADB management, logcat, file explorer, app browser | `/devices` |
| **Storage** | IndexedDB, LocalStorage, SQLite, OPFS, Cache | `/storage` |
| **Network** | Request inspection, throttling, mocking | `/network` |
| **Capacitor** | Capacitor config, plugins, permissions, deeplinks | `/capacitor` |
| **Inspect** | DOM tree, styles, computed, box model | `/inspect` |
| **Mirror** | Device screen streaming | `/mirror` |
| **Recording** | Session recording and replay | `/recording` |
| **App** | App inspector (overview, perf, permissions) | `/app` |
| **Hybrid** | Migration tools for hybrid apps | `/hybrid` |
| **Settings** | App configuration | `/settings` |
| **Dock** | AI assistant, logcat, REPL, console | bottom panel |

## Module structure

Each module follows the same pattern:

```
modules/
  <name>/
    <Name>Panel. vue        # Root panel
    <Name>*. vue              # Components
    use<Name>. ts            # Composables (optional)
    *. utils.ts            # Utilities (optional)
```

## Module shell anatomy

Every module panel has:

1. **Module Header** — title, subtitle, actions (sticky)
2. **SubNavTabs** — only when the module uses sub-routes
3. **Module Body** — the work surface
4. **Dense modules** — TanStack Table, virtual scrolling, mono fonts

## Cross-module imports

Components do **not** import from other modules directly. Cross-module communication goes through: <div class="grid grid-2cols gap-4 my-6">[Stores →](../architecture/stores) Pinia stores for shared state.</div>
