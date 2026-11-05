import { columnsFor } from "../shared/grid";

export type AppsView = "list" | "grid";
export type AppsDensity = "small" | "medium" | "large";

interface TileSize {
  width: number;
  height: number;
  icon: "sm" | "md" | "lg";
}

/** Tile sizes per density. Small fits about eight to a row, large about four, as before. */
export const APP_TILES: Record<AppsDensity, TileSize> = {
  small: { width: 96, height: 92, icon: "sm" },
  medium: { width: 120, height: 112, icon: "md" },
  large: { width: 168, height: 140, icon: "lg" },
};

/** Row height of the list view. */
export const APP_ROW_HEIGHT = 30;

/** How many tiles fit across `width` pixels, never fewer than one. */
export function gridColumns(width: number, density: AppsDensity): number {
  return columnsFor(width, APP_TILES[density].width);
}
