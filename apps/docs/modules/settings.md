# Settings

Status: Stable

Settings exposes only preferences that affect current runtime behavior.

## Theme

Users can select system, light, or dark mode. System mode follows the operating-system preference. Explicit light or dark mode overrides it. The selected mode persists between application sessions.

See [Theme configuration](../guide/config/theme.md).

## Shortcuts

The shortcut view lists shortcuts that are actually registered by the application. Removed and placeholder actions are not displayed.

See [Keyboard shortcuts](../guide/config/shortcuts.md).

ADB paths, Chrome paths, updater behavior, server startup, and similar settings remain absent until their persisted values control real backend behavior with validation and reset semantics.
