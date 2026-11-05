import type { AppBatteryStats } from "@/types/app-inspector.types";

function durationMs(text: string): number {
  let ms = 0;
  const minutes = text.match(/(\d+)m(?!s)/);
  const seconds = text.match(/(\d+)s/);
  const millis = text.match(/(\d+)ms/);
  if (minutes) ms += parseInt(minutes[1] ?? "0", 10) * 60_000;
  if (seconds) ms += parseInt(seconds[1] ?? "0", 10) * 1000;
  if (millis) ms += parseInt(millis[1] ?? "0", 10);
  return ms;
}

/**
 * Reads `dumpsys batterystats --charged <package>`: processor time in the foreground and the
 * background, and wake lock time, all since the last full charge.
 */
export function parseBatteryStats(output: string): AppBatteryStats {
  const foreground = output.match(/Cpu total:\s+([^+]+)\s+usr/i);
  const background = output.match(/Background Cpu total:\s+([^+]+)\s+usr/i);
  const wake = output.match(/Wake lock.*?realtime:\s+([^\n]+)/i);
  const fgCpuTimeMs = foreground?.[1] ? durationMs(foreground[1]) : 0;
  const bgCpuTimeMs = background?.[1] ? durationMs(background[1]) : 0;
  return {
    fgCpuTimeMs,
    bgCpuTimeMs,
    wakelocksMs: wake?.[1] ? durationMs(wake[1]) : 0,
    hasData: fgCpuTimeMs > 0 || bgCpuTimeMs > 0 || output.trim().length > 0,
    raw: output,
  };
}

/** A duration for people: "0 ms", "850 ms", "4.2 s", "3 min 12 s". */
export function formatDuration(ms: number): string {
  if (ms <= 0) return "0 ms";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return seconds ? `${minutes} min ${seconds} s` : `${minutes} min`;
}
