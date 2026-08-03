import type { SurfaceLevel, SurfaceLevelInput } from "./contracts.ts";

const minimumSurfaceLevel = 1;
const maximumSurfaceLevel = 5;

export function clampSurfaceLevel(level: number): SurfaceLevel {
  return Math.min(maximumSurfaceLevel, Math.max(minimumSurfaceLevel, level)) as SurfaceLevel;
}

export function resolveSurfaceLevel(
  level: SurfaceLevelInput | undefined,
  parentLevel: number,
): SurfaceLevel {
  if (level === undefined) {
    return clampSurfaceLevel(parentLevel + 1);
  }

  if (typeof level === "string") {
    const parsedLevel = Number.parseInt(level, 10);

    if (!Number.isFinite(parsedLevel)) {
      return clampSurfaceLevel(parentLevel + 1);
    }

    return clampSurfaceLevel(
      level.startsWith("+") || level.startsWith("-") ? parentLevel + parsedLevel : parsedLevel,
    );
  }

  return clampSurfaceLevel(Number.isFinite(level) ? level : parentLevel + 1);
}
