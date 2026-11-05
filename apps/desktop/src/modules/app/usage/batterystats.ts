import type { AppBatteryStats } from "@/types/app-inspector.types";

const UNIT_MS: Record<string, number> = { d: 86_400_000, h: 3_600_000, m: 60_000, s: 1000, ms: 1 };

/** "1d 2h 3m 4s 5ms", "+6m2s504ms" or "850ms" in milliseconds. */
export function durationMs(text: string): number {
  let ms = 0;
  for (const match of text.matchAll(/(\d+)\s*(ms|d|h|m|s)(?![a-z])/g)) {
    ms += parseInt(match[1] ?? "0", 10) * (UNIT_MS[match[2] ?? ""] ?? 0);
  }
  return ms;
}

/**
 * How `batterystats` names a uid: `u0a406` for app 10406 of user 0, `u10a406` for user 10, and
 * the bare number for system uids below 10000.
 */
export function batteryUidTag(user: number, appId: number): string {
  return appId >= 10_000 ? `u${user}a${appId - 10_000}` : String(appId);
}

/**
 * `dumpsys batterystats --charged` keeping only the app's uid block, so the phone sends a few
 * lines instead of the whole report. `packageName` and `tag` must be checked first.
 */
export function batteryStatsCommand(packageName: string, tag: string): string {
  return `dumpsys batterystats --charged ${packageName} | sed -n -E '/^  ${tag}:$/,/^ ?[^ ]/p'`;
}

/** The lines of the uid block, header included, up to the next block or section. */
export function uidBlock(output: string, tag: string): string | null {
  const lines = output.split("\n");
  const start = lines.findIndex((line) => line.trimEnd() === `  ${tag}:`);
  if (start < 0) return null;
  const block = [lines[start] ?? ""];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() && !line.startsWith("    ")) break;
    block.push(line);
  }
  return block.join("\n").trimEnd();
}

function lineValue(block: string, label: string): string | null {
  const match = block.match(new RegExp(`^\\s+${label}:\\s*(.+)$`, "m"));
  return match?.[1] ?? null;
}

function processorTime(block: string): { user: number; system: number } {
  const total = lineValue(block, "Total cpu time");
  const user = total?.match(/u=([^=]+?)\s+s=/)?.[1];
  const system = total?.match(/\ss=(.+)$/)?.[1];
  if (user !== undefined || system !== undefined) {
    return { user: durationMs(user ?? ""), system: durationMs(system ?? "") };
  }
  let userMs = 0;
  let systemMs = 0;
  for (const match of block.matchAll(/CPU:\s+(.+?)\s+usr\s+\+\s+(.+?)\s+krn/g)) {
    userMs += durationMs(match[1] ?? "");
    systemMs += durationMs(match[2] ?? "");
  }
  return { user: userMs, system: systemMs };
}

function wakeTime(block: string): { partial: number; full: number } {
  const total = lineValue(block, "TOTAL wake") ?? "";
  let partial = 0;
  let full = 0;
  for (const match of total.matchAll(/([\ddhms ]+?)\s+(full|partial)\b/g)) {
    if (match[2] === "full") full += durationMs(match[1] ?? "");
    else partial += durationMs(match[1] ?? "");
  }
  return { partial, full };
}

/**
 * Reads the app's uid block of `dumpsys batterystats --charged`: processor time (Android 16
 * prints `Total cpu time: u=… s=…`, older phones a `CPU: … usr + … krn` line per process), time
 * on screen and wake locks, all since the last full charge. Nothing is read outside the block.
 */
export function parseBatteryStats(output: string, tag: string | null): AppBatteryStats {
  const block = tag ? uidBlock(output, tag) : null;
  if (!block) {
    return {
      cpuUserMs: 0,
      cpuSystemMs: 0,
      onScreenMs: 0,
      wakePartialMs: 0,
      wakeFullMs: 0,
      hasData: false,
      raw: "",
    };
  }
  const cpu = processorTime(block);
  const wake = wakeTime(block);
  return {
    cpuUserMs: cpu.user,
    cpuSystemMs: cpu.system,
    onScreenMs: durationMs(lineValue(block, "Top for") ?? ""),
    wakePartialMs: wake.partial,
    wakeFullMs: wake.full,
    hasData: true,
    raw: block,
  };
}

/** A duration for people: "0 ms", "850 ms", "4.2 s", "3 min 12 s", "2 h 5 min", "1 d 3 h". */
export function formatDuration(ms: number): string {
  if (ms <= 0) return "0 ms";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  if (days) return hours ? `${days} d ${hours} h` : `${days} d`;
  if (hours) return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
  return seconds ? `${minutes} min ${seconds} s` : `${minutes} min`;
}
