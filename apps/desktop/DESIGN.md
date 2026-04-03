# Design System: DevBridge Desktop

**Stack:** Vue 3 · shadcn-vue (New York style) · Tailwind CSS v4 · lucide-vue-next

---

## 1. Visual Theme & Atmosphere

DevBridge is a **professional developer tool** — the visual language is deliberately closer to VS Code, Zed, or JetBrains than to a SaaS web dashboard. The UI must feel like a native application that happens to run in a WebView, not a website that happens to open in a window.

**Core principles:**

- **Dense, not spacious.** Every pixel earns its place. Compact paddings, tight rows, no decorative whitespace.
- **Dark-first.** The dark theme is the primary experience. Light mode exists but is secondary.
- **Flat hierarchy through borders.** Elevation is expressed via border lines and subtle background shifts, not floating cards with drop shadows.
- **Sharp edges.** Global `--radius: 0rem` — no rounded corners except for status indicators (dot badges) and avatar thumbnails. Squared-off UI signals precision and professionalism.
- **Muted by default, violet on intent.** Color is reserved for interactive state, status feedback, and primary actions. Passive UI is near-monochrome.
- **Monospace for data.** Anything that is code, a key, a serial number, a URL, or tabular data uses the system monospace font.

**Mood keywords:** Utilitarian · Dense · Precise · Quiet · Professional

---

## 2. Color Palette & Roles

All colors are defined as CSS custom properties in `src/assets/styles/main.css` using the OKLCH color space (perceptually uniform, hue ~282–290° = violet-indigo family).

### Dark Mode (Primary)

| Descriptive Name    | OKLCH                       | Approx Hex | Role                                               |
| ------------------- | --------------------------- | ---------- | -------------------------------------------------- |
| Void Black-Indigo   | oklch(0.1436 0.0152 284.32) | `#17151f`  | App background — the deepest surface, window fill  |
| Charcoal Violet     | oklch(0.2284 0.0384 282.93) | `#23202e`  | Elevated surface — panels, cards, sidebar          |
| Slate Purple        | oklch(0.271 0.0621 281.44)  | `#2b2739`  | Muted zone — secondary panels, code backgrounds    |
| Dusk Indigo         | oklch(0.3354 0.0828 280.97) | `#3a3452`  | Accent hover surface — row hover, active list item |
| Border Purple-Slate | oklch(0.3261 0.0597 282.58) | `#3d3a50`  | All borders and dividers                           |
| Periwinkle Violet   | oklch(0.7162 0.1597 290.40) | `#8b7cf8`  | Primary action — buttons, links, active indicator  |
| Deep Violet         | oklch(0.3139 0.0736 283.46) | `#3e3563`  | Secondary action surface                           |
| Ghost White         | oklch(0.9185 0.0257 285.88) | `#e8e4f0`  | Primary text — labels, values                      |
| Lavender Grey       | oklch(0.7166 0.0462 285.17) | `#9d96b8`  | Secondary text — metadata, captions, placeholders  |
| Dim Purple-Grey     | oklch(0.5426 0.0465 284.74) | `#6a6482`  | Tertiary text — disabled state, de-emphasized info |
| Danger Red          | oklch(0.6861 0.2061 14.99)  | `#f04040`  | Destructive actions, error status                  |

### Light Mode (Secondary)

| Descriptive Name       | OKLCH                       | Approx Hex | Role                 |
| ---------------------- | --------------------------- | ---------- | -------------------- |
| Whisper Lavender       | oklch(0.973 0.0133 286.15)  | `#f5f4ff`  | App background       |
| Pure White             | oklch(1 0 0)                | `#ffffff`  | Card/panel surface   |
| Near-White Mist        | oklch(0.958 0.0133 286.15)  | `#f0effe`  | Muted zone, sidebar  |
| Periwinkle-Blue Accent | oklch(0.9221 0.0373 262.14) | `#e8ebff`  | Accent hover surface |
| Ink Purple             | oklch(0.3015 0.0572 282.42) | `#3a3558`  | Primary text         |
| Medium Violet          | oklch(0.5417 0.179 288.03)  | `#6c52e0`  | Primary action       |
| Stone Border           | oklch(0.9115 0.0216 285.96) | `#e5e2f0`  | All borders          |

### Semantic Status Colors (Both Modes)

| Status               | Color           | Hex       | Usage                             |
| -------------------- | --------------- | --------- | --------------------------------- |
| Connected / Success  | Emerald Green   | `#3dd68c` | CDP connected dot, success toast  |
| Warning / Connecting | Amber Orange    | `#f0a030` | Reconnecting state, caution badge |
| Error / Disconnected | Coral Red       | `#f04040` | Error state, failed operation     |
| Info                 | Periwinkle Blue | `#4f8ef7` | Info toast, neutral status badge  |

### Logcat Level Colors (Data Display Only)

| Level   | Color                                |
| ------- | ------------------------------------ |
| VERBOSE | `var(--muted-foreground)` — dim grey |
| DEBUG   | `var(--foreground)` — primary text   |
| INFO    | `#3dd68c` — emerald                  |
| WARN    | `#f0a030` — amber                    |
| ERROR   | `#f04040` — red                      |
| FATAL   | `#d04fc8` — magenta                  |

---

## 3. Typography Rules

**Font stack** (system-native, not loaded from CDN):

- **UI Text:** `ui-sans-serif, system-ui, sans-serif` — Segoe UI on Windows, SF Pro on macOS, system sans on Linux
- **Code / Data / Keys / URLs:** `ui-monospace, monospace` — Cascadia Code on Windows, SF Mono on macOS

**Size scale (desktop-optimized, smaller than web defaults):**

| Use                            | Size | Weight | Notes                                              |
| ------------------------------ | ---- | ------ | -------------------------------------------------- |
| Status bar text                | 11px | 400    | Absolute minimum — device serial, URL, conn status |
| Panel labels, metadata         | 12px | 400    | Column headers, secondary info, timestamps         |
| Body / nav items / table cells | 13px | 400    | Main reading size                                  |
| Section labels, subheadings    | 12px | 600    | Uppercase tracking, group separators               |
| Panel header title             | 13px | 500    | Current panel name                                 |
| Primary headings               | 14px | 600    | Only used in empty states or onboarding            |

**Tabular numerals:** Always apply `font-variant-numeric: tabular-nums` on any column displaying counts, sizes, timestamps, or port numbers. This prevents layout jitter when values change.

**Monospace data:** Record keys, IDB values, CDP expressions, serial numbers, IP addresses, and file paths must use `font-mono`. This signals "this is data, not prose."

---

## 4. Component Styling

### Layout Shell

The root layout is a **CSS grid** (`grid-template-columns: [sidebar] 1fr; grid-template-rows: 1fr [statusbar]`), fixed to `100vh`, `overflow: hidden`. No scrolling at the shell level — each panel owns its own scroll context.

```
┌─────────────────────────────────────────────────────┐
│ [Sidebar 3rem]   │  [PanelHeader 40px]              │
│                  │──────────────────────────────────│
│  Icon nav        │  [Content Area — owns overflow]  │
│  5 panels        │                                  │
│  + settings      │                                  │
│                  │                                  │
├─────────────────────────────────────────────────────│
│ [StatusBar 24px — device · target URL · conn dot]   │
└─────────────────────────────────────────────────────┘
```

### Sidebar

- **Width:** 3rem when collapsed (icon-only), 16rem when expanded
- **Background:** `var(--sidebar)` = same as card surface (slightly elevated from background)
- **Border:** 1px right border using `var(--sidebar-border)`
- **Nav items:** 32px height (h-8), icon + label. Active item uses `var(--sidebar-accent)` background with full-width highlight — no pill/rounded shape.
- **Collapse behavior:** `collapsible="icon"` — icons remain visible, labels hide
- **No section dividers between nav items** — use spacing only

### Panel Header

- **Height:** 40px (`h-10`)
- **Background:** Same as background (`var(--background)`)
- **Border:** 1px bottom border using `var(--border)`
- **Contains:** Panel title (left), contextual action buttons (right), target selector (right)
- **Buttons here:** icon-only (`size="icon-sm"`, h-8 w-8), ghost variant, with `aria-label`

### Status Bar

- **Height:** 24px
- **Background:** `var(--sidebar)` — same as sidebar for visual continuity
- **Border:** 1px top border
- **Typography:** 11px, `var(--muted-foreground)`
- **Connection dot:** 7px circle, status color, no border-radius overridden (stays circular)

### Buttons

- **Default (primary):** `bg-primary text-primary-foreground` — violet fill, white text. Used only for primary CTAs.
- **Ghost:** `hover:bg-accent` — transparent by default, used for toolbar actions and sidebar triggers
- **Outline:** `border bg-background` — for secondary actions in panels
- **Destructive:** Red fill, used only for irreversible actions (always with confirmation)
- **Sizes for desktop:** Prefer `size="sm"` (h-8) in toolbars; `size="default"` (h-9) in dialogs/forms
- **All buttons:** Sharp corners (radius inherits `--radius: 0rem`). No pill shapes.

### Data Tables (TanStack Table v8)

This is the most used component in DevBridge. Tables must look like a terminal/IDE data grid, not a web table.

- **Header row:** 32px height, 11px uppercase label, `var(--muted-foreground)`, 1px bottom border. Background `var(--muted)`.
- **Data rows:** 28px height (dense), alternating via `:nth-child(even)` at 3% opacity overlay, 1px bottom border using `var(--border)` at 50% opacity
- **Row hover:** `var(--accent)` background — the Dusk Indigo surface
- **Selected row:** `var(--primary)` at 15% opacity with left 2px accent bar
- **Cell text:** 12px for most data, `font-mono` for keys/values/types
- **Resize handles:** 1px visible on hover, `var(--border)` color
- **Sorting indicator:** `▲` / `▼` in `var(--muted-foreground)`, 10px
- **Pagination:** Compact 28px control strip below table. "10 / 1 243 records" format. Prev/next buttons ghost icon-sm.
- **Virtual rows:** Required for any store exceeding 50 records. Use `@tanstack/vue-virtual`.
- **Empty state:** Centered, 48px icon (`var(--muted-foreground)`), 13px label, no decorative card/box around it.

### Panels & Splits

- **No floating cards.** Content regions are defined by 1px borders, not `box-shadow` or rounded `bg-card` containers.
- **Split panes:** Resizable divider is a 4px grab zone with 1px visible line (e.g., Storage: tree sidebar | table main). Dragging cursor: `col-resize`.
- **Section separators within panels:** Use `<Separator>` (1px, `var(--border)`) not padding or margins.

### Form Inputs

- **Height:** 32px (`h-8`) for compact tool inputs; 36px (`h-9`) for primary forms
- **Border:** 1px `var(--border)`, no background difference from panel in dark mode (inputs are NOT white boxes)
- **Focus ring:** 2px `var(--ring)` at 50% opacity — subtle violet glow
- **Placeholder:** `var(--muted-foreground)` at 60%, ends with `…`
- **Search inputs in toolbars:** Prefix icon (Search, 14px), no label, `aria-label` required

### Dropdowns & Menus

- **Background:** `var(--popover)` — elevated surface (same as card)
- **Border:** 1px `var(--border)`
- **Shadow:** `var(--shadow-md)` — deliberately minimal, the border provides definition
- **Item height:** 28px, 12px text
- **No icons on every item** — icons only where they add meaningful scan value
- **Keyboard shortcuts:** Right-aligned in `var(--muted-foreground)`, `font-mono`

### Badges & Status Chips

- **Connection status:** 7px filled circle only (no label-style chip)
- **Level badges** (log levels, store types): 16px tall, 2px horizontal padding, 10px monospace text, background from semantic status palette at 20% opacity with matching text color. Sharp corners.
- **Count badges in sidebar:** Right-aligned, `var(--muted-foreground)`, 11px

### Tooltips

- **Trigger:** All icon-only buttons and truncated labels must have a tooltip
- **Delay:** 500ms (not instant — reduces noise while navigating)
- **Content:** 11px, dark background (`var(--popover)`), 1px border

### Dialogs & Sheets

- **Dialogs:** Centered, max-width 480px for simple, 640px for form-heavy. Border, no shadow.
- **Sheets:** Right-side only (not bottom). Width 480px. Used for detail views (request detail, file preview).
- **Overlay:** `var(--background)` at 60% opacity — not pitch black

### Code Editor (Monaco)

- **Theme:** Custom dark theme matching `--background` surface, `--foreground` text
- **Font:** `ui-monospace, monospace`, 13px, line-height 1.5
- **Line height:** 20px
- **Minimap:** Disabled by default (too much chrome)
- **Scrollbar:** Thin (6px, matches global scrollbar style)

### xterm.js (Logcat Terminal)

- **Background:** `var(--background)` — same as app background (no boxed terminal feel)
- **Font:** `ui-monospace, monospace`, 12px
- **Colors:** Map log level colors to xterm color indices consistently

---

## 5. Layout Principles

### Do

- **Occupy full space.** Panels fill their allocated grid cell entirely. No centered content with empty margins.
- **Compress vertically.** Prefer 28–32px row heights everywhere. Developer tools users scan more than they read.
- **Separate with lines.** A 1px border communicates hierarchy better than 32px of padding in a dense tool.
- **Overflow in the innermost scroll container.** The AppShell never scrolls. The sidebar tree scrolls. The table body scrolls. Each component manages its own overflow.
- **Reserve color for signal.** Use `var(--primary)` only on the one thing the user should look at or click right now.

### Don't

- **No hero sections or marketing layouts.** This is a tool. The content IS the UI.
- **No floating metric cards.** Data lives in tables and trees, not KPI cards.
- **No gradients on interactive elements.** Flat fills only. Gradients may be used sparingly for empty state illustrations.
- **No box-shadow elevation hierarchy.** Borders define regions. Shadows are nearly invisible by design (`--shadow-opacity: 0.02`).
- **No rounded panels.** `--radius: 0rem` applies globally. Resist adding `rounded-*` to card containers.
- **No full-bleed section backgrounds** in main content. The content area background is always `var(--background)`.

### Spacing Scale

The `--spacing: 0.21rem` base is tighter than web defaults. Prefer these spacing values in component interiors:

| Context                    | Value   |
| -------------------------- | ------- |
| Status bar padding         | 0 8px   |
| Sidebar item padding       | 0 8px   |
| Panel header padding       | 0 12px  |
| Toolbar button gap         | 4px     |
| Table cell padding         | 4px 8px |
| Form group gap             | 8px     |
| Section gap (within panel) | 12px    |
| Dialog/sheet padding       | 16px    |

---

## 6. Interactive States & Motion

### State Priority

`disabled < default < hover < focus-visible < active < selected`

Each state must be visually distinct. The delta between states should be larger than on consumer UIs — developer users switch context fast and need clear visual anchors.

### Hover

Background lifts by one surface level: background → muted, muted → accent, sidebar → sidebar-accent. Never change text color on hover alone (color + background together).

### Focus

2px `var(--ring)` at 50% opacity. Always visible, never suppressed. The `focus-visible` pseudo-class ensures it only appears on keyboard navigation.

### Selected / Active

Left 2px border in `var(--primary)` + background at 15% primary opacity. This pattern is used for: active nav item, selected table row, active tab, selected tree node.

### Motion

- Duration: 120ms for micro-interactions (hover states, button presses)
- Duration: 200ms for panel transitions (sidebar expand/collapse)
- Easing: `ease-out` for reveals, `ease-in` for dismissals
- **Only animate:** `transform`, `opacity`, `width`, `background-color` — never `all`
- **Respect:** `prefers-reduced-motion` — provide no-op fallback for all transitions

---

## 7. Accessibility Anchors

(Applied per Web Interface Guidelines)

- All icon-only buttons **require** `aria-label` — this is non-negotiable for toolbar buttons, sidebar triggers, and table actions.
- Logcat/terminal updates use `aria-live="polite"` on the status bar region.
- Table rows are navigable via keyboard (`role="row"`, arrow key handlers).
- Color alone never conveys status — status dot is always accompanied by text or `title` attribute.
- Sidebar collapse toggle has `aria-expanded` and `aria-controls`.

---

## 8. shadcn-vue Component Mapping

The project uses shadcn-vue **New York** style. Installed components and their desktop-adapted usage:

| Component                             | Variant/Usage in DevBridge                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| `Button`                              | `ghost` for toolbars; `default` for primary CTA; `destructive` with confirmation only |
| `Sidebar` + family                    | `variant="inset"`, `collapsible="icon"` — the main navigation shell                   |
| `DropdownMenu`                        | Device picker, target picker, column visibility toggle                                |
| `Sheet`                               | Request detail panel, file preview (right side only)                                  |
| `Tooltip`                             | Required on all icon buttons; 500ms delay                                             |
| `Input`                               | Search bars, filter inputs; `h-8` size in toolbars                                    |
| `Separator`                           | Horizontal dividers within panels                                                     |
| `Skeleton`                            | Loading state for table rows (shimmer rows, not spinner)                              |
| `Avatar`                              | Device icon / app icon in device cards                                                |
| `Breadcrumb`                          | Storage panel path (DB → Store)                                                       |
| `Collapsible`                         | Sidebar nav groups, IDB tree nodes                                                    |
| `Badge` (add if needed)               | Log level labels, connection status labels                                            |
| `Dialog` (add if needed)              | Confirmation dialogs, seed profile manager                                            |
| `Tabs` (add if needed)                | Request detail panel sections (Headers / Payload / Response / Timing)                 |
| `ResizablePanelGroup` (add if needed) | Storage panel split (tree + table)                                                    |
| `ScrollArea` (add if needed)          | Any scrollable region that needs styled scrollbar                                     |

**When adding new shadcn-vue components:**

```bash
npx shadcn-vue@latest add <component-name> -c apps/desktop
```

---

## 9. Prompting Guide (For AI-Assisted Screens)

When asking an AI to generate a new screen or component for DevBridge, include this context block:

```
This is a Tauri 2 desktop developer tool (DevBridge), NOT a web dashboard.
Design language: VS Code / JetBrains aesthetic — dense, dark, flat, sharp corners.
Stack: Vue 3 <script setup>, shadcn-vue (New York), Tailwind CSS v4 OKLCH variables.

Key constraints:
- global --radius: 0rem — NO rounded-lg/xl/2xl on panels/cards/rows
- shadows are decorative only (opacity 0.02) — use borders for elevation
- prefer h-8 (32px) rows and 12-13px text over web defaults
- toolbar buttons: ghost variant, icon-sm (28px), always aria-label
- tables: TanStack Table v8 + useVirtualizer for >50 rows
- state colors: var(--primary) violet, var(--destructive) red, semantic status greens/ambers
- no floating cards, no marketing layouts, no SaaS aesthetics
- font-mono on all data: keys, values, serials, ports, URLs, expressions
```
