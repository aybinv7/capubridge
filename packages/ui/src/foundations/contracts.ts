export const uiSizes = ["2xs", "xs", "sm", "md", "lg", "xl", "2xl"] as const;

export type UiSize = (typeof uiSizes)[number];

export const uiAccents = [
  "neutral",
  "brand",
  "red",
  "pink",
  "purple",
  "blue",
  "cyan",
  "lime",
  "green",
  "yellow",
  "orange",
] as const;

export type UiAccent = (typeof uiAccents)[number];

export const uiThemes = ["dark", "light"] as const;

export type UiTheme = (typeof uiThemes)[number];

export const surfaceLevels = [1, 2, 3, 4, 5] as const;

export type SurfaceLevel = (typeof surfaceLevels)[number];

export const surfaceVariants = [
  "transparent",
  "solid",
  "gradient",
  "solid-fill",
  "gradient-fill",
] as const;

export type SurfaceVariant = (typeof surfaceVariants)[number];

export type SurfaceLevelInput = number | `${number}`;

export const overlayPhases = ["closed", "opening", "opened", "closing"] as const;

export type OverlayPhase = (typeof overlayPhases)[number];
