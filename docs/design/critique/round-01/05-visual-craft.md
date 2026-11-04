# Round 01 · Visual craft, brand and component fidelity

Critic: visual-design-critic. Evidence: the 17 screenshots in the panel evidence pack (1920×1020) and the
source on `feat/ui-ux-overhaul` at `26f17f8`. I did not run the app.

**How to read the coordinates.** The capture is at 125 % display scaling. The 64 px rail (`w-16`,
`Sidebar.vue:37`) renders 80 px wide, and the 32 px network rows (`h-8`) render 40 px tall. Regions are
given in screenshot pixels. CSS sizes are given as "css px" and are screenshot pixels divided by 1.25.

**Privacy.** Device identifiers, user names and prices that appear in the mirror and the status bar are
described generically.

---

## 0. Verdict in one paragraph

Bench is a good system on paper, and the screens mostly do not follow it.

- **Colour.** `DESIGN.md` says green means live only, red means recording only, and ink is used for
  action. In the evidence, green also marks HTTP GET, status 200, `enabled`, `NATIVE`, the download
  arrows, the ADB dot, permission shields and a "0 %" CPU reading. Red marks an idle Record button.
  Amber is the colour of every folder on the phone.
- **Cladd.** Cladd is "the visual foundation", yet only **9 view files import Cladd, against 153 that
  import shadcn-vue**.
- **The thesis is invisible.** The best idea in the brand is provenance drawn as a pattern (hatch,
  dotted, perforated). It appears in exactly one place in 17 screenshots: a footer chip in the SQLite
  grid. The app spends most of the evidence in a "paused, stale" state, yet no hatch strip is visible
  anywhere.
- **Recognition.** Cropped, the shell reads as "a dark devtool with a phone stuck on the right". The
  brightest, most saturated object on every screen is the mirrored phone, not Capubridge.
- **Honesty and craft.** Several screens state things that are false: "0 %" memory, "0 cores",
  "Discharging" while the phone is charging, "live" while paused, and "Per Core — live" next to
  "Waiting for CPU data". Settings rows look like controls but are static text.

The owner's 7 is generous for craft. My scores are in §7.

---

## 1. Severity-ranked findings

IDs are `V-nn`. Severity follows `RUBRIC.md`. Each finding gives the evidence, the defect and one fix
direction.

### S0: broken or lying

| ID   | Evidence                                                                                                       | Defect                                                                                                                                                                                                                                        | Fix direction                                                                                                                                                                    |
| ---- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V-01 | `panel-04-device-perf.png @ x95–785, y110–395`, `x800–1492, y110–395`; `DevicePerf.vue:353,410,229-233,398`    | CPU and Memory both read **0 %** in large green mono, with "0 cores · avg across all". With no samples, `levelColor(0)` returns `text-success`, so "no data" renders as "healthy". Memory cannot be 0 %.                                      | When there are no samples, show "No samples yet" with its source and age, never `0`. Keep values neutral ink; colour only a threshold breach.                                    |
| V-02 | `panel-04 @ x1037–1492, y620–805`; `DevicePerf.vue:662`                                                        | Battery shows "--%" and **"Discharging"**, while the phone's own status bar in the mirror shows it charging. `battery?.charging ? "Charging" : "Discharging"` turns _unknown_ into _discharging_.                                             | Use a three-state value (charging, discharging, unknown) and hide the status line when the level is unknown.                                                                     |
| V-03 | `panel-04 @ x95–1492, y413–603`; `DevicePerf.vue:469,518`                                                      | The card title is hard-coded "Per Core — **live**", and its body says "Waiting for CPU data…".                                                                                                                                                | Drive the title's state from the stream state (`LinkIndicator`), not from a string.                                                                                              |
| V-04 | `panel-07-network.png @ x105–200, y105–135` vs title bar `x1018–1085, y14–36` and status bar `x320–420, y1006` | The Network toolbar shows a green dot and a **"live"** pill while the context pill and status bar say **paused**. A notice 80 px below says the values may be stale. Three claims, one of them false.                                         | The capture pill reads `activeContext.link` (DESIGN §7 "One link truth"). Paused means an amber square and "paused", as in the title bar.                                        |
| V-05 | `panel-11-settings.png @ x1310–1390, y335–440`; `SettingsGeneral.vue:11-24`                                    | "English" and "Off" look like controls (an icon plus a value at the right edge of a settings row) but are plain `<span>`s. Nothing can be changed.                                                                                            | Use Cladd `Select` and `Switch`, or remove the rows until they work.                                                                                                             |
| V-06 | `panel-13-r5b-context-menu.png @ x990–1293, y522–800`                                                          | Right-click on empty canvas opens the **WebView2 browser menu** (Back, Refresh, Save as, Print, More tools, Inspect), styled by Windows, with a white focus box. "Refresh" reloads the whole app and "Inspect" opens devtools on the product. | Suppress the default `contextmenu` app-wide in production. Offer app menus (Reka, later Cladd) only where there are real actions.                                                |
| V-07 | `panel-12-palette.png` (whole frame)                                                                           | The "palette (Ctrl+K)" capture shows **no palette**. A second scrim darkens the Settings dialog, and nothing renders on top. Either the palette opened behind the modal or an empty overlay was stacked.                                      | Decide what happens when an overlay is already open: the palette replaces the modal or is refused. Never stack an empty scrim. (The palette itself could not be judged; see §8.) |

### S1: trust-breaking

| ID   | Evidence                                                                                                                                        | Defect                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Fix direction                                                                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| V-08 | `panel-01 @ x0–118, y130–160`; `panel-05 @ x0–140, y196–224`; `panel-07 @ x0–172, y326–354`; `panel-09 @ x0–160, y456–484`; `Sidebar.vue:41,80` | Rail tooltips use `position="bottom"`, so each tooltip sits **on top of the next rail item**, covering "App", "Data", "Elements" and "Flows" in turn. In panel-07 it also covers the third network row. The tooltip stays up after a click (focus), so it appears in 4 of 12 captures. It is also the only place that says "beta" or "experimental".                                                                                                                                                                                                                       | Use `position="right"`, show on hover and focus-visible only, and dismiss on navigation. Show maturity on the page itself, not only in a tooltip.      |
| V-09 | `panel-08-elements.png @ x92–1505, y186–204`; `DomTreeNode.vue:286-320`                                                                         | The DOM line renders as `<htmllang="en"dir="ltr"data-rail=…` with **no spaces between the tag and the attributes**. The `<span> </span>` separator collapses. The line also runs off the right edge without wrapping.                                                                                                                                                                                                                                                                                                                                                      | Render the separator as `&#32;` or with `margin-inline-start: 1ch` on the attribute span. Wrap long attribute lists or truncate them with an expander. |
| V-10 | `panel-02-device-apps.png @ x80–236, y410–430`, `x212–392, y562–582`, `x700–862, y562–582`                                                      | App labels are **clipped on both sides, with no ellipsis** ("…c Viewer (Powered by '"), because the centred text overflows its cell. Raw package ids are shown as names in at least 3 tiles.                                                                                                                                                                                                                                                                                                                                                                               | Use a two-line clamp with an ellipsis and a tooltip for the full value. Make the package id secondary, never the title.                                |
| V-11 | `panel-02 @ x785–985, y112–132`; `DeviceAppsToolbar.vue:94-101`                                                                                 | The filter says "Third-party", the count says **"84 apps"**, and the next item says **"75 user · 364 system"**. 84 is neither 75 nor 439. The colour is around 2.5:1.                                                                                                                                                                                                                                                                                                                                                                                                      | One count, bound to the active filter ("84 shown of 439"). Use subtle text that passes AA.                                                             |
| V-12 | `panel-13-r5b2-cladd-grid.png @ x385–1198, y245–278` vs empty `x1198–1900`                                                                      | **Every column header is truncated** ("exter…", "att…", "sl…", "na…", "po…", "\_write…") while about 700 px of grid width sits empty to the right.                                                                                                                                                                                                                                                                                                                                                                                                                         | Size columns to max(header, p95 of the content) up to a cap, then distribute the leftover width. Show the full name on hover.                          |
| V-13 | `panel-13-r5b2-header-menu.png @ x1130–1180, y252` vs values `x1878–1896, y296–330`                                                             | The "# rows" header is left-aligned at x≈1150, and its numbers are right-aligned at x≈1890, **740 px apart**. The group column stretches to x=1117.                                                                                                                                                                                                                                                                                                                                                                                                                        | Right-align numeric headers with their values, and give a group-count column the content width, not the remaining width.                               |
| V-14 | `panel-03-device-files.png` (whole grid and tree); `DeviceFiles.vue:882,954-957,1042-1044,1101-1103`                                            | Every folder is a hand-drawn block in **`bg-warning`** with a hard-coded `rgba(217,119,6,.85)` shade. The warning hue is used as decoration about 70 times on one screen, which is the loudest colour in the app. `DeviceFiles.vue:1042` uses `class="absolute left top-0"`, where `left` is not a valid utility, so the folder tab sits at its static position.                                                                                                                                                                                                           | Draw folders as neutral line icons (Lucide `Folder`, `muted-foreground`). Keep colour for state (permission denied, unreadable).                       |
| V-15 | `panel-07 @ x120–160, y265–645` and `x195–225`; `NetworkRequests.vue:197-206,232-238,252-258`                                                   | HTTP verbs use outcome colours: GET is green (success), PUT amber, DELETE red. Status 200 is green and the row stripe is green as well, so the status is shown three times. Type icons are a rainbow (Script amber, CSS purple, Image green, Media pink) at 60 % alpha.                                                                                                                                                                                                                                                                                                    | Show verbs in neutral mono text. Use status colour only for non-2xx. Make type icons monochrome. Use `cat-*` tokens only in lanes.                     |
| V-16 | `panel-01`…`panel-13` title bar `x1128–1195, y16–34`; `RecordingButton.vue:79`                                                                  | The idle "Record" button shows a filled **`signal-rec` dot**. DESIGN §2 says rec means "Recording in progress. Nothing else." A user sees a red recording dot on every screen while nothing is recording.                                                                                                                                                                                                                                                                                                                                                                  | Idle: a neutral ink outline dot. Recording: a filled square, a timecode and `signal-rec`.                                                              |
| V-17 | `panel-05-app.png @ x1208–1482, y168–204`                                                                                                       | "Clear" (destructive) is a **filled red** button next to the white primary "Open". The destructive action is as loud as the primary.                                                                                                                                                                                                                                                                                                                                                                                                                                       | Make Clear a transparent button with danger text, behind a confirm. Keep only one filled button per header.                                            |
| V-18 | `panel-05 @ x111–1030, y280–320`                                                                                                                | "234 MB · **— threads**", "**— · fg —**", "0.1.10 · sdk 36". Placeholder dashes ship as content; the catalogue names "— threads" as the canonical example.                                                                                                                                                                                                                                                                                                                                                                                                                 | Hide a field when it has no value, or show "unknown (needs foreground)" with its reason.                                                               |
| V-19 | `panel-05 @ x95–1497, y230–520`                                                                                                                 | One card holds **two key-value patterns**: an ALL-CAPS label stacked over its value (Origin, Runtime, App size…), then a label-left, value-right row (Version, SDK…). Memory (234 MB), version (0.1.10) and SDK (36) each appear **twice**.                                                                                                                                                                                                                                                                                                                                | One KV pattern (label over value, sentence case) and one occurrence per fact.                                                                          |
| V-20 | `panel-06-data.png @ x95–280, y140–180` and `panel-13 @ x70–275, y110–150`                                                                      | The database search placeholder is set in **mono** and cut inside its own field ("Search databa").                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Put placeholders in Sans, make the field fill the sidebar, and shorten the copy to "Filter".                                                           |
| V-21 | `panel-06 @ x95–280, y220–360` vs `x300–1510, y560`                                                                                             | The sidebar says "No IndexedDB databases found" while the app is backgrounded (CDP paused, so it may simply be unreadable), and the main pane says "Select a database from the sidebar". The two empty states contradict each other, and neither names the cause.                                                                                                                                                                                                                                                                                                          | One gate: "Can't read IndexedDB while the app is in the background", with the "Bring app to front" action (DESIGN §7).                                 |
| V-22 | `panel-01`/`panel-10 @ x350–665, y685–705` vs title bar `x885–1085`                                                                             | The Flows composer targets a **different package** (a test-bed app, truncated) from the global context (the retail app). This breaks the "one context" thesis on the screen built for it. A stray 1 px divider follows at x=665.                                                                                                                                                                                                                                                                                                                                           | The composer inherits the context pill. Make an override explicit, shown as a chip with "≠ context".                                                   |
| V-23 | rail `x8–72, y60–120` "Device" vs title bar `x1640–1745, y8–40` "Device •"                                                                      | **"Device" names two different things**: a rail destination, and the title-bar toggle for the mirror panel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Rename the toggle "Mirror", or give it the mirror icon only with a tooltip.                                                                            |
| V-24 | Contrast, systemic; `grep text-muted-foreground/NN`                                                                                             | **1,236 text colour classes carry an alpha modifier**, and about 860 of them are `/20`–`/60`. Composited over the panel (L 0.195), `/40` works out to about 2.5:1, `/50` to about 3.2:1 and `/60` to about 3.9:1. All fail AA. Seen at `panel-02 @ x1090–1450, y620–665`, `panel-06 @ x780–1030, y562`, `panel-08 @ x655–935, y768`, `panel-13 @ x1515–1580, y153`. The `check:contrast` guard tests tokens only, so it cannot see these.                                                                                                                                  | Ban `text-*/<alpha>` in `check:design-tokens`. The three text roles (default, muted, subtle) are the only greys.                                       |
| V-25 | Empty states, cross-screen                                                                                                                      | **Seven empty-state patterns**: an outline icon over a bold title and paragraph (Flows); an outline icon over a title and grey paragraph (Apps inspector); a tiny icon and grey line plus a button (IndexedDB sidebar); one grey line (IndexedDB main, SQLite inspector); a mono grey line (Styles); an icon in a raised tile over a title, line and white button (Replay); nothing at all (Task history at `panel-10 @ x80–440, y110–990`, and the SQLite main pane at `panel-13-r5b-context-menu @ x340–1915`). DESIGN §7 bans screen-local empty or no-device messages. | One `EmptyState` (icon, title, cause, one or two actions) and `GatedView` for link-caused emptiness. Nothing is ever blank.                            |
| V-26 | Search fields, cross-screen                                                                                                                     | **Eight search or filter field styles**: the title-bar cut well with keycaps; Apps (cut well, left); Files (centred in the toolbar); Data (mono, clipped); Network ("Filter…", a narrow well); Elements (a full-width bar with no well); Styles (mono); SQLite (an outlined pill).                                                                                                                                                                                                                                                                                         | One Cladd `SearchField` at two sizes, always left-aligned at the start of the toolbar.                                                                 |
| V-27 | Tab styles, cross-screen                                                                                                                        | **Five tab treatments**: underline with icon (top sub-nav, `SubNavTabs.vue:177`); filled chip (Browse/Structure/SQL, Styles/Computed/Box Model); text-only filters (network types); segmented (permissions); a larger underline (Settings). `panel-08` alone shows three of them.                                                                                                                                                                                                                                                                                          | Two only: Cladd `Tabs` for navigation and Cladd `Segmented` for filters.                                                                               |
| V-28 | `panel-04 @ x116–128, x822–842, x118–134, x1058–1076, x1062–1072` (icons in card titles); `DevicePerf.vue:406,528,650,684,717`                  | Card-title icons are a rainbow: the CPU icon is neutral, the Memory icon is info blue, Network is violet (`text-violet-500`, an off-token hue), Battery green, Temperature amber, CDP blue. Download and upload values are green and amber.                                                                                                                                                                                                                                                                                                                                | Use monochrome title icons. Colour a value only when it is outside its threshold.                                                                      |

### S2: polish that lowers the perceived quality

| ID   | Evidence                                                                                                               | Defect                                                                                                                                                                                                                                                                                                                                                                                       | Fix direction                                                                                                                                    |
| ---- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| V-29 | `panel-04 @ x730–770, y135–165`, `x1060–1150, y890–935`; `main.css:2-3`; 39 `font-mono … font-bold/semibold`           | Plex Mono is loaded at **400 and 500 only**, while 39 call sites ask for 600 or 700. The bold mono hero numbers ("0 %", "--°C", "0 KB/s", the `role` group chip) are **synthesised faux-bold**, with smeared stems.                                                                                                                                                                          | Load Mono 600 if it is needed, or cap mono at 500.                                                                                               |
| V-30 | `DevicePerf.vue:656,690` (`text-3xl`); 4 call sites                                                                    | `text-3xl` (30 px) is outside the DESIGN scale, which tops out at `2xl` 22 px, and the token guard does not catch it.                                                                                                                                                                                                                                                                        | Remove `3xl`+ from the theme so it fails to compile.                                                                                             |
| V-31 | `main.css:247-250`; `cladd-bridge.css:29-34`                                                                           | Two scale names give the same size: `--text-3xs` and `--text-2xs` are both 11 px. The bridge also clamps Cladd `2xs`, `3xs` and `4xs` to 11 px, so three Cladd steps become one. The low end of the app scale (11, 12, 13, 14) moves in **1 px steps** that the eye cannot separate at 125 %. Hierarchy falls back to weight; the evidence shows 400/500/600/700 on one screen (`panel-05`). | Use a 5-step scale with real ratios (§6). Delete `3xs`.                                                                                          |
| V-32 | `uppercase` ×127; tracking values `wider`×44, `widest`×37, `wide`×19, `[0.18em]`×12, `[0.16em]`×4, `[0.24em]`×2        | ALL-CAPS labels are everywhere (Folders, App info, Storage details, Permissions, Network headers, `NATIVE`, `SAH-POOL`, the install-time chips), with **six different letter-spacings**.                                                                                                                                                                                                     | Drop caps for labels and keep sentence-case subtle text. If caps stay for table headers, use one token: 11 px, 500, 0.04 em.                     |
| V-33 | Status bar on every screen `x10–420, y998–1014`, `x1680–1905`; `StatusBar.vue:79`; `LinkIndicator.vue:39`              | The status bar is entirely in **lowercase mono prose** ("mirror streaming", "console", "cdp paused"). Mono is meant for values. The status bar is the most-seen text in the app and it reads as a terminal dump.                                                                                                                                                                             | Sans for words, mono only for the serial and the timecode.                                                                                       |
| V-34 | Title bar `x885–1085` + status bar `x60–310` + notice bar + toolbar (`panel-07`)                                       | Link state shows up to **four times** at once (title-bar pill, status bar, notice bar, toolbar pill). The device model appears in both the title bar and the status bar, and the full serial is always visible in the status bar.                                                                                                                                                            | One owner for link state (the title-bar pill) and one for exceptions (the notice). Mask the serial by default (catalogue: sensitive by default). |
| V-35 | `panel-05/06/08 @ y95–135` vs `panel-07 @ y175–215`                                                                    | The background notice sits directly under the tabs on three screens and **under the toolbar and summary** on Network.                                                                                                                                                                                                                                                                        | Fixed slot: directly under the sub-nav, above every toolbar.                                                                                     |
| V-36 | Left content gutter, cross-screen                                                                                      | The content starts at x=80 (the Apps grid, flush to the rail, no gutter), x=85 (Apps toolbar, Data sidebar), x=95/96 (App card, Perf cards, Flows header) or x=104 (tab labels, the Files breadcrumb). That is **four gutters** for the same relationship.                                                                                                                                   | 16 css px page gutter, aligned to the first tab label.                                                                                           |
| V-37 | `panel-11 @ x293–420, y185–225` vs `x510–1410, y255–465`                                                               | The Settings content column (x=510) does not align with the tab row (x=313), and "General" appears twice (tab and heading). About 75 % of a 1375×815 dialog is empty.                                                                                                                                                                                                                        | Use a left-nav settings layout or a narrower dialog. Remove the repeated heading.                                                                |
| V-38 | `panel-11/12 @ x1533–1905`                                                                                             | The mirror snapshot behind the modal stays a **bright white phone** next to the dialog, and the dialog's right edge (x=1647) cuts through its content.                                                                                                                                                                                                                                       | Dim the snapshot under the scrim like the rest of the shell, or hide the dock while a modal is open.                                             |
| V-39 | `panel-01/10 @ x316–1275, y722–965`; `AgentWorkspace.vue:211`                                                          | The composer uses `rounded-3xl` (24 css px against a 6 px base) and a decorative drop shadow on a non-overlay surface (DESIGN: `shadow-float` is for overlays only). That shadow is written `hsl(var(--foreground)/0.45)` over an **OKLCH** token, which is invalid CSS, so it silently does nothing.                                                                                        | Use `rounded-lg` and `shadow-cut` for a well. Delete the dead shadow.                                                                            |
| V-40 | `panel-01/10 @ x440–1515, y250–680`                                                                                    | About 430 px of dead space separates the prompt heading from the composer. The heading copy and the placeholder say the same thing.                                                                                                                                                                                                                                                          | Dock the composer at the top, or use the area for recent tasks and saved flows.                                                                  |
| V-41 | `panel-03 @ x125–160, y158–176`, `x1162–1255, y110–130`, `x1430–1485`                                                  | "Manu" and "Current folde" are clipped with no ellipsis, and "+ Add" is greyed with no reason given.                                                                                                                                                                                                                                                                                         | Size selects to their longest option. Disabled controls get a tooltip with the reason.                                                           |
| V-42 | `panel-03 @ x355–575, y158–282`                                                                                        | The first two "?" tiles are raised (selected? hovered?) and named "?". Unreadable names ship as placeholder content, and every tile repeats "Folder".                                                                                                                                                                                                                                        | Show "unreadable (permission)" in subtle italic. Drop the "Folder" sublabel and show the size or item count.                                     |
| V-43 | `panel-03 @ x205–335, y150–185` vs `panel-02 @ x1380–1400, y112–132`                                                   | Refresh is a bold text button in Files and Permissions, but an icon-only button in Apps, Elements and SQLite.                                                                                                                                                                                                                                                                                | One refresh pattern: an icon button with a tooltip and a binding hint.                                                                           |
| V-44 | `panel-05 @ x186–515, y162–188`; `AppOverviewSurface.vue:183-187`                                                      | Header chips use three styles ("user" is plain, "enabled" is a green outline, "capacitor" a **cyan-300** outline, off-token). Framework branding sits in the app's identity row.                                                                                                                                                                                                             | Neutral `Chip` for every fact. Move framework detection into App info.                                                                           |
| V-45 | `panel-05 @ x111–1490, y640–750`                                                                                       | The permission name column repeats the Android permission column (`POST_NOTIFICATIONS` next to `android.permission.POST_NOTIFICATIONS`). Flags are truncated raw enums ("USER_SEN…") with no tooltip.                                                                                                                                                                                        | One column for the human group name and one for the constant. Flags as chips with readable labels.                                               |
| V-46 | `panel-05 @ x111–480, y552–568`                                                                                        | The summary uses three hues for three counts (green granted, red denied, amber sensitive) plus a grey one.                                                                                                                                                                                                                                                                                   | Neutral counts. Only "denied" earns colour, and only paired with an icon.                                                                        |
| V-47 | `panel-04 @ x160–200, y185–320`, `x160–200, y715–895`                                                                  | The y-axes have **no units** ("100/50/0" for CPU and Memory, "1/0.5" for Network). The x-axis timestamps are in bold mono. Each chart spends most of its area on a flat line.                                                                                                                                                                                                                | Show units on the axis or in the title. Use subtle regular timestamps. Collapse empty charts to sparklines until data arrives.                   |
| V-48 | `panel-06 @ x95–280, y305–360`                                                                                         | "Import JSON snapshot" wraps to two lines, with the icon pinned to the left and vertically off-centre.                                                                                                                                                                                                                                                                                       | Single-line label ("Import snapshot") or a wider sidebar.                                                                                        |
| V-49 | `panel-06/13 @ x795–865, y62–84`                                                                                       | "Graph" sits in the storage-type tab row next to IndexedDB, Cache and the others. It is a view, not a store. The casing also mixes "IndexedDB", "LocalForage" and "LocalStorage".                                                                                                                                                                                                            | Make Graph a view toggle. Use canonical names ("Local storage", "Session storage").                                                              |
| V-50 | `panel-07 @ x597–1220, y110–130`                                                                                       | "All" appears twice next to each other: the type-filter "All" and the status dropdown "All".                                                                                                                                                                                                                                                                                                 | Label the dropdown ("Status: all").                                                                                                              |
| V-51 | `panel-08 @ x655–935, y760–775`, `x92–255, y710–725`                                                                   | The empty prose and the "Filter styles…" placeholder are set in mono, while "Search DOM…" 560 px above is in Sans.                                                                                                                                                                                                                                                                           | Sans for prose and placeholders.                                                                                                                 |
| V-52 | `panel-08 @ x1438–1468, y140–168`                                                                                      | The inspect toggle is a filled `signal-select` square. The selection hue becomes a button fill, and it is the loudest object in the panel.                                                                                                                                                                                                                                                   | Toggle-on state: `accent-soft` background with ink icon, matching the rail.                                                                      |
| V-53 | `panel-13-r5b2-cladd-grid @ x455–577, y314–344`; `header-menu @ x385–1117, y313–345`; `grouped @ x1011–1461, y444–474` | The selected cell is drawn with a **white 2 px box**. DESIGN §2 makes `signal-select` the selection colour; in this grid, white reads as focus on the native menu.                                                                                                                                                                                                                           | Selection box in `signal-select`, with the `accent-soft` fill on the row.                                                                        |
| V-54 | `panel-13-r5b2-grouped @ x384–480, y285–925`                                                                           | Scrolled horizontally, the first data column **slides under the sticky row-number gutter** with no divider or shadow, leaving half glyphs.                                                                                                                                                                                                                                                   | Give the sticky gutter an opaque background and a 1 px right border.                                                                             |
| V-55 | `panel-13-r5b2-grouped @ x1042 vs x1424, y261`                                                                         | The sort arrow for "text" sits 380 px away from its label, at the far edge of the column.                                                                                                                                                                                                                                                                                                    | Put the sort indicator right after the label.                                                                                                    |
| V-56 | `panel-13-r5b2-cladd-grid @ x120–200, y203–223`, `x120–210, y267–287`                                                  | The storage-engine chips are **green `NATIVE`** (green that is not live) and **blue `SAH-POOL`** (an internal VFS name, ALL-CAPS mono).                                                                                                                                                                                                                                                      | Neutral chips, human labels ("Native SQLite", "OPFS · SAH pool") with a tooltip.                                                                 |
| V-57 | `panel-13-r5b2-cladd-grid @ x335–1910, y955–990` and `y998–1014`                                                       | **Two status bars are stacked**: grid footer and app status bar, both in mono at the same size.                                                                                                                                                                                                                                                                                              | Fold the grid's provenance into its toolbar, or make the footer visually part of the grid well.                                                  |
| V-58 | `panel-13-r5b2-cladd-grid @ x335–385` vs `x385–455`                                                                    | The row-number gutter (1, 2, 3…) sits next to an `id` column holding the same numbers. That spends 120 px on duplicates.                                                                                                                                                                                                                                                                     | Hide the row number when the table has an integer PK that is shown first.                                                                        |
| V-59 | `panel-13-r5b-sqlite-filter2` vs `panel-13-r5b2-cladd-grid`                                                            | Text cells were mono in r5b and are Sans in r5b2. DESIGN §3 says "Data… IBM Plex Mono". The implementation and the rule disagree. (Opinion: Sans for text cells is right, as in TablePlus and Linear; mono for numbers, ids and JSON.)                                                                                                                                                       | Update DESIGN §3 to "mono for numbers, identifiers, code, JSON; Sans for free text".                                                             |
| V-60 | `panel-13-r5b-context-menu @ x120–175, y178–198`                                                                       | The database name is truncated to "com.g…". Sizes are written "52KB" here and "52 KB" elsewhere.                                                                                                                                                                                                                                                                                             | Show the logical name over the file name, and use one unit format (`52 KB`, thin space).                                                         |
| V-61 | Title bar `x1605–1630, y12–22`; `panel-11 @ x1088–1096, y195`                                                          | The unread dots use `signal-select` (blue), a role DESIGN reserves for selection and focus.                                                                                                                                                                                                                                                                                                  | Add an `attention` role, or use ink.                                                                                                             |
| V-62 | Mirror toolbar `x1785–1805, y62–78`; `MirrorTopBar.vue:114`                                                            | A bare "SC" text glyph sits in an icon toolbar (it means "native scrcpy").                                                                                                                                                                                                                                                                                                                   | An icon with a tooltip, or move it into an overflow menu.                                                                                        |
| V-63 | `panel-02 @ x1533–1548, y912–930` and `x1890–1905, y912–930`                                                           | The bottom corners of the mirror show **white wedges** where the rounded mask meets a black frame.                                                                                                                                                                                                                                                                                           | Clip the stream with the same radius as the bezel, or square the frame.                                                                          |
| V-64 | `panel-02/03 @ x1533–1905, y100–930` vs status bar "mirror streaming"                                                  | The mirror is black or blank while the status bar says "mirror streaming".                                                                                                                                                                                                                                                                                                                   | Report frame age ("last frame 12 s ago") when no frames are arriving.                                                                            |
| V-65 | Every screen `x1533–1905`                                                                                              | The mirror is the brightest and most saturated region of every screen, a light phone UI at full luminance inside a dark tool. The eye lands on the client app, not on the instrument. _Opinion, backed by the frames:_ it competes with the work area on every screen, including Replay and Settings, where it is irrelevant.                                                                | Run the mirror at about 85 % brightness when it is unfocused, and let routes collapse it to a thumbnail.                                         |
| V-66 | Rail in `panel-13-*` (icons only, `w-12`) vs every other capture (labelled)                                            | The rail changes mode between captures. The collapsed rail has no labels, its tooltips cover neighbours (V-08), and the active bar sits at x=0–2, flush to the window edge.                                                                                                                                                                                                                  | Choose labelled as the default. In collapsed mode, use right-side tooltips and an inset active bar.                                              |
| V-67 | `panel-07 @ x95–295, y152–168`                                                                                         | The summary line "10 requests · 80 KB transferred" is subtle at alpha and sits **above** the notice bar.                                                                                                                                                                                                                                                                                     | Put it in the table footer.                                                                                                                      |
| V-68 | `panel-07 @ x1245–1305, y265–645`                                                                                      | The SIZE column shows "0 B" for responses served from disk and "(cache)" for one, so one fact gets two encodings.                                                                                                                                                                                                                                                                            | "cache" in subtle text for every cached response.                                                                                                |

### S3: nits

- **V-69** Title-bar keycaps "CTRL K" (`x1525–1585, y14–34`) are heavier and brighter than the
  placeholder they annotate. Use subtle text for the keycaps.
- **V-70** The wordmark "capubridge" (`x45–127, y16–33`) is generic Plex Sans 600 with tight tracking, and
  the mark's live trace is 2 px at 18 px, invisible in `panel-01`.
- **V-71** The window controls are 40 px tall (`TitleBar.vue:192-209`) in a 28 px control language. They
  have no hover state except close turning red.
- **V-72** `panel-05 @ x1322–1482, y240–250`: "runtime, package, storage" is right-aligned meta that
  repeats the section names.
- **V-73** `panel-05`: "SDK 24 / 36" (with spaces) next to "sdk 36" (lowercase) on the same card.
- **V-74** Folders tree header `panel-03 @ x95–180, y203–218`: an icon plus an ALL-CAPS "FOLDERS" label
  in subtle text for a single-section tree.
- **V-75** `panel-02` grid cells draw a 1 px vertical rule and no horizontal rule, so the grid reads
  as columns, not tiles.
- **V-76** `main.css:156`: the comment says "Brand accent (coral)". Coral no longer exists.
  `DevicePerf.vue:695-696`: a ternary whose branches are both `'text-warning'`.
- **V-77** `NetworkRequests.vue` and `ReplayNetworkPanel.vue` carry the same colour maps line for line
  (197↔187, 231↔216, 440↔350). Any fix to V-15 must be made twice.

---

## 2. Consistency across screens (drift matrix)

| Element             | Variants seen                                                                                                                                         | Screens                    |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Page header         | sub-nav tabs (Device, App, Data, Network, Elements); panel header "Task history" (Flows); **none** (Replay); dialog tabs (Settings)                   | all                        |
| Tabs                | 5 treatments (V-27)                                                                                                                                   | 02–08, 11, 13              |
| Search field        | 8 (V-26)                                                                                                                                              | all                        |
| Empty state         | 7 (V-25)                                                                                                                                              | 01, 02, 04, 06, 08, 09, 13 |
| Refresh             | bold text button / icon button (V-43)                                                                                                                 | 02, 03, 05, 08, 13         |
| Chips               | grey plain, green outline, cyan outline, green caps mono, blue caps mono, green mono "live" pill, caps mono outline install-time, tinted method badge | 05, 07, 13                 |
| Primary button      | white solid ("Open", "Open .capu file"); light bevel ("Bring app to front"); bold text ("Columns", "Export")                                          | 05, 07, 09, 13             |
| Row height (css px) | 32 network · ~37 permissions · 28 file tree · ~26 SQLite · 105 file tiles · 120 app tiles. DESIGN says 22/26/30.                                      | 02–07, 13                  |
| Radius              | `rounded-md` 153, `-full` 135, `-lg` 96, `-sm` 46, `-xl` 38, `-2xl` 24, `-3xl` 1, ten arbitrary `rounded-[Npx]` from 2 to 34 px; Cladd radii 15       | source                     |
| Icon size           | 10, 11, 12, 13, 14, 16, 17 px (`:size`), plus `h-3`, `h-3.5`, `h-4`, `h-6`, `h-7`, `h-10`                                                             | source                     |
| Section title case  | "Storage details", "App info" (sentence) vs "CPU Total", "Per Core — live" (title)                                                                    | 04, 05                     |

---

## 3. Component system fidelity (Cladd/Bench)

- **Adoption is about 6 %.** 9 `.vue` files import `@capubridge/cladd`: four SQLite browse files,
  `KeyCaps`, three gate components and the rail tooltip. **153** import `@/components/ui/*` (shadcn).
  The top shadcn imports are `button` 65, `input` 28, `badge` 28, `dialog` 23, `select` 22. The shell
  (title bar, context pill, sub-nav, status bar), Device, App, Network, Elements, Replay, Flows and
  Settings contain **no Cladd at all**. `DevicePerf.vue` is built on shadcn `Card`, a component
  DESIGN marks as retiring.
- **Hand-rolled colour.** There are 48 raw Tailwind palette hues (`violet-400/500`, `purple-300/400`,
  `pink-400`, `teal-400/500`, `indigo-400/500`, `cyan-300/500`, `fuchsia-500`, `sky-500`) across app,
  devices, inspect, network, recording and storage, plus 71 `rgb()`/hex literals and 16 arbitrary
  `shadow-[…]`. Each one bypasses the "one palette" bridge.
- **Hand-rolled geometry.** There are 300+ arbitrary bracket values: storage 87, settings 82,
  recording 46, network 34 and devices 26.
- **Fake controls.** The settings rows (V-05) and the folder art (V-14) are drawn, not components.
- **Two icon families.** The app uses Lucide (150 imports, 2 px stroke). Cladd ships its own filled,
  Material-style glyphs (`packages/cladd/src/components/icons/DropdownIcon.vue`, a filled path). Once
  Cladd `Select` and `SearchField` spread, filled chevrons will sit next to stroked Lucide icons.
- **The bridge clamps the scale** (`cladd-bridge.css:29-34`). Three Cladd sizes collapse to 11 px, so
  Cladd components lose their internal hierarchy (V-31).
- **The SQLite grid is the most coherent surface in the evidence.** Typed column glyphs, italic subtle
  `NULL`, tabular numerals, the SQL `WHERE` well, and the provenance footer (`read-only · local copy ·
5 ms`) all work together. The rest of the app should follow it, once V-12, V-13 and V-53 to V-58 are
  fixed.

---

## 4. Density and data presentation

- **Signal-to-chrome.** In the SQLite grid, data starts at y≈280 after title bar, storage tabs,
  Browse/Structure/SQL, breadcrumb, filter row and column header, so 27 % of the height is chrome
  before the first row. VS Code's editor starts at about 8 %. Merge the breadcrumb into the sub-tab
  row, and the filter and search into one row.
- **Space is spent where there is no data.** Perf charts draw flat lines across 700 px. Per Core is a
  190 px card with one sentence. The network table ends at y=650 with no detail pane. The Settings
  dialog is 75 % empty. The DOM tree shows one line over 450 px.
- **Data is cramped where it matters.** Grid headers are truncated with 700 px free (V-12). App names
  and DB names are clipped (V-10, V-60).
- **Rows are taller than the system says.** 32 css px network rows against DESIGN's 22/26/30. A
  network tool at 32 px shows about 22 requests per screen; Chrome DevTools shows about 40 at 21 px.

---

## 5. Brand identity: judgement and a 9.7 direction

**What exists.**

- The palette is a warm graphite (hue 95), with phosphor lime for live, Plex Sans and Mono, neutral ink
  for primary actions, and a two-bar mark with a step trace.
- The _rules_ are distinctive: colour as meaning, provenance as pattern, time as the x-axis.
- The _pixels_ are not.

**Would a cropped screenshot be recognised?** No.

- Take any 400×400 crop of panels 02 to 08. It could be VS Code with a dark theme, a shadcn admin
  template or Chrome DevTools.
- The only recognisable crops are those with the mirror in them, and the mirror shows _someone else's_
  brand.
- The idea that is actually ownable, provenance and stale hatching, appears once (the SQLite footer).

**Typography.**

- Plex Sans and Mono is a safe, IBM-Carbon pairing. It is neither distinctive nor wrong.
- Plex Mono's slab serifs and wide advance make dense data look like a typewriter. In the status bar
  and the network table it reads as old-fashioned, not precise. (Opinion.)
- The real typographic fault is not the family. It is the 1 px-step scale, the four weights in use,
  the faux bold and the caps chaos (V-29 to V-32).

**Naming and framing (owner directive 2).** "capu" is Capacitor. The UI reinforces the framing in five
places:

- the `capacitor` chip (V-44)
- a top-level "Vue" tab in Elements
- `_capacitor_file_` URLs, which are fine because they are data
- the brief's own "hybrid app" tagline in DESIGN.md §0
- "Bench… hybrid apps"

The visual identity should not depend on the name. Make the mark and the trace the brand, so a rename
costs only a wordmark.

**Direction for a 9.7 identity: "the trace".**

1. **One signature, everywhere: the now-edge.**
   - A 1 px phosphor-lime trace runs under the context pill, the length of the title bar.
   - It moves only while data is live.
   - It freezes and turns into the hatch pattern when the link is paused or stale.
   - The same trace is the Replay playhead, the mark's step and the empty-state illustration.
   - This makes "one clock" visible and makes every crop recognisable. No reference tool owns a live
     trace in its chrome.
2. **Lime is the only chroma in the chrome.** Every other hue lives inside evidence (lanes, chips
   with icons). Drop the green, amber and blue from verbs, folders, file types, chips and icons. That
   alone removes about half of the S1s in §1.
3. **Provenance is the visual language, not a footnote.**
   - Every value surface carries its pattern: hatch for stale, dotted for cached, perforated for
     recorded.
   - The background notice becomes a hatch band over the stale region, not an amber triangle bar.
4. **Wordmark.**
   - Draw a custom wordmark, or set Plex Sans 500 at +0.01 em with the step trace as a joining stroke
     or terminal.
   - Make the mark bigger (24 px in the title bar) so the lime step can be seen.
   - Prepare it name-agnostic: the trace survives a rename.
5. **Iconography.**
   - Lucide only, 1.5 px stroke, 14 and 16 px.
   - Always `currentColor`, muted by default, ink when active.
   - Remove the decorative icons from the sub-nav tabs, or keep them and remove them from section
     titles. Not both.
6. **Drop the following:**
   - the coloured folder art
   - rainbow type and verb colours
   - bold mono hero numbers
   - the 24 px-radius composer and its shadow
   - framework chips
   - lowercase mono status prose
   - the red idle Record dot
   - per-screen empty states

---

## 6. Visual system specification (fixes at the root)

**Type (css px).**

| Role  | Size / line | Weight    | Use                                                                   |
| ----- | ----------- | --------- | --------------------------------------------------------------------- |
| meta  | 11/16       | 400       | Captions, units, timestamps, keycaps                                  |
| data  | 12/16       | 400       | Table body, logs, JSON. Mono for numbers and ids; Sans for free text. |
| ui    | 13/18       | 400 / 500 | Controls, labels, body. 500 for active and selected.                  |
| title | 15/20       | 500       | Section and card titles, sentence case                                |
| page  | 20/26       | 600       | Page or empty-state title. Rare.                                      |

- Five sizes in total. Retire 14, 16, 18 and 22 from product UI; keep them for the website.
- Mono runs at 400 and 500 only.
- Mono and bold never combine. Remove `font-bold` from the scale outside `page`.
- No ALL-CAPS labels. Table headers are `meta` 500 in subtle text.

**Spacing.** Use a 4 px base with the scale **4, 8, 12, 16, 24, 32** and nothing else.

- Page gutter: 16.
- Panel padding: 12 (dense) or 16.
- Toolbar height: 40, with 8 between controls.
- Section gap: 24.
- Lint bans `p-[`, `m-[` and `gap-[`.

**Size and radius.**

- Controls: 24 (dense) and 28.
- Rows: 24 (dense) and 28 (default). Delete the 32 px row.
- Radius:
  - 4 for chips, cells and keycaps
  - 6 for controls
  - 8 for panels, dialogs and popovers
  - `full` for dots and avatars only
- Ban `rounded-xl` and above, and every `rounded-[…]`.

**Surfaces.** Three levels plus a well. Use exactly one depth cue per edge: bevel _or_ border, never
both, and no shadow below an overlay.

| Level                             | Token               | Lightness |
| --------------------------------- | ------------------- | --------- |
| L0 chrome and app                 | `bg-app`            | 0.165     |
| L1 panel                          | `bg-surface`        | 0.195     |
| L2 raised: hover, menus, overlays | `bg-surface-raised` | 0.235     |
| Well: inputs, code, tracks        | `bg-surface-cut`    | 0.175     |

**Colour roles (enforced).**

- Text has exactly three greys: default, muted and subtle. Ban `text-*/alpha` (V-24).
- Live is lime and appears only in link indicators, the now-edge and the playhead.
- Rec is red and appears only while recording.
- Select is blue and appears only for selection, focus and the active nav bar.
- Success, warning and danger mark outcomes only, always paired with an icon and text.
- `cat-*` colours appear only in lanes and evidence chips.
- Extend `check:design-tokens` to reject raw palette hues, rgb and hex literals, arbitrary shadows, and
  any outcome token in a map keyed by HTTP verb or file type.

**Icons.**

- Lucide, 1.5 stroke, sizes 14 (dense) and 16 (default).
- Monochrome `currentColor`.
- An icon is never the only carrier of meaning.

**Components.**

- **Tabs and filters:** Cladd `Tabs` for navigation and `Segmented` for filters.
- **Search:** one `SearchField`.
- **Empty and gated states:** one `EmptyState` and `GatedView`.
- **Chips:** one `Chip` (neutral, or state with an icon).
- **Context menus:** app-defined only. Suppress the browser default.
- **Retire shadcn on a schedule per module:** shell, then Device, App, Network, Elements, Replay,
  Flows, Settings.

---

## 7. Scores (RUBRIC anchors)

| Dimension                         | Score   | Why (findings)                                                                                                                                                                                                                                                                                                                           |
| --------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Brand identity**                | **5.0** | The rules are distinctive, but the screens break them: green for non-live (V-15, V-56, V-28, V-01), red rec while idle (V-16), decorative amber folders (V-14). The ownable idea, provenance, is invisible (§5). A crop is not recognisable, and the wordmark is generic (V-70). With open S1s, the cap is 7; the evidence puts it at 5. |
| **Visual craft**                  | **4.5** | Seven S0s, including four lies on Perf and Network (V-01 to V-04) and a broken DOM line (V-09). Truncation without ellipsis (V-10, V-12, V-20, V-41). Systemic AA failure (V-24). Faux bold (V-29). A 1 px-step scale (V-31), four gutters (V-36) and misaligned headers (V-13, V-55).                                                   |
| **Component system fidelity**     | **3.5** | Cladd is in 9 of about 160 view files (§3). There are 7 empty-state, 8 search and 5 tab patterns (V-25 to V-27), fake settings controls (V-05), the native browser context menu (V-06), 48 raw hues and 300+ arbitrary values. This is "amateur" on the drift axis, rescued only by the SQLite grid.                                     |
| **Density and data presentation** | **5.0** | The grid conventions are right: types, NULL, tabular numerals, provenance. But the header-to-data ratio is 27 %, rows are 32 px, headers are truncated with 700 px free, charts are unit-less and flat, and app and file tiles run 105–120 px (§4, V-12, V-47, V-58).                                                                    |

Mean of my four is 4.5. Against the owner's 7 for "brand + idea": the idea may be a 7, but the
rendered brand is a 5.

---

## 8. What I could not judge

- **The command palette.** `panel-12` does not show it (V-07).
- **Light theme and High Contrast.** No captures.
- **Motion and the reduced-motion behaviour.** Static captures only.
- **Focus rings and keyboard order.** Only one focus state appears: the native menu's white box.
- **Replay with a loaded session**, which is the timeline the brand thesis depends on, and the
  Logcat, Shell, Ports, Console, Mocking and Structure/SQL tabs.
- **The 11 px floor in absolute terms.** The 125 % scaling makes exact css sizes inferred, not
  measured.

---

## 9. The three changes that move the score most

1. **Make colour mean one thing, mechanically.**
   - Extend `check:design-tokens` to ban `text-*/alpha`, raw palette hues, rgb and hex literals, and
     outcome tokens in category maps.
   - Then fix the hits: verbs, folders, perf, chips, icons, the idle Record dot.
   - This removes V-14, V-15, V-16, V-24, V-28, V-44, V-46, V-56 and V-61 together, and it is the
     precondition for any recognisable identity.
2. **Finish the Cladd migration for the shell and the five shared patterns before any more screens**:
   - tabs and segmented controls
   - search field
   - empty and gated states
   - chips
   - buttons, including the settings controls
   - plus a suppressed native context menu

   This addresses V-05, V-06, V-08 and V-25 to V-27, and lifts component fidelity from about 3.5 to
   about 7.

3. **Ship the honesty layer and the brand signature together**:
   - Remove every invented value (V-01 to V-04, V-11, V-18, V-64) in favour of "unknown + why + source
     - age".
   - Make the stale and paused state the hatched now-edge trace, not an amber notice bar.

   The product's thesis then becomes the thing a cropped screenshot shows.
