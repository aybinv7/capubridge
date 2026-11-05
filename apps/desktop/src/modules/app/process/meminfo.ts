import type { AppMemInfo } from "@/types/app-inspector.types";
import { escapeRegExp } from "./escapeRegExp";

function extractKb(text: string, label: string): number {
  const match = text.match(new RegExp(String.raw`^\s+${escapeRegExp(label)}\s+(\d+)`, "m"));
  return match ? parseInt(match[1] ?? "0", 10) : 0;
}

/**
 * Reads `dumpsys meminfo <package>`: PID, total PSS and its parts in KB, the thread count, and
 * whether a process exists at all ("No process found" prints no `MEMINFO in pid` line).
 */
export function parseMemInfo(output: string): AppMemInfo {
  const pidMatch = output.match(/MEMINFO in pid (\d+)/);
  const pid = pidMatch ? parseInt(pidMatch[1] ?? "", 10) : null;

  const nativeHeap = extractKb(output, "Native Heap");
  const dalvikHeap = extractKb(output, "Dalvik Heap");
  const stack = extractKb(output, "Stack");
  const graphics =
    extractKb(output, "GL mtrack") ||
    extractKb(output, "EGL mtrack") ||
    extractKb(output, "Gfx dev");

  let code = 0;
  const mmap = /^\s+\.(so|jar|apk|dex|oat|art) mmap\s+(\d+)/gm;
  for (const match of output.matchAll(mmap)) code += parseInt(match[2] ?? "0", 10);

  const totalMatch = output.match(/^\s+TOTAL\s+(\d+)/m);
  const totalPssKb = totalMatch ? parseInt(totalMatch[1] ?? "0", 10) : 0;
  const other = Math.max(0, totalPssKb - (nativeHeap + dalvikHeap + code + stack + graphics));

  const threadsMatch = output.match(/Threads:\s*(\d+)/);
  const threadCount = threadsMatch ? parseInt(threadsMatch[1] ?? "", 10) : null;

  return {
    pid,
    totalPssKb,
    nativeHeapKb: nativeHeap,
    dalvikHeapKb: dalvikHeap,
    codeKb: code,
    stackKb: stack,
    graphicsKb: graphics,
    otherKb: other,
    threadCount,
    isRunning: output.includes("MEMINFO in pid") && pid !== null,
  };
}

export interface MemorySegment {
  key: "native" | "dalvik" | "code" | "graphics" | "stack" | "other";
  label: string;
  hint: string;
  kb: number;
  /** Share of the total, 0–100. */
  share: number;
}

const SEGMENTS: ReadonlyArray<Omit<MemorySegment, "kb" | "share"> & { field: keyof AppMemInfo }> = [
  {
    key: "native",
    label: "Native",
    hint: "C and C++ allocations, including the WebView's renderer",
    field: "nativeHeapKb",
  },
  { key: "dalvik", label: "Java", hint: "The Android (Dalvik / ART) heap", field: "dalvikHeapKb" },
  { key: "code", label: "Code", hint: "Mapped .so, .dex, .apk and .oat files", field: "codeKb" },
  {
    key: "graphics",
    label: "Graphics",
    hint: "GPU memory: textures and buffers",
    field: "graphicsKb",
  },
  { key: "stack", label: "Stack", hint: "Thread stacks", field: "stackKb" },
  {
    key: "other",
    label: "Other",
    hint: "Everything the parts above do not cover",
    field: "otherKb",
  },
];

/** The parts of the app's memory that hold something, in a fixed order, with their share. */
export function memoryComposition(memInfo: AppMemInfo | null): MemorySegment[] {
  if (!memInfo || memInfo.totalPssKb <= 0) return [];
  const total = memInfo.totalPssKb;
  return SEGMENTS.map((segment) => {
    const kb = Number(memInfo[segment.field]) || 0;
    return {
      key: segment.key,
      label: segment.label,
      hint: segment.hint,
      kb,
      share: (kb / total) * 100,
    };
  }).filter((segment) => segment.kb > 0);
}
