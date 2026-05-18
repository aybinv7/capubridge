# Capubridge UI Redesign — Design Spec

**Date:** 2026-05-18
**Branch:** `ayoub/ui/v3`
**Status:** Draft — pending review

## Context

Capubridge today suffers from five compounding UX problems that the user
explicitly confirmed (all five): scattered navigation, invisible connection
state, inconsistent modules, wrong density, and poor discoverability. The
visual layer additionally has accessibility gaps (sub-AA contrast in places)
and is locked to dark mode because `dark` is hardcoded on `AppShell.vue`'s
root, even though light tokens exist.

This spec replaces an earlier `docs/UI-REDESIGN.md` (deleted from the branch;
references in agent memory were stale and have been purged). Nothing in this
spec depends on or carries over from that earlier document.

## Goals

1. Rethink the information architecture so the app stops feeling like 11
   loosely-related panels and starts feeling like one tool.
2. Make connection and target state visible on every screen.
3. Establish a single module skeleton every tool renders into.
4. Ship a token-driven theme system with 6 curated themes and an independent
   accent override (per-user-authored themes deferred to a later phase).
5. Hit WCAG AA across the board, with a documented narrow exemption for
   dense data and an AAA high-contrast theme as opt-in.
6. Improve discoverability via a real command palette, empty states, and
   keyboard shortcuts.

## Non-goals (deferred)

- Full user-authored theme editor with export/import (later phase).
- Theme marketplace / shareable themes.
- Mobile/tablet layout.
- Localization beyond English.
- Plugin/extension system for tabs.

## §1 — Design principles

These are load-bearing. Conflicts get resolved by changing the component, not
the principle.

1. **It's a native devtool, not a website.** Capubridge sits next to VS Code,
   Chrome DevTools, and Android Studio. The chrome should look like it
   belongs there: titlebar-aware, calm, high-contrast, opinionated.
2. **The frame breathes; the work is packed.** Chrome (titlebar, sidebar,
   dock, settings, empty states, dialogs) uses generous spacing and 14–15px
   type. Work surfaces (tables, waterfalls, logs, JSON viewers) use compact
   spacing and 12–13px type. This split is structural, not user-toggleable.
3. **Every screen tells you what you're connected to.** Target identity
   (device + webview + CDP status) is visible somewhere on every tab.
4. **The work is in tabs; tabs are real.** Each tab is a `(tool, scope)` pair
   with its own state, persisted across restarts. No global "current tool /
   current target" singletons after this redesign.
5. **One module shell.** Every tool renders into the same skeleton; modules
   differ in what fills the slots, never in what the slots are.
6. **Tokens or nothing.** No hex literals in components. Every color, radius,
   shadow, spacing step goes through a token.
7. **AA is the floor.** Every theme passes WCAG AA (4.5:1 body, 3:1 large).
   Dense modules may use AA-large (3:1) only for non-load-bearing secondary
   metadata. High-contrast theme hits AAA (7:1).
8. **Accent is meaning, not decoration.** Accent signals the active thing
   (active tab, focus ring, primary button, selection). Never decoration.
9. **Motion is communicative.** Transitions explain change; ≤ 200ms default;
   respects `prefers-reduced-motion`.
10. **Empty states are first-class.** No blank panes anywhere.

## §2 — Token & theme architecture

### Two-layer token model

**Layer A — primitive tokens** (per theme): raw values, never read by
components directly.

```
--neutral-0 … --neutral-12        # 12-step neutral ramp
--accent-50 … --accent-700        # 7-step accent ramp
--success-{50,500,700}, --warning-…, --danger-…, --info-…
```

**Layer B — semantic tokens** (alias to primitives): components only read
these.

```
--bg-app, --bg-chrome, --bg-surface, --bg-surface-raised, --bg-overlay
--fg-default, --fg-muted, --fg-subtle, --fg-on-accent
--border-default, --border-strong, --border-subtle
--accent, --accent-hover, --accent-soft, --ring
--state-success, --state-warning, --state-danger, --state-info
```

Themes ship Layer A + the Layer B alias map. Accent override swaps Layer A's
accent ramp; Layer B is unchanged. Zero component changes on theme switch.

### Theme files

```
apps/desktop/src/themes/
├── tokens.css            # @theme inline mapping (Layer B → CSS vars)
├── codex-dark.ts
├── codex-light.ts
├── tokyo-night.ts
├── nord.ts
├── solarized-dark.ts
├── high-contrast.ts
└── accent-ramps.ts       # 8 preset ramps + hex-to-ramp generator
```

Each theme exports:

```ts
{
  id: "codex-dark",
  label: "Codex Dark",
  mode: "dark",                   // "dark" | "light"
  primitives: { /* Layer A */ },
  semantics: { /* Layer B aliases */ },
  meta: { contrastClass: "AA" }   // "AA" | "AAA"
}
```

### Accent override

User picks from 8 preset accents (coral-amber, blue, green, purple, cyan,
pink, amber, rose) or enters a hex. The ramp generator uses HSL
interpolation with WCAG luminance correction so the accent always passes
4.5:1 against `--bg-surface` regardless of theme. Stored in `themeStore` as
`{ themeId, accentOverride }`.

### Theme switching

`themeStore` writes `document.documentElement.dataset.theme = "<id>"` and
`document.documentElement.style.setProperty("--accent", ...)`. CSS uses
`[data-theme="…"]` selectors. The hardcoded `dark` class on `AppShell.vue`
is removed.

### Contrast verification

`scripts/check-contrast.ts` walks every theme × every semantic token pair
and asserts AA/AAA. Runs in CI. Failing theme blocks merge.

## §3 — Shell anatomy

```
┌─ TitleBar ─────────────────────────────────────────────────────────────┐
│  ●●●  capubridge   [Storage·Pixel-7][Network·Pixel-7][+]   ⌘K  ◐  ⚙   │
├──────┬─────────────────────────────────────────────────────────────────┤
│ Lau- │                                                                 │
│ ncher│                       Active tab content                        │
│      │                       (standard module shell — §5)              │
│      │                                                                 │
├──────┴─────────────────────────────────────────────────────────────────┤
│  ▾ Console · Pixel-7 / com.acme.app    |    AI assistant                │
│                              (Bottom dock — §3.4)                       │
└─────────────────────────────────────────────────────────────────────────┘
                       ┌──────────────┐
                       │ Mirror panel │ ← detachable, sits left or right
                       └──────────────┘
```

### §3.1 — TitleBar

40px tall, draggable. Left → right: OS window controls, `capubridge`
wordmark, tab strip (scrollable, `+` button at end), spacer, `⌘K` command
palette, `◐` quick theme toggle, `⚙` settings menu.

Active tab gets a 2px accent underline + bumped foreground. Inactive tabs
use `--fg-muted`. Close (×) on hover. Middle-click closes. Drag-reorders.

### §3.2 — Launcher Sidebar

56px collapsed, 220px expanded. Toggled with `⌘B`. Pure launcher; not module
nav.

Sections, top → bottom:

1. **Targets** — connected devices. Click → opens default tool tab.
   Right-click → tool picker. Hover → webview sub-items.
2. **Recordings** — `.capu` files. Click → opens Replay tab.
3. **Browser Preview** — singleton launcher.
4. spacer
5. **Settings** — singleton.

No more Devices/App/Storage/Network/Inspect/Replay sidebar items.

### §3.3 — Main content area

Renders the active tab. No padding — the tab's own shell (§5) owns spacing.
Renders empty-state landing when no tabs are open.

### §3.4 — Bottom dock

Existing pattern; slides up from bottom, resizable, toggled with `⌘J`. Two
built-in tabs:

- **Console** — log stream for the active tab's target (CDP
  `Console.messageAdded` + Logcat). Re-scopes on tab switch.
- **AI Assistant** — chat scoped to the active tab's `(tool, target)`
  context.

Dock has its own tab strip on the left. Closeable; remembers last-open tab
and height.

### §3.5 — Mirror panel

Unchanged in intent — left or right side panel, detachable to its own Tauri
window. Not part of the tab system. Bottom inset respects dock height.

### §3.6 — Empty state (no tabs)

Centered landing in main content area: app mark, single-line tagline, two
primary CTAs (Connect device / Open recording), Recent targets list, Recent
recordings list, `⌘K` hint. Calm chrome density. One accent on primary CTA.

### §3.7 — No global status bar

The existing `StatusBar.vue` is deleted. Status moves to: per-tab status
strip (§5), sidebar target dots, toast for transient events.

## §4 — Tab model & state

### §4.1 — Tab identity

```ts
type Tab = {
  id: string; // uuid, stable across restarts
  tool: ToolId; // "storage" | "network" | "inspect" | ...
  scope: TabScope;
  title: string; // derived but cached
  icon: ToolIcon;
  createdAt: number;
  lastFocusedAt: number;
};

type TabScope =
  | { kind: "target"; serial: string; webviewId: string }
  | { kind: "recording"; capuPath: string }
  | { kind: "singleton" };
```

Title derived: `${toolLabel} · ${scopeLabel}`. Truncation in tab strip
prioritises target chip over tool name.

### §4.2 — Stores

Three new stores. Existing global "current target / current tool" stores are
retired.

**`tabsStore`** — source of truth for the tab strip.

```ts
state:   tabs: Tab[], activeTabId: string | null
getters: activeTab, tabsByScope(scope)
actions:
  openTab(tool, scope) → focus existing same-(tool,scope) tab or create
  closeTab(id)         → also disposes tab-state slice
  focusTab(id)
  moveTab(id, toIndex)
  closeOthers(id), closeAll(), closeToRight(id)
```

**`tabStateStore`** — per-tab module state, keyed by tab id.

```ts
state: states: Record<TabId, TabState>
TabState is a discriminated union by tool:
  | { tool: "storage"; subTool: …; selection, filters, scroll, … }
  | { tool: "network"; filters, selectedRequestId, columnWidths, … }
  | { tool: "inspect"; selectedNodeId, expandedNodeIds, … }
  | …
```

Modules never store working state in their own store; they read/write
through `tabStateStore.states[tabId]`. Closing a tab deletes its slice.

**`targetsStore`** (rewritten) — connection state per `(serial, webviewId)`,
decoupled from "active target." Tabs reference targets by id; tabs can be
open for disconnected targets (they render a reconnect prompt in the work
surface).

### §4.3 — Tab lifecycle

```
openTab(tool, scope):
  1. find matching (tool, scope) in tabs[] → if found, focusTab; done.
  2. allocate id; push to tabs[]
  3. initialize tabStateStore.states[id] from tool's default factory
  4. set activeTabId
  5. persist (debounced)

closeTab(id):
  1. if active, pick neighbour (right preferred, else left, else null)
  2. splice tabs[]
  3. delete tabStateStore.states[id]
  4. persist

focusTab(id):
  1. set activeTabId; bump lastFocusedAt
  2. dock re-scopes Console + AI to this tab's target
```

### §4.4 — Routing

Vue Router stays, but routes are derived from the active tab. Active tab id
is the URL: `/tabs/{tabId}`. Singletons keep stable paths (`/settings`) for
deep linking — opening such a path either focuses the existing tab or
creates one. Deep links like
`capubridge://open?tool=storage&serial=…&webview=…` map to
`tabsStore.openTab(...)`.

### §4.5 — Persistence

Tabs + state serialise to `tabs.json` in app data dir (Tauri filesystem
plugin), debounced 500ms after change. On startup: load → restore tabs
(skip those whose scope can't resolve, toast a notice) → focus previously
active tab.

`tabStateStore` slices serialise alongside, with per-tool migration table
for forward-compat.

### §4.6 — Cross-tab concerns

- CDP clients are per-target, shared by all tabs for that target. Closing
  the last tab for a target prompts: "Disconnect from <device>?" — default
  Yes after 10s.
- TanStack Query keys include `tabId` for tab-scoped state and exclude it
  for target-scoped state (e.g. the DB list for a target caches once).
- Keyboard: `⌘T` new-tab picker · `⌘W` close · `⌘⇧W` close others ·
  `⌘1…9` jump to N · `⌘⌥←/→` prev/next.

### §4.7 — What gets deleted

- Any `currentTool` / `activeTool` global state in existing stores.
- Module-internal Pinia state (replaced by `tabStateStore` slices).
- Hardcoded `dark` class on `AppShell.vue` root.
- `components/layout/ConnectionBar.vue` (if present), `StatusBar.vue`,
  legacy console route subtree.

## §5 — Standard module shell

### §5.1 — Anatomy

```
┌─ ModuleHeader (sticky, 44px) ──────────────────────────────────────┐
│  [Tool icon] Tool name  ·  [TargetChip]              ⟳   ⋯   ?     │
├────────────────────────────────────────────────────────────────────┤
│  ModuleSubNav (optional, 36px)                                     │
├────────────────────────────────────────────────────────────────────┤
│  ModuleToolbar (optional, 40px)                                    │
├────────────────────────────────────────────────────────────────────┤
│                     WorkSurface (fills available)                  │
├────────────────────────────────────────────────────────────────────┤
│  ModuleStatusStrip (optional, 28px)                                │
└────────────────────────────────────────────────────────────────────┘
```

Mandatory: `ModuleHeader`, `WorkSurface`. Optional, in order: `SubNav`,
`Toolbar`, `StatusStrip`.

### §5.2 — Shared components

Under `src/components/module-shell/`:

- `ModuleShell.vue` — wrapper; slots `header` (auto if not provided),
  `subnav`, `toolbar`, default (work surface), `status`.
- `ModuleHeader.vue` — tool icon, name, `<TargetChip>`, refresh, overflow,
  help. Props: `toolId`, `scope`, `actions`.
- `TargetChip.vue` — accent-dotted chip `device / webview`. Click → target
  picker; right-click → disconnect / reconnect / details. CDP status as a
  status dot.
- `ModuleSubNav.vue` — tabs-style nav for module sub-views; wraps
  shadcn-vue `Tabs`.
- `ModuleToolbar.vue` — flex container with `<ToolbarGroup>` children.
- `ModuleStatusStrip.vue` — left + right slots; muted foreground; 12px.
- `WorkSurface.vue` — pure wrapper handling overflow, scroll, inset border.

### §5.3 — Module density tokens

```
--module-row-height: 28px
--module-font-size: 13px
--module-font-mono-size: 12.5px
```

Chrome tokens (`--chrome-row-height: 36px`, `--chrome-font-size: 14px`) are
separate and never used inside `WorkSurface`.

### §5.4 — State surfaces

`<WorkSurfaceState>` handles three states uniformly:

- **Disconnected** — "Pixel-7 is disconnected" + Reconnect button; calm
  chrome density.
- **Loading** — skeleton rows matching the data shape; never a spinner
  alone.
- **Empty** — illustration + one-line copy + primary action; each module
  owns content, layout is shared.

### §5.5 — Migration recipe (per module)

1. Wrap module root in `<ModuleShell>`.
2. Move header/toolbar/status into the appropriate slots.
3. Replace bespoke status with `<ModuleStatusStrip>`.
4. Switch density classes to module density tokens.
5. Move module Pinia state into a `TabState` slice.

## §6 — Accessibility & motion

### §6.1 — Contrast assertions

CI script asserts, per theme:

- `--fg-default` vs `--bg-{app,surface,chrome,raised}` ≥ 4.5:1
- `--fg-muted` vs same ≥ 4.5:1 (chrome) or ≥ 3:1 (module density only, and
  only on metadata, not labels)
- `--accent` vs same ≥ 4.5:1 (enforced by accent-ramp generator)
- `--state-*` ≥ 4.5:1
- `--border-default` vs neighbouring surface ≥ 3:1

High-Contrast theme asserts ≥ 7:1.

### §6.2 — Focus

Single style: 2px solid `--ring` (= accent), 2px offset, on `:focus-visible`
only. Inset variant for tight cells. No browser default outlines anywhere.

Tab order: TitleBar → tab strip → sidebar → tab content → dock.
Skip-to-content link rendered for SR, visually hidden until focused.

### §6.3 — Keyboard

Registry-driven; documented in Settings → Shortcuts. Minimums:

- `⌘K` palette · `⌘J` dock · `⌘B` sidebar
- `⌘T` new tab · `⌘W` close · `⌘⇧W` close others · `⌘1…9` jump ·
  `⌘⌥←/→` prev/next
- `⌘,` settings · `⌘⇧P` palette (alt)
- Tables: arrows to navigate, `Enter` to edit (where allowed), `Esc` cancel.

`axe-core` runs in dev.

### §6.4 — Screen reader

- `aria-label` on every icon-only button.
- `role="tablist" / "tab"` on tab strip.
- `aria-live="polite"` region for toasts and async results.
- TanStack Table outputs real `<table>` with `role="grid"` and
  `aria-rowcount` for virtualised content.

### §6.5 — Motion

Three duration tokens — `--motion-fast: 120ms`, `--motion-base: 200ms`,
`--motion-slow: 320ms`. Two easing — `--ease-out` (default),
`--ease-in-out` (returns).

`@media (prefers-reduced-motion: reduce)` sets a `data-motion="reduced"`
attribute on `<html>` that zeroes all durations and disables non-essential
transitions globally. No decorative animation, no shimmer, no parallax.

## §7 — Build phases (tracer slices)

Six mergeable slices, each leaves the app working.

### Slice 1 — Foundation: tokens + themes

- `src/themes/` (6 themes + `accent-ramps.ts`)
- `tokens.css` two-layer model
- `themeStore` + `useTheme()` composable
- `[data-theme]` selectors; remove hardcoded `dark` from `AppShell.vue`
- `scripts/check-contrast.ts` + CI hook
- Settings → Appearance (theme picker + accent picker)
- Token shims keep existing components working

**Done:** all 6 themes × 8 accents render every existing screen correctly;
contrast check passes in CI.

### Slice 2 — Shell: titlebar, sidebar launcher, empty state

- `TitleBar.vue` with tab strip stub (single hardcoded tab)
- `LauncherSidebar.vue` replacing module-nav `Sidebar.vue`
- `EmptyState.vue` (no-tabs landing)
- Bottom dock survives untouched
- Existing modules accessible via temporary "open in tab" launcher
  commands

**Done:** new shell in place, one existing module opens inside a tab,
theme switching works from the titlebar.

### Slice 3 — First module: Storage in standard shell

- `tabsStore` + `tabStateStore` end-to-end
- Tab persistence (`tabs.json`) + restart restore
- `ModuleShell.vue` + sub-components (§5.2)
- Storage rebuilt against new shell, state in `tabStateStore`
- Multi-target works

**Done:** multiple Storage tabs across devices, switch / close / reorder,
restart survives.

### Slice 4 — Migrate modules

One PR per module, in order tuned to usage (re-orderable before start):
Network → Inspect → Capacitor → Replay → Console-as-dock → Browser Preview
→ Settings → Devices launcher. Each PR follows §5.5. Dead module folders
deleted as their last consumer migrates.

**Done:** every tool runs through `ModuleShell` and is target-scoped.

### Slice 5 — AI assistant in the dock

- AI tab in bottom dock, scoped to active tab's `(tool, target)` context
- Streaming responses (existing pattern)
- Can read the active tab's current state (selection, filter, etc.)

**Done:** AI chat usable from any tab; knows its tab.

### Slice 6 — Polish

- High-Contrast (AAA) theme final tuning
- Motion audit against §6.5 tokens
- Focus-ring audit
- Empty-state illustrations
- Command palette refinements
- Settings final layout

**Done:** `axe-core` clean across all tabs and themes; design QA pass.

## Risks and mitigations

- **"Two looks" during Slice 4.** During the migration, some modules render
  in the new shell and some in the legacy shell. Mitigation: migrate in
  user-usage order so the most-used surfaces flip first; gate any mismatch
  with a feature flag if it's visually jarring.
- **Tab state explosion.** A user could open hundreds of tabs and exhaust
  state memory. Mitigation: soft cap at 30 tabs with a warning; UI to
  close-others / close-to-right; the per-tab state slices are small (≪ 1MB
  each in practice).
- **CDP client churn on tab close.** Closing the last tab for a target
  prompts disconnect. Mitigation: 10s grace timer so quickly reopening a
  different tab on the same target reuses the live client.
- **Theme/accent contrast edge cases.** User-entered hex accents may fail
  WCAG against some themes. Mitigation: the accent-ramp generator
  luminance-corrects on output and the picker shows a contrast badge; UI
  refuses to apply if it can't reach 4.5:1.
- **Tab persistence corruption.** A corrupt `tabs.json` shouldn't brick
  startup. Mitigation: load is wrapped in try/catch, falls back to empty
  state, archives the bad file as `tabs.broken-<ts>.json`.

## Out of scope for this spec

- Plugin/extension API for third-party tabs.
- Cloud sync of tabs/themes across machines.
- Touch / mobile interactions.
- Localization.
- A user-authored theme editor (deferred — see Non-goals).
