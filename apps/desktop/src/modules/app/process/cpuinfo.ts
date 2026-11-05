import type { AppCpuInfo } from "@/types/app-inspector.types";
import { escapeRegExp } from "./escapeRegExp";

/**
 * Reads the app's line from `dumpsys cpuinfo` ("12% 3456/com.app: 8% user + 4% kernel"). Android
 * lists only processes that used the processor in its recent window, so a missing line means
 * the app was idle and reads as 0 %.
 */
export function parseCpuInfo(output: string, packageName: string): AppCpuInfo {
  const number = String.raw`(\d+\.?\d*)`;
  const pattern = new RegExp(
    String.raw`${number}%\s+\d+/${escapeRegExp(packageName)}(?::[\w.]+)?:\s+${number}%\s+user\s+\+\s+${number}%\s+kernel`,
  );
  const match = output.match(pattern);
  if (!match) return { totalPct: 0, userPct: 0, kernelPct: 0 };
  return {
    totalPct: parseFloat(match[1] ?? "0"),
    userPct: parseFloat(match[2] ?? "0"),
    kernelPct: parseFloat(match[3] ?? "0"),
  };
}
