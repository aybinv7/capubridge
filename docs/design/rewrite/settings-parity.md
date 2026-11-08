# Settings parity

Every action, control, state and piece of data in Settings before the rewrite (`feat/settings-cladd`,
cut from `master` at `87bfb07b`), and where it lives after. Paths are under
`apps/desktop/src/modules/settings/` unless they say otherwise.

## Shell

| Before                                                                  | File                     | After                                                               |
| ----------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------- |
| Opens on any `/settings/*` route, closes by going back or to `/devices` | `SettingsModal.vue`      | [x] `SettingsDialog.vue` (same rule, `useSettingsClose.ts`)         |
| `/settings` lands on General                                            | `routes.ts`              | [x] lands on Appearance; General had no working setting (see below) |
| Section tabs across the top with icons                                  | `SettingsModal.vue`      | [x] `SettingsNav.vue`: a list on the left, like the Device manager  |
| Dot on Updates when an update is available                              | `SettingsModal.vue`      | [x] `SettingsNav.vue` (StatusDot, brand)                            |
| Dot on AI / MCP when the server runs                                    | `SettingsModal.vue`      | [x] `SettingsNav.vue` (StatusDot, green)                            |
| `mcp.refresh()` when Settings opens                                     | `SettingsModal.vue`      | [x] `SettingsDialog.vue`                                            |
| `Mod+,` opens Settings, palette entries per section                     | `app/useCoreCommands.ts` | [x] unchanged; sections come from `routes.ts` meta                  |
| `/settings/theme` redirects to Appearance                               | `routes.ts`              | [x] kept                                                            |
| Toast action "Open settings" → `/settings/updates`                      | `UpdaterBootstrap.vue`   | [x] unchanged route                                                 |

## General (removed as a page)

| Before                                   | After                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| "Display language: English", no control  | [x] dropped: static text, no setting behind it. `/settings/general` redirects |
| "Desktop notifications: Off", no control | [x] dropped: static text, no setting behind it                                |

## Appearance

| Before                                                                                                             | File                     | After                                              |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------ | -------------------------------------------------- |
| Theme cards: three surface swatches, four signal swatches, name in the theme's font, contrast class, pressed state | `ThemeCard.vue`          | [x] `ThemeCard.vue` (Cladd tokens, selection ring) |
| Pick a theme (`useTheme().setTheme`)                                                                               | `SettingsAppearance.vue` | [x] `SettingsAppearance.vue`                       |
| Show the timeline switch (`strip.setHidden`), Ctrl+Shift+J note                                                    | `SettingsAppearance.vue` | [x] `SettingsAppearance.vue`                       |
| Timeline position Top / Bottom (`strip.setEdge`)                                                                   | `SettingsAppearance.vue` | [x] `SettingsAppearance.vue`                       |
| New: show the navigation rail (`ui.toggleRail`), Ctrl+B note                                                       | `stores/ui.store.ts`     | [x] `SettingsAppearance.vue`                       |

## ADB and Chrome → Devices

| Before                                                                | File                           | After                                                                             |
| --------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------- |
| ADB runtime: resolved from CAPUBRIDGE_ADB_PATH, bundled tools or PATH | `SettingsAdb.vue`              | [x] `SettingsDevices.vue`, Android card                                           |
| Device refresh: managed by the device workspace                       | `SettingsAdb.vue`              | [x] `SettingsDevices.vue`, Android card                                           |
| Chrome CDP port `CHROME_CDP_PORT`                                     | `SettingsChrome.vue`           | [x] `SettingsDevices.vue`, Chrome card                                            |
| Chrome executable detected automatically                              | `SettingsChrome.vue`           | [x] `SettingsDevices.vue`, Chrome card                                            |
| Launch configuration not configurable yet                             | `SettingsChrome.vue`           | [x] `SettingsDevices.vue`, Chrome card (one sentence)                             |
| `/settings/adb`, `/settings/chrome`                                   | `routes.ts`                    | [x] redirect to `/settings/devices`                                               |
| New: phones paired over Wi-Fi, Reconnect by itself, Forget            | `stores/pairedPhones.store.ts` | [x] `RememberedPhones.vue`                                                        |
| New: Connect over Wi-Fi from Settings                                 | `stores/ui.store.ts`           | [x] `RememberedPhones.vue` (closes Settings, opens the Device manager on Connect) |

## Screen (new page, same settings as the screen column's popover)

| Setting                         | Source                                   | After                    |
| ------------------------------- | ---------------------------------------- | ------------------------ |
| Frame rate of web previews      | `modules/mirror/MirrorSettingsPanel.vue` | [x] `SettingsScreen.vue` |
| Quality of stream and recording | `modules/mirror/MirrorSettingsPanel.vue` | [x] `SettingsScreen.vue` |
| Bitrate                         | `modules/mirror/MirrorSettingsPanel.vue` | [x] `SettingsScreen.vue` |

The popover in the screen column stays; both edit `mirror.settings`.

## Shortcuts

| Before                                                                    | File                    | After                                                                                                          |
| ------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| Bound commands grouped by group, from the registry                        | `SettingsShortcuts.vue` | [x] `SettingsShortcuts.vue`                                                                                    |
| "In the console dock": Alt 1–9, Mod Up/Down, Esc                          | `SettingsShortcuts.vue` | [x] renamed "In the console drawer" (the dock is gone; the keys live in `components/drawer/ConsoleDrawer.vue`) |
| Command palette: prefixes sentence with the opener's keys, Up/Down, Enter | `SettingsShortcuts.vue` | [x] `SettingsShortcuts.vue`                                                                                    |

## AI access (MCP)

| Before                                                                                   | After                           |
| ---------------------------------------------------------------------------------------- | ------------------------------- |
| Enable switch, Running / Stopped state                                                   | [x] `mcp/McpServerCard.vue`     |
| Error banner from `mcp.error`                                                            | [x] `mcp/McpServerCard.vue`     |
| Endpoint URL with copy                                                                   | [x] `mcp/McpConnectionCard.vue` |
| Bearer token masked, show/hide, copy, Regenerate                                         | [x] `mcp/McpConnectionCard.vue` |
| Port field with validation 1–65535 and Apply                                             | [x] `mcp/McpConnectionCard.vue` |
| Legacy shared principal switch                                                           | [x] `mcp/McpConnectionCard.vue` |
| Create a client: name, capabilities Read/Execute/Authorize/Administer, validation toasts | [x] `mcp/McpClientsCard.vue`    |
| New token shown once with copy                                                           | [x] `mcp/McpClientsCard.vue`    |
| Client list: name, id, last used, capabilities, token hint, revoked, Revoke              | [x] `mcp/McpClientRow.vue`      |
| Empty: no clients yet                                                                    | [x] `mcp/McpClientsCard.vue`    |
| Client config JSON with copy                                                             | [x] `mcp/McpConfigCard.vue`     |
| Available tools with read-only / mutating                                                | [x] `mcp/McpToolsCard.vue`      |
| Security note                                                                            | [x] `mcp/McpServerCard.vue`     |
| Link text to modelcontextprotocol.io                                                     | [x] `SettingsMcp.vue` footer    |
| Every success and failure toast                                                          | [x] `mcp/useMcpSettings.ts`     |

## Updates

| Before                                                        | After                         |
| ------------------------------------------------------------- | ----------------------------- |
| Current version from `getVersion()`, fallback to updater info | [x] `SettingsUpdates.vue`     |
| Pre-release switch, re-checks after change                    | [x] `SettingsUpdates.vue`     |
| Check now, last checked time, spinner while checking          | [x] `SettingsUpdates.vue`     |
| Up-to-date notice, success toast                              | [x] `SettingsUpdates.vue`     |
| Update available: version, release notes, Install and restart | [x] `UpdateAvailableCard.vue` |
| Download progress bar with percent                            | [x] `UpdateAvailableCard.vue` |
| Error with Retry, error toasts                                | [x] `SettingsUpdates.vue`     |
