const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** CDP timestamps come in ms or s depending on the event; anything odd falls back to now. */
export function normalizeTimestamp(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return Date.now();
  }
  if (value > 100_000_000_000) {
    return value;
  }
  if (value > 100_000_000) {
    return value * 1000;
  }
  return Date.now();
}

/** `HH:MM:SS` with one formatter built once per module, not per entry. */
export function formatTimestamp(timestamp: number): string {
  return timeFormatter.format(timestamp);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function buildSourceLabel(
  url: string | null,
  lineNumber: number | null,
  columnNumber: number | null,
): string {
  if (!url) {
    return "runtime";
  }

  let label = url;
  try {
    const parsed = new URL(url);
    label = parsed.pathname.split("/").filter(Boolean).at(-1) ?? parsed.host ?? url;
  } catch {
    label = url;
  }

  if (lineNumber == null) {
    return label;
  }
  if (columnNumber == null) {
    return `${label}:${lineNumber}`;
  }
  return `${label}:${lineNumber}:${columnNumber}`;
}

export interface FrameSource {
  source: string;
  url: string | null;
  lineNumber: number | null;
  columnNumber: number | null;
}

/** Reads the 1-based source location of a CDP call frame. */
export function readFrameSource(frame: Record<string, unknown> | null | undefined): FrameSource {
  const url = typeof frame?.url === "string" && frame.url ? frame.url : null;
  const lineNumber =
    typeof frame?.lineNumber === "number" && Number.isFinite(frame.lineNumber)
      ? frame.lineNumber + 1
      : null;
  const columnNumber =
    typeof frame?.columnNumber === "number" && Number.isFinite(frame.columnNumber)
      ? frame.columnNumber + 1
      : null;
  return {
    source: buildSourceLabel(url, lineNumber, columnNumber),
    url,
    lineNumber,
    columnNumber,
  };
}
