import type { ThemeFonts } from "./types";

const systemSans = "ui-sans-serif, system-ui, sans-serif";
const systemMono = "ui-monospace, monospace";

export const benchFonts: ThemeFonts = {
  sans: `"IBM Plex Sans Variable", ${systemSans}`,
  mono: `"IBM Plex Mono", ${systemMono}`,
};
