import type { LogcatEntry, LogcatLevel } from "@/types/logcat.types";

export type LogcatLevelCounts = Record<LogcatLevel, number>;

export interface LogcatTally {
  add(entries: readonly LogcatEntry[]): void;
  remove(entries: readonly LogcatEntry[]): void;
  reset(): void;
  /** A fresh copy of the per-level counts. */
  levels(): LogcatLevelCounts;
  /** Packages seen in the kept lines, sorted. */
  packages(): string[];
  /** Whether a package appeared or disappeared since the last call. */
  takePackagesChanged(): boolean;
}

function emptyLevels(): LogcatLevelCounts {
  return { V: 0, D: 0, I: 0, W: 0, E: 0, F: 0 };
}

/**
 * Counts kept logcat lines by level and package, updated by what a flush adds and evicts
 * instead of re-counting the whole buffer.
 */
export function createLogcatTally(): LogcatTally {
  let levels = emptyLevels();
  const packageCounts = new Map<string, number>();
  let packagesChanged = false;

  return {
    add(entries) {
      for (const entry of entries) {
        levels[entry.level] += 1;
        if (entry.packageName) {
          const count = packageCounts.get(entry.packageName) ?? 0;
          if (count === 0) {
            packagesChanged = true;
          }
          packageCounts.set(entry.packageName, count + 1);
        }
      }
    },
    remove(entries) {
      for (const entry of entries) {
        levels[entry.level] -= 1;
        if (entry.packageName) {
          const count = (packageCounts.get(entry.packageName) ?? 0) - 1;
          if (count <= 0) {
            packageCounts.delete(entry.packageName);
            packagesChanged = true;
          } else {
            packageCounts.set(entry.packageName, count);
          }
        }
      }
    },
    reset() {
      levels = emptyLevels();
      packagesChanged = packageCounts.size > 0;
      packageCounts.clear();
    },
    levels() {
      return { ...levels };
    },
    packages() {
      return [...packageCounts.keys()].sort((a, b) => a.localeCompare(b));
    },
    takePackagesChanged() {
      const changed = packagesChanged;
      packagesChanged = false;
      return changed;
    },
  };
}
