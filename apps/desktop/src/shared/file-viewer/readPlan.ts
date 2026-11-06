import { formatSize } from "@/shared/format/fileSize";
import type { NameKind } from "./viewerKinds";

const KB = 1024;
const MB = 1024 * KB;

/** How many bytes the viewer reads for each kind before it stops or refuses. */
export const READ_CAPS = {
  image: 20 * MB,
  media: 200 * MB,
  text: 2 * MB,
  probe: KB,
} as const;

export type ReadPlan = { mode: "read"; maxBytes: number } | { mode: "too-large"; cap: number };

export interface Truncation {
  shown: number;
  total: number | null;
}

/** A listing size of zero is not trusted: `/proc` files and search hits report 0. */
export function isKnownSize(size: number): boolean {
  return Number.isFinite(size) && size > 0;
}

/** The byte budget for a kind: media is all-or-nothing, text and probes are cut. */
export function capFor(kind: NameKind): number {
  if (kind === "image") return READ_CAPS.image;
  if (kind === "video" || kind === "audio") return READ_CAPS.media;
  if (kind === "json" || kind === "text") return READ_CAPS.text;
  return READ_CAPS.probe;
}

/** True for kinds that must be read whole to be shown at all. */
export function isWholeFileKind(kind: NameKind): boolean {
  return kind === "image" || kind === "video" || kind === "audio";
}

/**
 * Decides the read before any byte moves. A file of unknown size is read one byte past the cap,
 * so the result itself tells whether more was left on the phone.
 */
export function planRead(kind: NameKind, size: number): ReadPlan {
  const cap = capFor(kind);
  if (!isKnownSize(size)) return { mode: "read", maxBytes: cap + 1 };
  if (isWholeFileKind(kind) && size > cap) return { mode: "too-large", cap };
  return { mode: "read", maxBytes: Math.min(size, cap) };
}

/** Whether a read came back over the cap, meaning the file is larger than the budget. */
export function exceedsCap(kind: NameKind, size: number, readLength: number): boolean {
  const cap = capFor(kind);
  return isKnownSize(size) ? size > cap : readLength > cap;
}

/** What part of the file is on screen, or null when all of it is. */
export function truncationFor(kind: NameKind, size: number, readLength: number): Truncation | null {
  if (!exceedsCap(kind, size, readLength)) return null;
  const cap = capFor(kind);
  return { shown: Math.min(readLength, cap), total: isKnownSize(size) ? size : null };
}

/** A size without a trailing ".0", as people say budgets: "2 MB", "1 KB". */
export function formatBudget(bytes: number): string {
  return formatSize(bytes).replace(/\.0 /, " ");
}

/** "Showing the first 2 MB of 14.3 MB", or "of a larger file" when the size is unknown. */
export function truncationNote(truncation: Truncation): string {
  const total = truncation.total === null ? "a larger file" : formatSize(truncation.total);
  return `Showing the first ${formatBudget(truncation.shown)} of ${total}`;
}
