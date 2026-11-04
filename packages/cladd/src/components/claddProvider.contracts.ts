import type { ComponentDefaults } from '../foundations/componentDefaults.ts';
import type { Color } from '../types.ts';

export type UiTheme = 'dark' | 'light';

export interface CladdProviderProps {
  /** App-wide accent color. Read by `useAccentColor`. Default `'brand'`. */
  accentColor?: Color;
  /** Per-component default props, applied app-wide. */
  defaults?: ComponentDefaults;
  /** Root element(s) to insert overlays into. Default `'#app, #__next, #root'`. */
  overlaysRoot?: string;
  /** Color scheme. Read by `useTheme`. Default `'dark'`. */
  theme?: UiTheme;
}
