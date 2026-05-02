# Capubridge — UI Redesign Spec

> Locked design decisions from the 2026-04-20 grill-me session.
> Goal: make Capubridge feel like Codex / Claude Desktop (native, high-contrast, calm chrome) while keeping devtools density inside work surfaces.
> Execute this spec module-by-module — do not big-bang.

---

## 0. The core principle

**Calm chrome, dense modules.**

- Chrome (title bar, sidebar, dock header, empty states, settings, onboarding) follows Codex / Claude Desktop — generous whitespace, one hero element per screen, low visual noise, high contrast.
- Modules (IDB table, logcat, network waterfall, JSON editors) stay devtools-dense — every pixel earns its place, small row heights, mono font where appropriate.
- A single density toggle is **not** added. The split is structural, not a user setting.

---

## 1. Locked decisions (the 18 questions)

| #   | Decision                                                                                                         | Locked |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | Codex aesthetic applies to _chrome + landing + AI + settings_ only. Modules stay dense.                          | ✓      |
| 2   | Left nav = collapsible labeled sidebar, `⌘B` toggles, persisted.                                                 | ✓      |
| 3   | Sidebar stays top-level-only. `SubNavTabs.vue` stays.                                                            | ✓      |
| 4   | AI assistant lives in a **bottom dock** (VS Code terminal style), toggled by `⌘J`, resizable.                    | ✓      |
| 4b  | AI ships in this redesign (MVP-now), not reserve-space-only.                                                     | ✓      |
| 5   | Console module **folds into the bottom dock**. Sidebar drops to 6 modules.                                       | ✓      |
| 6   | `StatusBar.vue` is **deleted**. Connection dot → sidebar footer. Metrics → per-module toolbars.                  | ✓      |
| 7   | **Hand-tuned palette, shadcn-vue structure**. Dark-only v1; `:root` structured so light-mode is a later drop-in. | ✓ rec  |
| 8   | Specific color ramp — see §4.                                                                                    | ✓ rec  |
| 9   | Typography — Geist + Geist Mono, base 13px, scale 11/13/15/18/22/28. See §5.                                     | ✓ rec  |
| 10  | `--radius` bumped to `0.625rem` (10px). Real shadows added for elevated surfaces.                                | ✓ rec  |
| 11  | Sidebar anatomy: brand + nav + connection/target pill + footer. See §6.                                          | ✓ rec  |
| 12  | TitleBar anatomy cleaned: drag + breadcrumb + dock toggles + ⌘K + window controls. See §7.                       | ✓ rec  |
| 13  | Module header: single sticky row with title + actions; SubNavTabs below only when needed. See §9.                | ✓ rec  |
| 14  | Empty states: centered hero (icon + headline + sub + 1 primary + 2 secondary). See §10.                          | ✓ rec  |
| 15  | Density scale: `surface-interactive` row 28px inside modules, 36px in sidebar/dock tabs. See §11.                | ✓ rec  |
| 16  | Icons: `lucide-vue-next` only. Stroke `1.5` idle / `1.75` active. Sizes 14/16/18/20.                             | ✓ rec  |
| 17  | 6 rollout phases, order: tokens → shell → dock → modules → AI → polish. See §13.                                 | ✓ rec  |
| 18  | First PR = tokens + shell only (no per-module visuals yet). Low-risk.                                            | ✓ rec  |

---

## 2. What gets deleted (dead/retired code)

Execute these in Phase 2 (shell rebuild):

| Path                                                   | Why                                                                                                  |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `apps/desktop/src/components/layout/ConnectionBar.vue` | Not mounted in `AppShell.vue`. Hardcoded mocks (`"Galaxy S23"`, `"localhost:9222"`). Pure dead code. |
| `apps/desktop/src/components/layout/StatusBar.vue`     | Replaced by sidebar-footer status dot + per-module metric chips.                                     |
| `apps/desktop/src/modules/console/ConsolePanel.vue`    | Console module folds into bottom dock.                                                               |
| Route subtree `/console/*` in `router/index.ts`        | Rewritten as dock tabs, not router children.                                                         |

Keep but move/refactor:

| Path                                                     | Action                                                    |
| -------------------------------------------------------- | --------------------------------------------------------- |
| `apps/desktop/src/modules/devices/DeviceLogcat.vue`      | Re-home as a **dock tab** (no longer imported by router). |
| `apps/desktop/src/modules/console/ConsoleOutput.vue`     | Re-home as dock tab.                                      |
| `apps/desktop/src/modules/console/ConsoleExceptions.vue` | Re-home as dock tab.                                      |
| `apps/desktop/src/modules/console/ConsoleRepl.vue`       | Re-home as dock tab.                                      |

---

## 3. New shell structure

```
┌──────────────────────────────────────────────────────────────┐
│  TitleBar (h-11)                                             │
│  [drag] Breadcrumb │ spacer │ ⌘J dock · Mirror · ⌘K · ─ □ ×  │
├──────────┬───────────────────────────────────────────────────┤
│          │                                                   │
│ Sidebar  │  Main content                                     │
│ 260/56px │  ┌────────────────────────────────────────────┐   │
│          │  │ ModuleHeader (h-14)  title · actions       │   │
│ Brand    │  ├────────────────────────────────────────────┤   │
│ ── Nav ─ │  │ SubNavTabs (h-10, only if module uses)     │   │
│ Devices  │  ├────────────────────────────────────────────┤   │
│ Storage  │  │                                            │   │
│ Network  │  │   Dense module body                        │   │
│ Capac…   │  │                                            │   │
│ Inspect  │  └────────────────────────────────────────────┘   │
│          │                                                   │
│ ── ctx ─ │  ┌────────────────────────────────────────────┐   │
│ [device  │  │ Bottom Dock (resizable, 0–70% vh)          │   │
│  pill ]  │  │ Assistant · Logcat · REPL · Output · Excep │   │
│          │  │ ─────────────────────────────────────────  │   │
│ ● conn   │  │ [pop-out]                                  │   │
│ ⚙ set    │  └────────────────────────────────────────────┘   │
└──────────┴───────────────────────────────────────────────────┘

Mirror panel: slides from left/right. If AI dock is docked & wide,
Mirror auto-flips to the opposite side. If both requested same side,
AI dock wins (Mirror gets a detached window by default).
```

Changes from current shell:

- `ConnectionBar.vue` removed (was already dead).
- `StatusBar.vue` removed.
- `Sidebar.vue` rewritten as collapsible labeled sidebar (was 72px icon rail).
- `TitleBar.vue` loses `ConnectionSummary` (moved to sidebar) and `Mirror` text button (kept but icon-only; joined by new `Dock` toggle).
- New: `BottomDock.vue` + `DockTab.vue` + `DockResizeHandle.vue`.

---

## 4. Color tokens (replace `main.css` `:root` + `.dark`)

**Structure** stays identical to current shadcn-vue layout (same var names, `@theme inline`, `.dark` variant). Only values change. Light-mode values provided so `:root` is valid and we can enable light later.

```css
:root {
  /* ── Light mode (reserved; not enabled in v1, keep valid) ── */
  --background: #fafaf7;
  --foreground: #121212;
  --surface-0: #ffffff;
  --surface-1: #f6f5f0;
  --surface-2: #eeede7;
  --surface-3: #e4e2da;
  --card: #ffffff;
  --card-foreground: #121212;
  --popover: #ffffff;
  --popover-foreground: #121212;
  --primary: #1a1a1a;
  --primary-foreground: #fafaf7;
  --secondary: #eeede7;
  --secondary-foreground: #121212;
  --muted: #eeede7;
  --muted-foreground: #6a6a66;
  --accent: #e8765a; /* signature coral-amber */
  --accent-foreground: #ffffff;
  --destructive: #b3261e;
  --destructive-foreground: #ffffff;
  --border: #d9d7ce;
  --border-subtle: #e4e2da;
  --border-active: #bfbcb1;
  --input: #d9d7ce;
  --ring: #e8765a;
  /* … semantic + sidebar mirror the above … */
}

.dark {
  /* ── Dark mode (v1 default) — Codex/Claude warm-dark ── */

  /* Base surfaces — warm near-blacks, 5-step ramp */
  --background: #0e0e10; /* sidebar + chrome */
  --surface-0: #121214; /* content area base */
  --surface-1: #161619; /* cards, inputs */
  --surface-2: #1c1c20; /* hover, popovers */
  --surface-3: #232328; /* elevated / active */

  /* Text — warm off-white primary, real muted contrast */
  --foreground: #f2efe9; /* was #f6f6f6 (too cool) */
  --card-foreground: #eae7e0;
  --popover-foreground: #eae7e0;
  --muted-foreground: #8a8880; /* was #666666 (too dim, failed AA) */
  --secondary-foreground: #f2efe9;
  --accent-foreground: #ffffff;

  /* Cards + popovers */
  --card: #161619;
  --popover: #1c1c20;

  /* Primary CTA — soft white (like Claude Desktop's pill buttons) */
  --primary: #edeae3;
  --primary-foreground: #0e0e10;

  /* Secondary — subtle neutral button */
  --secondary: #1f1f23;
  --muted: #1a1a1e;

  /* Signature accent — coral-amber, Claude-adjacent but proprietary */
  --accent: #e8765a;
  --accent-hover: #ef8367;
  --accent-soft: #2a1d17; /* bg for soft accent pills */

  /* Destructive */
  --destructive: #c94c3c;
  --destructive-foreground: #ffffff;

  /* Borders — ΔL ≥ 4 from surface-0, finally visible */
  --border: #2a2a2f;
  --border-subtle: #1f1f23;
  --border-active: #3a3a40;

  /* Inputs + focus */
  --input: #2a2a2f;
  --ring: #e8765a; /* amber focus (was near-white) */

  /* Semantic status — warmer, legible */
  --success: #4fb06a;
  --success-bg: #143321;
  --warning: #e0a528;
  --warning-bg: #2e2511;
  --info: #6c9be0;
  --info-bg: #132235;
  --error: #d75a4a;
  --error-bg: #2e1815;

  /* Sidebar (= background, same surface as chrome) */
  --sidebar: #0e0e10;
  --sidebar-foreground: #f2efe9;
  --sidebar-primary: #edeae3;
  --sidebar-primary-foreground: #0e0e10;
  --sidebar-accent: #1a1a1e; /* hovered row */
  --sidebar-accent-foreground: #f2efe9;
  --sidebar-border: #1f1f23;
  --sidebar-ring: #e8765a;

  /* Radius + shadows (was flat; now elevated) */
  --radius: 0.625rem; /* 10px */
  --shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.3);
  --shadow-sm: 0 2px 4px -1px rgb(0 0 0 / 0.35);
  --shadow: 0 4px 12px -2px rgb(0 0 0 / 0.4);
  --shadow-md: 0 8px 24px -4px rgb(0 0 0 / 0.45);
  --shadow-lg: 0 16px 40px -8px rgb(0 0 0 / 0.5);
  --shadow-xl: 0 24px 56px -12px rgb(0 0 0 / 0.55);
}
```

**Breaking bugs this fixes:**

1. `:root`'s `--foreground: #676767` is unreadable; replaced with valid light-mode value.
2. `--border` ΔL vs `--background` goes from ~2 to ~8 (visible).
3. `--muted-foreground` `#666666` fails WCAG AA on `#161616` (contrast ratio 2.6); new `#8A8880` scores 4.6 (passes AA for large/UI text).
4. `--ring: #e0e0e0` (near-white) replaced with the signature accent — focus rings become brand-correct.
5. Shadows go from all-zero to a soft elevation scale (dropdowns, popovers, AI composer actually "lift").

**Alpha-patch cleanup:**
After tokens ship, grep the codebase and replace `border-border/40`, `border-border/25`, `border-border/20`, `border-border/15` with the proper `border-border-subtle` / `border-border` / `border-border-active` tokens. The alpha patches exist because the old `--border` was invisible; they're unneeded now.

---

## 5. Typography

- Font families unchanged: `Geist` body, `Geist Mono` for code / timestamps / ids.
- **Base size 13px** (was 14). Devtools-dense but still legible.
- Type scale:
  - `--text-xxs: 10px / 14px` — metric chips, badge text (use sparingly; kill 9px entirely)
  - `--text-xs:  11px / 15px` — small UI (sidebar secondary labels, table dense mode)
  - `--text-sm:  13px / 18px` — **body default**, sidebar nav, buttons
  - `--text-base:15px / 22px` — module headers, input text, AI chat body
  - `--text-lg:  18px / 26px` — panel titles, empty-state subs
  - `--text-xl:  22px / 30px` — empty-state headlines
  - `--text-2xl: 28px / 36px` — onboarding hero (only place this exists)
- Tracking: default `0`, `-0.01em` at ≥18px, `-0.02em` at ≥22px.
- Font-feature-settings (already set): keep `cv02 cv03 cv04 cv11`.
- Kill all inline `text-[9px]` usages (currently on sidebar rail labels — irrelevant after sidebar rewrite).

---

## 6. Sidebar spec (`Sidebar.vue` rewrite)

**Dimensions**

- Expanded: `w-64` (256px). Collapsed: `w-14` (56px, icons only).
- Toggle: `⌘B`. Persisted in `ui.store.ts` as `sidebarCollapsed: boolean`.
- Auto-collapse rule: when Mirror panel docks same-side, sidebar does not auto-collapse (Mirror slides over content, not over sidebar). When window width < 1100px, auto-collapse once; user can override.

**Anatomy (top → bottom)**

1. **Brand row** (`h-11`, matches TitleBar height, flush with titlebar)
   - Logo glyph (16px) + "Capubridge" text, tracking-tight, 13px, 60% opacity
   - Collapsed: logo glyph only, centered
2. **Primary nav** (`flex-1`, scrollable if overflow)
   - 6 entries in order: Devices, Storage, Network, Capacitor, Inspect, (divider), Settings
   - Row: 36px tall, 12px horizontal padding, 8px gap between icon (16px) and label (13px/sm)
   - Active state: `bg-sidebar-accent` + 2px left accent bar in `--accent` + `font-medium`
   - Hover: `bg-sidebar-accent/60`
   - Collapsed: icons only, 44px square, centered, tooltip on hover shows label + any keyboard shortcut
3. **Context cluster** (pinned above footer, separated by subtle divider)
   - Compact **target pill**: status dot · device model · `›` · current target title. Click opens `DeviceManagerModal`. Same component logic as current `ConnectionSummary.vue` but restyled as a sidebar block card, not a titlebar chip.
   - In collapsed mode, pill collapses to a single status dot.
4. **Footer** (`h-10`, flush bottom)
   - Left: connection indicator dot (green/blue/gray) — the old `StatusBar` status dot lives here
   - Right: settings gear → opens `/settings`
   - Collapsed: both stack vertically centered in the 56px rail

**Empty state** (no device + no chrome target connected)

- Context cluster shows a single dashed-border pill: "No connection · Connect"
- Clicking opens `DeviceManagerModal`.

---

## 7. TitleBar spec (`TitleBar.vue` refactor)

**Height** stays `h-11`. Drag region stays on the whole bar except on interactive buttons.

**Left → right:**

1. Drag region + (optional) text breadcrumb `Storage › IndexedDB › app_db` (13px, muted, truncates). Shows only when a selection exists; otherwise stays empty (quiet).
2. Flex spacer (drag).
3. **Dock toggle** — new button, `Terminal` icon, badge dot when any dock tab has unread activity (new logs, AI response ready). Tooltip "Toggle Dock (⌘J)".
4. **Mirror toggle** — icon-only (no "Mirror" text), state = off/ready/streaming; pulsing accent-colored dot when streaming.
5. **Command palette** pill — `⌘K` kbd-style button, matches current.
6. **Window controls** — `─ □ ×`. Keep current hover/close colors but use `--destructive` for close hover instead of hardcoded `#e05050`.

**Removed:** `ConnectionSummary` (moved to sidebar context cluster).

---

## 8. Bottom Dock spec (new)

**File layout**

```
src/components/dock/
├── BottomDock.vue          # shell: tab bar + resize handle + active tab body
├── DockTabBar.vue          # segmented tab switcher, unread indicators
├── DockResizeHandle.vue    # drag to resize, double-click to toggle min/max
├── DockPopoutButton.vue    # move active tab to a detached Tauri window
└── tabs/
    ├── AssistantTab.vue    # new — AI chat
    ├── LogcatTab.vue       # wraps existing DeviceLogcat.vue
    ├── ReplTab.vue         # wraps existing ConsoleRepl.vue
    ├── OutputTab.vue       # wraps existing ConsoleOutput.vue
    └── ExceptionsTab.vue   # wraps existing ConsoleExceptions.vue
```

**Dock state** (`dock.store.ts`, new Pinia store)

```ts
{
  isOpen: boolean,                   // default false on first launch
  activeTab: 'assistant' | 'logcat' | 'repl' | 'output' | 'exceptions',
  heightPx: number,                  // default 320, min 120, max 70vh
  unreadByTab: Record<TabId, boolean>,
  poppedOutTabs: Set<TabId>,         // tabs currently in a detached window
}
```

**Keybindings**

- `⌘J` — toggle open/closed (focus dock if opening)
- `⌘↑` / `⌘↓` while dock focused — grow / shrink by 80px
- `⌘1…⌘5` while dock focused — jump to tab 1..5
- `Esc` while dock focused — return focus to main content

**Visual**

- Dock top edge: 1px `--border`, 4px resize grabber. Hover: `--border-active`.
- Tab bar: `h-10`, tabs are `px-3 py-1.5` pill-style (matches current `SubNavTabs`), active tab has `bg-surface-3 border border-border`.
- Unread dot: 6px, `--accent`, right of tab label.
- Right side of tab bar: pop-out button + close-dock button (X).
- Body: scrolls internally; dock never pushes StatusBar (deleted) or TitleBar.

**Mirror interaction**

- If dock is open and Mirror panel is requested: Mirror opens as a **right-side overlay above the dock**, not below it. If window width < 1200, Mirror opens in a detached window instead.

**Assistant tab (MVP)**

- Context header pill (top of tab): `Context: Storage › IDB › app_db › users` — always visible, updates as user navigates / selects.
- Message list (virtual-scrolled, `vue-virtual-scroller`).
- Composer at bottom: multiline textarea + `@` to mention context objects (e.g. `@selected-row`, `@logcat-tail`), `Enter` to send, `⌘Enter` to send with extra thinking.
- Model pill (right of composer) — default `claude-sonnet-4-6`. Switchable in Settings.
- Streaming via Anthropic SDK, prompt caching on system + context preamble.
- No history persistence in MVP (reset on app quit); persistence is Phase 6.

---

## 9. Module header spec (`PanelHeader.vue` refactor)

Single sticky row, `h-14` (was `h-10`). Structure:

```
┌─────────────────────────────────────────────────────────────┐
│  Title   · optional subtitle / breadcrumb · badge   actions │
│  18px      13px muted                                       │
└─────────────────────────────────────────────────────────────┘
```

- Title is 18px, `font-medium`, tracking `-0.01em`.
- Subtitle/breadcrumb is 13px, `text-muted-foreground`, separated by a 1px `h-4` divider.
- Actions cluster right-aligned: icon buttons (32×32, stroke-1.5) + primary action button if any. Buttons use `--secondary` bg, `--border-subtle` border.
- No colored bottom border. Separation from content is via 8px vertical padding + the surface color difference (`--background` on header, `--surface-0` on content).

**SubNavTabs** (when the module uses sub-routes) sits **below** the header as a separate `h-11` row. Keep current pill styling but migrate colors to new tokens (no more `border-border/30` alpha patches).

---

## 10. Empty-state spec

Every module's "no data / no selection" screen follows one template:

```
┌───────────────────────────────────────────┐
│                                           │
│                                           │
│               [icon 32px]                 │
│                                           │
│          Headline (22px, fg)              │
│        Subhead (15px, muted, 1–2 lines)   │
│                                           │
│        [Primary action button]            │
│     [Secondary link] · [Secondary link]   │
│                                           │
│                                           │
└───────────────────────────────────────────┘
```

- Centered vertically & horizontally in the content area.
- Max width 520px for headline/sub.
- Primary is `--primary` (soft white) filled button; secondaries are ghost `--muted-foreground` links with keyboard-style `⌘…` hint where relevant.
- Example (Devices): icon `Smartphone`, "No devices connected", "Plug in an Android device via USB, or pair wirelessly.", primary `[Pair wirelessly]`, secondaries `[Open ADB settings]` / `[Troubleshooting]`.
- Example (Storage): icon `Database`, "No target connected", "Select a Chrome tab or a device to inspect its storage.", primary `[Choose target]`, secondaries `[About targets]` / `[⌘K Open command palette]`.

---

## 11. Density scale

| Context            | Row / element height | Padding | Font           |
| ------------------ | -------------------- | ------- | -------------- |
| Sidebar nav row    | 36px                 | px-3    | text-sm (13)   |
| Sidebar footer     | 40px                 | px-3    | text-sm        |
| TitleBar           | 44px                 | px-2    | text-sm        |
| Module header      | 56px                 | px-4    | 18 / 13        |
| SubNavTabs         | 44px                 | px-1.5  | text-sm        |
| Table row (dense)  | 28px                 | px-2    | 13 mono / sans |
| Table row (header) | 32px                 | px-2    | text-xs upper  |
| Dock tab bar       | 40px                 | px-1.5  | text-sm        |
| Input              | 32px                 | px-3    | text-sm        |
| Button (sm)        | 28px                 | px-3    | text-xs        |
| Button (md)        | 32px                 | px-3    | text-sm        |

---

## 12. Iconography & motion

- **Icons:** `lucide-vue-next` only. No mixing heroicons / material.
- **Stroke width:** `1.5` idle, `1.75` active/hover. Don't ship `2`.
- **Sizes:** sidebar/nav/actions 16, module titles 18, empty-state 32. Everything else 14.
- **Transitions:** 120ms ease for bg/color, 200ms ease-out for panel slides, 80ms for table row hover. Respect `prefers-reduced-motion`.
- **Focus rings:** `ring-2 ring-ring ring-offset-2 ring-offset-background` via the accent (coral-amber) — not white.

---

## 13. Rollout plan (6 phases)

Each phase = one PR. Don't cross-merge phases; each ships green.

### Phase 1 — Tokens (lowest risk, highest leverage)

- Rewrite `apps/desktop/src/assets/styles/main.css` per §4.
- Update `@theme inline` block to expose new `--accent-*`, `--border-active`, `--border-subtle` correctly.
- Grep & replace alpha-patch borders (`border-border/40` etc.) with token variants.
- Kill `text-[9px]`, `text-[10px]` inline classes; use `text-xxs` / `text-xs` tokens.
- **Acceptance:** `vp check` passes; app runs; no component should visibly break — just recolor. Take before/after screenshots of every route for review.

### Phase 2 — Shell (biggest visual shift)

- Delete `ConnectionBar.vue` and its imports.
- Delete `StatusBar.vue` and `<StatusBar />` from `AppShell.vue`.
- Rewrite `Sidebar.vue` per §6 (labeled, collapsible, context cluster, footer).
- Add `ui.store.ts` fields: `sidebarCollapsed`, persist to `tauri-plugin-store`.
- Refactor `TitleBar.vue` per §7 (remove `ConnectionSummary`, add `Dock` toggle, use tokens).
- Update `AppShell.vue` layout — sidebar becomes resizable column, not fixed 72px rail.
- **Acceptance:** all existing routes render; `⌘B` toggles sidebar; no regressions in Mirror panel; Command palette still works.

### Phase 3 — Bottom Dock (new surface)

- Create `dock.store.ts` + `BottomDock.vue` + `DockTabBar.vue` + `DockResizeHandle.vue` per §8.
- Move `DeviceLogcat.vue`, `ConsoleOutput.vue`, `ConsoleRepl.vue`, `ConsoleExceptions.vue` into dock tab wrappers.
- Remove `/console/*` routes from `router/index.ts`; redirect any `/console` URL to previous route.
- Delete `Console` sidebar entry; verify sidebar drops to 6 items + Settings.
- Wire `⌘J` and pop-out button (Tauri multi-window, mirrors existing Mirror pop-out pattern).
- **Acceptance:** Logcat streams live inside the dock; REPL works; dock resizes; pop-out opens a detached window.

### Phase 4 — Modules (one at a time)

Order: Devices → Storage → Network → Capacitor → Inspect → Settings.
For each module:

- Rewrite `ModulePanel.vue` header per §9.
- Rewrite empty state per §10.
- Move module-scoped metrics (req/s, memory, etc.) from deleted StatusBar into this module's toolbar.
- Replace custom table HTML with TanStack Table if any still exists.
- **Acceptance:** every module has the new header, new empty state, and uses only token colors (no hex literals).

### Phase 5 — AI assistant (MVP)

- Install / configure `@anthropic-ai/sdk` in desktop app.
- `composables/useAssistant.ts` — streaming, prompt caching (system prompt + context preamble cached), cancellation.
- Context assemblers per module (start with Storage + Devices; others stub):
  - Storage: current DB/store/selected-row JSON (truncated)
  - Devices: selected device serial + model + last 20 logcat lines
- `AssistantTab.vue` — header pill, message list (virtual-scrolled), composer with `@` mentions.
- Settings: model picker (Sonnet/Opus/Haiku) + API key entry (store in Tauri secure store).
- **Acceptance:** send a message, stream a reply, `@selected-row` injects real context, `⌘J` focus roundtrip works.

### Phase 6 — Polish

- Skeleton loaders for every async surface (IDB load, Logcat connect, target list refresh).
- Error boundaries per module with retry actions.
- Persistent AI chat history (SQLite via existing seed storage pattern).
- Light mode — flip the `:root` side, add theme picker in Settings.
- Review pass with `web-design-guidelines` skill.

---

## 14. Shadcn-vue alignment checklist

Before shipping Phase 1:

- [ ] Every var named in the spec matches what `@/components/ui/*` components consume.
- [ ] No component reads a raw hex literal — all go through tokens.
- [ ] `--ring` is used in `Input`, `Button`, `Checkbox`, `Switch` focus states.
- [ ] `--radius` propagates via `--radius-sm/md/lg/xl` (keep the `calc()` relations in `@theme inline`).
- [ ] `--accent` + `--accent-foreground` used by `Badge`, `Button` variant="accent" (add variant if missing), `Sonner` action buttons.
- [ ] Run shadcn-vue docs lookup with `context7-plugin:docs` if any component's variants don't match.

---

## 15. Out of scope (explicitly deferred)

- Per-module deep redesigns beyond header + empty state (Phase 4 is chrome + templates, not full UX rework).
- Tablet / small-window responsive modes.
- Themeable brand accent (coral-amber is fixed for v1).
- AI tool-use (read/write IDB from assistant, generate CDP queries) — Phase 7+.
- Collaboration / multi-user (not on roadmap).
- Windows Mica / macOS vibrancy effects — cosmetic Phase 8.

---

## 16. Open follow-ups for future sessions

These came up during grilling but weren't resolved and do not block Phase 1:

- Exact hotkey for dock (`⌘J` vs `⌘`` `) — verify against Tauri platform-menu conflicts on Windows.
- Whether Mirror panel's "pop out" should default on when window width < 1200 (or always require explicit click).
- Final copy for empty states (placeholder strings in §10 are draft).
- Whether `/inspect/:pluginId` dynamic routes also kill their own SubNavTabs or keep them (they're plugin-injected).
