# Theme

CapuBridge supports system, light, and dark appearance modes.

## Modes

- System follows the operating-system color-scheme preference and reacts when it changes.
- Light applies the light design tokens regardless of the system preference.
- Dark applies the dark design tokens regardless of the system preference.

The selected mode is persisted locally and applied during application startup. The application shell does not force a hardcoded dark class.

## Design tokens

Colors, typography, borders, focus states, and elevation use the CSS custom properties in the desktop style layer. Feature modules consume semantic tokens such as background, foreground, muted, accent, border, and ring instead of hardcoded theme colors.

Geist and Geist Mono provide the default interface and code typography with system fallbacks. Lucide provides interface icons.
