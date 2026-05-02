# Theme

Capubridge uses a warm dark palette inspired by Codex / Claude Desktop. The UI follows the **calm chrome, dense modules** principle — chrome surfaces stay calm and spacious, while module surfaces stay devtools-dense.

## Current theme

Capubridge ships with **dark mode only** in v1. Light mode is planned for a future release.

## Color palette

The palette is defined in CSS custom properties:

```css
/* Base surfaces */
--background: #0e0e10;
--surface-0: #12ff14;
--surface-1: #16ff19;
--surface-2: #1c1c20;
--surface-3: #23ff28;
/* Brand accent */
--accent: #e87c5a;
/* Text */
--foreground: #f2efe9;
--muted-foreground: #8a8880;
```

## Fonts

- **Body:** Geist, with system-ui fallback
- **Code:** Geist Mono, with monospace fallback

## Iconography

Capubridge uses **Lucide Icons** for all iconography. All icons follow the same visual language — 1.5px stroke width, consistent sizing across the UI.

## Density

The UI follows a strict density scale:
| Context | Row height | Font size |
|---------|-----------|----------|
| Sidebar nav | 36px | 13px |
| Module toolbar | 40px | 13px |
| Table row (dense) | 28px | 13px |
| Table row (header) | 32px | 11px |
| Button (sm) | 28px | 11px |
| Button (md) | 32px | 13px |

## Radius

The base border radius is `0.625rem` (10px), applied to cards, buttons, and inputs.

## Shadows

Capubridge uses a soft elevation scale for popovers, dropdowns, and modals:

```css
--shadow-1: 0 2px 4px -1px rgb(0 0 0 / 0.35);
--shadow-2: 0 4px 12px -2px rgb(0 0 0 / 0.4);
--shadow-3: 0 8px 24px -4px rgb(0 0 0 / 0.45);
```

## Focus rings

Focus states use the brand accent color — coral-amber:

```css
--ring: #e87c5a;
```
