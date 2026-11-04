export type ThemeMode = "dark" | "light";
export type ContrastClass = "AA" | "AAA";
export type BrandDirection = "bench";

/**
 * Every colour in the product comes from one of these roles. Each role means one
 * thing: signals are reserved for their state, categories label evidence kinds,
 * states carry outcomes. Values are hex or `oklch(L C H)` strings.
 */
export type ThemeTokens = {
  bgApp: string;
  bgChrome: string;
  bgSurface: string;
  bgSurfaceRaised: string;
  bgSurfaceCut: string;
  bgOverlay: string;

  fgDefault: string;
  fgMuted: string;
  fgSubtle: string;

  borderDefault: string;
  borderStrong: string;
  borderSubtle: string;

  /** Live data, the now-edge of the timeline, the playhead. */
  signalLive: string;
  /** Recording in progress. */
  signalRec: string;
  /** Selection, focus ring, active navigation. */
  signalSelect: string;
  /** User marks, bookmarks, annotations. */
  signalMark: string;

  stateSuccess: string;
  stateWarning: string;
  stateDanger: string;
  stateInfo: string;

  catNetwork: string;
  catStorage: string;
  catDevice: string;
  catConsole: string;
  catAgent: string;

  /** Colour mixed into surfaces for bevel highlights (white on dark, black on light). */
  highlight: string;
};

export type ThemeFonts = {
  sans: string;
  mono: string;
};

export type Theme = {
  id: string;
  label: string;
  direction: BrandDirection;
  mode: ThemeMode;
  tokens: ThemeTokens;
  fonts: ThemeFonts;
  meta: { contrastClass: ContrastClass };
};
