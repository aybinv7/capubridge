import { escapeRegExp } from "./escapeRegExp";

export type MemoryPartKey =
  | "java"
  | "native"
  | "code"
  | "graphics"
  | "stack"
  | "other"
  | "shared"
  | "swapped";

/** One process's memory from `dumpsys meminfo`, in KB; the parts add up to the total. */
export interface AppMemory {
  pid: number;
  totalPssKb: number;
  parts: Record<MemoryPartKey, number>;
}

const SECTION = /\*\* MEMINFO in pid (\d+) \[[^\]]*\] \*\*/g;

function summaryKb(text: string, label: string): number | null {
  const match = text.match(new RegExp(String.raw`^\s*${escapeRegExp(label)}:\s+(\d+)`, "m"));
  return match ? parseInt(match[1] ?? "0", 10) : null;
}

function rowKb(text: string, label: string): number {
  const match = text.match(new RegExp(String.raw`^\s+${escapeRegExp(label)}\s+(\d+)`, "m"));
  return match ? parseInt(match[1] ?? "0", 10) : 0;
}

/**
 * Reads the "App Summary" block, which adds up to `TOTAL PSS`. Android counts compressed
 * (swapped) pages inside "System" when the total includes them, so they are split out as their
 * own part and the rest of "System" is memory shared with other processes.
 */
function fromSummary(text: string, pid: number): AppMemory | null {
  const total = summaryKb(text, "TOTAL PSS") ?? summaryKb(text, "TOTAL");
  const system = summaryKb(text, "System");
  if (total === null || system === null) return null;
  const swapMatch = /SwapPss/.test(text) ? text.match(/TOTAL SWAP PSS:\s+(\d+)/) : null;
  const swap = swapMatch ? parseInt(swapMatch[1] ?? "0", 10) : 0;
  const swapped = Math.min(swap, system);
  return {
    pid,
    totalPssKb: total,
    parts: {
      java: summaryKb(text, "Java Heap") ?? 0,
      native: summaryKb(text, "Native Heap") ?? 0,
      code: summaryKb(text, "Code") ?? 0,
      graphics: summaryKb(text, "Graphics") ?? 0,
      stack: summaryKb(text, "Stack") ?? 0,
      other: summaryKb(text, "Private Other") ?? 0,
      shared: system - swapped,
      swapped,
    },
  };
}

function fromRows(text: string, pid: number): AppMemory | null {
  const totalMatch = text.match(/^\s+TOTAL\s+(\d+)/m);
  if (!totalMatch) return null;
  const total = parseInt(totalMatch[1] ?? "0", 10);
  let code = 0;
  for (const match of text.matchAll(/^\s+\.(so|jar|apk|dex|oat|art) mmap\s+(\d+)/gm)) {
    code += parseInt(match[2] ?? "0", 10);
  }
  const parts = {
    java: rowKb(text, "Dalvik Heap"),
    native: rowKb(text, "Native Heap"),
    code,
    graphics: rowKb(text, "GL mtrack") || rowKb(text, "EGL mtrack") || rowKb(text, "Gfx dev"),
    stack: rowKb(text, "Stack"),
    other: 0,
    shared: 0,
    swapped: 0,
  };
  const known = parts.java + parts.native + parts.code + parts.graphics + parts.stack;
  parts.other = Math.max(0, total - known);
  return { pid, totalPssKb: total, parts };
}

/**
 * Every process section of `dumpsys meminfo [--local] <package>` (one per Android user running
 * the app), keyed by PID. A stopped app prints no section.
 */
export function parseMemInfo(output: string): Map<number, AppMemory> {
  const sections = new Map<number, AppMemory>();
  const starts = [...output.matchAll(SECTION)];
  starts.forEach((match, index) => {
    const pid = parseInt(match[1] ?? "", 10);
    if (!Number.isFinite(pid)) return;
    const from = match.index ?? 0;
    const to = starts[index + 1]?.index ?? output.length;
    const text = output.slice(from, to);
    const memory = fromSummary(text, pid) ?? fromRows(text, pid);
    if (memory) sections.set(pid, memory);
  });
  return sections;
}

export interface MemorySegment {
  key: MemoryPartKey;
  label: string;
  hint: string;
  kb: number;
  /** Share of the total, 0–100. */
  share: number;
}

const SEGMENTS: ReadonlyArray<{ key: MemoryPartKey; label: string; hint: string }> = [
  { key: "java", label: "Java", hint: "The Android (Dalvik / ART) heap" },
  { key: "native", label: "Native", hint: "C and C++ allocations of the app's process" },
  { key: "graphics", label: "Graphics", hint: "GPU memory: textures and buffers" },
  { key: "code", label: "Code", hint: "Mapped .so, .dex, .apk and .oat files" },
  { key: "stack", label: "Stack", hint: "Thread stacks" },
  { key: "other", label: "Other", hint: "Private memory the parts above do not cover" },
  {
    key: "shared",
    label: "Shared",
    hint: "The app's share of memory it uses together with other processes",
  },
  {
    key: "swapped",
    label: "Swapped",
    hint: "Pages Android compressed into swap to free memory",
  },
];

/** The parts of the app's memory that hold something, in a fixed order, with their share. */
export function memoryComposition(memory: AppMemory | null): MemorySegment[] {
  if (!memory || memory.totalPssKb <= 0) return [];
  const total = memory.totalPssKb;
  return SEGMENTS.map((segment) => {
    const kb = memory.parts[segment.key];
    return { ...segment, kb, share: (kb / total) * 100 };
  }).filter((segment) => segment.kb > 0);
}
