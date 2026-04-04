# Capubridge Desktop Redesign — OpenCode-Inspired Design System

**Date:** 2026-04-04
**Approach:** Theme-First Overhaul (Approach 1)

---

## Design Philosophy

Capubridge should feel like a precision engineering tool, not a web app. The design follows OpenCode's neutral, restrained aesthetic: zero decorative color, flat surfaces separated by 1px borders, tight vertical rhythm, and animations that respond rather than perform. Every chromatic pixel earns its place through semantic meaning.

---

## 1. Color System

### Dark Theme (primary, dark-only for now)

Uses OpenCode's warm neutral oklch palette — very slight warm/yellow tint in grays. Not achromatic, not obviously warm. Feels organic.

| Token                      | Value                           | Usage                                        |
| -------------------------- | ------------------------------- | -------------------------------------------- |
| `--background`             | `oklch(0.1722 0.0041 106.8174)` | App background, panels                       |
| `--foreground`             | `oklch(0.9927 0.0364 107.0448)` | Primary text, active icons                   |
| `--card`                   | `oklch(0.1722 0.0041 106.8174)` | Card backgrounds (same as bg)                |
| `--card-foreground`        | `oklch(0.9927 0.0364 107.0448)` | Card text                                    |
| `--popover`                | `oklch(0.1722 0.0041 106.8174)` | Popover backgrounds                          |
| `--popover-foreground`     | `oklch(0.9927 0.0364 107.0448)` | Popover text                                 |
| `--primary`                | `oklch(0.9927 0.0364 107.0448)` | Primary buttons, active states               |
| `--primary-foreground`     | `oklch(0.1722 0.0041 106.8174)` | Text on primary                              |
| `--secondary`              | `oklch(0.4856 0.0171 107.0202)` | Secondary surfaces, borders                  |
| `--secondary-foreground`   | `oklch(0.9927 0.0364 107.0448)` | Text on secondary                            |
| `--muted`                  | `oklch(0.1722 0.0041 106.8174)` | Muted backgrounds                            |
| `--muted-foreground`       | `oklch(0.6357 0.0218 107.0046)` | Secondary text, inactive icons, descriptions |
| `--accent`                 | `oklch(0.6357 0.0218 107.0046)` | Accent surfaces                              |
| `--accent-foreground`      | `oklch(0.9927 0.0364 107.0448)` | Text on accent                               |
| `--destructive`            | `oklch(0.6368 0.2078 25.3313)`  | Destructive actions                          |
| `--destructive-foreground` | `oklch(0.9927 0.0364 107.0448)` | Text on destructive                          |
| `--border`                 | `oklch(0.4856 0.0171 107.0202)` | All borders                                  |
| `--input`                  | `oklch(0.4856 0.0171 107.0202)` | Input borders                                |
| `--ring`                   | `oklch(0.9927 0.0364 107.0448)` | Focus rings                                  |

### Semantic Status Colors (the ONLY chromatic colors)

| Token       | Value     | Usage                                   |
| ----------- | --------- | --------------------------------------- |
| `--success` | `#C4FFC0` | Online, connected, added, passing       |
| `--error`   | `#981515` | Offline, disconnected, removed, failing |
| `--warning` | `#f59e0b` | Connecting, pending, caution            |
| `--info`    | `#60a5fa` | Links, info highlights                  |

### Sidebar Tokens

| Token                          | Value               |
| ------------------------------ | ------------------- |
| `--sidebar`                    | `oklch(0.2178 0 0)` |
| `--sidebar-foreground`         | `oklch(0.9702 0 0)` |
| `--sidebar-primary`            | `oklch(0.9702 0 0)` |
| `--sidebar-primary-foreground` | `oklch(0.2178 0 0)` |
| `--sidebar-accent`             | `oklch(0.3092 0 0)` |
| `--sidebar-accent-foreground`  | `oklch(0.9702 0 0)` |
| `--sidebar-border`             | `oklch(0.3715 0 0)` |
| `--sidebar-ring`               | `oklch(0.9702 0 0)` |

---

## 2. Typography

| Role           | Font       | Size | Usage                        |
| -------------- | ---------- | ---- | ---------------------------- |
| Primary text   | Geist      | 14px | Labels, headings, nav items  |
| Secondary text | Geist      | 12px | Descriptions, metadata       |
| Tertiary text  | Geist      | 11px | Status bar, captions, counts |
| Nav labels     | Geist      | 9px  | Sidebar icon labels          |
| Mono primary   | Geist Mono | 13px | Code, values, ports          |
| Mono secondary | Geist Mono | 11px | Timestamps, IDs, hashes      |

Font stack: `--font-sans: Geist, ui-sans-serif, sans-serif, system-ui`
Mono stack: `--font-mono: Geist Mono, ui-monospace, monospace`

Geist fonts must be installed/bundled. Load via `@font-face` or CDN import in `main.css`.

---

## 3. Border Radius

| Element                   | Radius          |
| ------------------------- | --------------- |
| Panels, containers, cards | `0`             |
| Buttons, inputs, badges   | `0.25rem` (4px) |
| Base `--radius`           | `0.25rem`       |

---

## 4. Shadows & Elevation

**All shadows set to 0 opacity — completely flat UI.**

Depth comes from 1px borders (`--border`) between sections. No box-shadow, no backdrop-blur, no glow effects.

Remove: `.glass-surface`, `.glow-primary`, `.glow-dot`, all shadow utilities.

---

## 5. Animations & Transitions

| Element                 | Animation                                                      |
| ----------------------- | -------------------------------------------------------------- |
| Interactive hover       | `color 150ms ease, background-color 150ms ease`                |
| Panels/sheets appearing | `translateY(4px) → 0` over `200ms ease-out` + opacity          |
| Modals                  | `opacity 0→1` + `scale(0.98) → scale(1)` over `200ms ease-out` |
| Everything else         | None — no decorative motion                                    |

---

## 6. Layout Shell

### Top Bar (36px, full width, no bottom border)

The TitleBar and ConnectionBar are merged into one single bar spanning the full window width. Draggable for window movement.

**Left section (sidebar column):** Device selector — fills the full sidebar column width and full top bar height. Shows device name + status dot. Acts as a dropdown to switch devices.

**Right section (content column):** App name "Capubridge" left-aligned, search bar centered and wide (~280px+), mirror toggle icon + window controls (minimize, maximize, close) on the right.

No clock. No logo.

### Phone Mirror Panel (left, resizable, toggleable)

- Default width: ~220px, resizable via drag handle
- Shows live phone screen mirror (scrcpy-style frame)
- Bottom controls bar (40px): Record, Screenshot, Pop-out-to-window
- **Toggle:** Fully hidden ↔ fully shown (no collapsed state). Toggle button in top bar.
- **Pop-out:** Detaches into its own Tauri WebviewWindow. Toggle button brings it back inline.
- Positioned to the LEFT of the sidebar

### Sidebar (80px, below top bar)

- Starts below the top bar (not full height)
- Icon (16px Lucide) + label (9px Geist) stacked vertically
- No logo in the sidebar
- **Active state:** Foreground-colored icon+label, secondary background, 2px left accent bar in foreground color
- **Inactive state:** Muted-foreground icon+label, no background
- **Items:** Devices, Storage, Network, Console, Capacitor
- **Bottom pinned:** Settings
- Border-right for separation

### Sub-nav Tabs (36px)

- Below top bar, in the content column
- Tabs aligned to bottom of the row
- Active: foreground text + 2px bottom underline in foreground color
- Inactive: muted-foreground text
- Border-bottom to separate from content

### StatusBar (24px)

- Bottom of content area
- Left: connection status dot + label, CDP port
- Right: network speed, version
- 10px text, muted-foreground
- Border-top for separation

---

## 7. Component Standards

**All interactive elements use shadcn-vue components.** No native HTML buttons, selects, radios, checkboxes, or inputs.

### shadcn-vue components to use

Already installed (25): button, input, label, badge, tabs, checkbox, switch, select, dialog, popover, dropdown-menu, context-menu, sheet, menubar, tooltip, collapsible, breadcrumb, avatar, skeleton, scroll-area, textarea, separator, sidebar, resizable

May need to add: command (for command palette), toggle, toggle-group, table, card

### Component styling overrides

All components inherit from CSS variables. The token swap handles most restyling automatically. Specific overrides:

- **Button:** 4px radius, no shadow, 150ms transition. Ghost variant is the default for toolbars.
- **Input:** 4px radius, border uses `--input`, no shadow.
- **Select:** 4px radius, dropdown uses `--popover` background.
- **Dialog:** No shadow, 1px border, fade+scale animation (200ms).
- **Tabs:** No background, bottom underline indicator, foreground active color.
- **Badge:** 4px radius, no shadow. Use for counts and status labels.
- **Tooltip:** 0 radius, small text (11px), fast delay (200ms).

---

## 8. Scrollbars

Thin (5px), styled to match the neutral palette:

- Track: transparent
- Thumb: `--secondary` with hover brightening
- No border-radius on scrollbar thumb (matches 0-radius philosophy for non-interactive elements)

---

## 9. Files to Modify

### Core (token layer)

1. `src/assets/styles/main.css` — Complete rewrite with OpenCode tokens, remove old surface system/glass/glow

### Layout components

2. `src/components/layout/AppShell.vue` — New layout structure (merged top bar, mirror panel slot, sidebar below top bar)
3. `src/components/layout/TitleBar.vue` — Merge with ConnectionBar, device selector in sidebar column
4. `src/components/layout/Sidebar.vue` — 80px, icon+label, no logo, starts below top bar
5. `src/components/layout/ConnectionBar.vue` — Remove (merged into TitleBar)
6. `src/components/layout/StatusBar.vue` — Restyle with neutral tokens
7. `src/components/layout/SubNavTabs.vue` — Bottom-aligned underline indicator

### New components

8. `src/components/layout/PhoneMirror.vue` — Mirror panel with frame, controls, pop-out
9. `src/components/layout/DeviceSelector.vue` — Full-height device selector for sidebar column in top bar

### Module panels (token cascade + cleanup)

10. `src/modules/devices/DevicesPanel.vue` — Remove hardcoded colors
11. `src/modules/storage/StoragePanel.vue` — Remove hardcoded colors
12. `src/modules/storage/StorageSidebar.vue` — Neutral restyle
13. `src/modules/storage/indexeddb/IDBExplorer.vue` — Neutral restyle
14. `src/modules/storage/indexeddb/IDBTable.vue` — Neutral restyle
15. `src/modules/network/NetworkPanel.vue` — Neutral restyle
16. `src/modules/network/NetworkRequests.vue` — Neutral restyle
17. `src/modules/settings/SettingsPanel.vue` — Neutral restyle
18. `src/modules/settings/SettingsGeneral.vue` — Neutral restyle
19. `src/modules/settings/SettingsTheme.vue` — Neutral restyle
20. Other module components as needed (cascade cleanup)

### Font loading

21. Add Geist + Geist Mono font files or CDN import

---

## 10. What Gets Removed

- Teal primary color (`hsl(172, 66%, 50%)`) — replaced by neutral foreground
- Surface layering system (`--surface-0` through `--surface-4`) — replaced by single background + borders
- `.glass-surface` utility (backdrop blur)
- `.glow-primary` utility (teal ambient glow)
- `.glow-dot` utility
- Old font references (Inter, JetBrains Mono)
- Rounded top-left corner on main content (`rounded-tl-xl`)
- Separate ConnectionBar component
- Logo/DB box in sidebar
- Clock display in top bar
