import {
  READ_CAPS,
  capFor,
  exceedsCap,
  isKnownSize,
  planRead,
  truncationFor,
  type Truncation,
} from "./readPlan";
import { looksLikeText, sniffBytes, sniffedImageMime } from "./sniff";
import { parseSqliteHeader } from "./sqliteHeader";
import { decodeText, parseJson } from "@/shared/code-viewer/textLines";
import type { FileBytes, LoadOutcome, ReadBytes, ViewerContent } from "./viewerContent";
import { kindFromName, languageFromName, mimeFromName, type NameKind } from "./viewerKinds";

type BuildKind = Exclude<NameKind, "unknown" | "sqlite">;

function knownOr(size: number, fallback: number | null): number | null {
  return isKnownSize(size) ? size : fallback;
}

function ready(content: ViewerContent): LoadOutcome {
  return { status: "ready", content };
}

function tooLarge(kind: NameKind, size: number): LoadOutcome {
  return {
    status: "too-large",
    kind: kind === "unknown" ? "binary" : kind,
    cap: capFor(kind),
    size: knownOr(size, null),
  };
}

function binary(bytes: FileBytes, size: number, truncation: Truncation | null): LoadOutcome {
  const head = bytes.slice(0, READ_CAPS.probe);
  const cut = truncation !== null || head.length < bytes.length;
  return ready({
    kind: "binary",
    head,
    truncation: cut ? { shown: head.length, total: knownOr(size, null) } : null,
    size: knownOr(size, cut ? null : bytes.length),
  });
}

function textual(kind: "json" | "text", name: string, size: number, bytes: FileBytes): LoadOutcome {
  const truncation = truncationFor(kind, size, bytes.length);
  const visible = truncation ? bytes.subarray(0, READ_CAPS.text) : bytes;
  if (!looksLikeText(visible)) return binary(bytes, size, truncation);
  const text = decodeText(visible, truncation !== null);
  const total = knownOr(size, truncation ? null : bytes.length);
  if (kind === "text") {
    return ready({ kind, text, language: languageFromName(name), truncation, size: total });
  }
  const parse = truncation ? null : parseJson(text);
  const pretty = parse?.ok ? JSON.stringify(parse.value, null, 2) : text;
  return ready({ kind, text, pretty, parse, truncation, size: total });
}

function build(
  kind: BuildKind,
  name: string,
  size: number,
  bytes: FileBytes,
  mime = "",
): LoadOutcome {
  if (kind === "json" || kind === "text") return textual(kind, name, size, bytes);
  if (kind === "binary") return binary(bytes, size, truncationFor(kind, size, bytes.length));
  if (exceedsCap(kind, size, bytes.length)) return tooLarge(kind, size);
  return ready({
    kind,
    blob: new Blob([bytes], { type: mime || mimeFromName(name) }),
    head: bytes.slice(0, READ_CAPS.probe),
    size: knownOr(size, bytes.length),
  });
}

async function upgrade(
  probeKind: NameKind,
  target: "image" | "text",
  name: string,
  size: number,
  probe: FileBytes,
  read: ReadBytes,
  mime = "",
): Promise<LoadOutcome> {
  if (!exceedsCap(probeKind, size, probe.length)) return build(target, name, size, probe, mime);
  const plan = planRead(target, size);
  if (plan.mode === "too-large") return tooLarge(target, size);
  return build(target, name, size, await read(plan.maxBytes), mime);
}

async function fromProbe(
  kind: NameKind,
  name: string,
  size: number,
  probe: FileBytes,
  read: ReadBytes,
): Promise<LoadOutcome> {
  const format = sniffBytes(probe);
  if (format === "sqlite") {
    return ready({
      kind: "sqlite",
      header: parseSqliteHeader(probe, knownOr(size, 0) ?? 0),
      head: probe.slice(0, READ_CAPS.probe),
      size: knownOr(size, exceedsCap(kind, size, probe.length) ? null : probe.length),
    });
  }
  if (kind !== "sqlite") {
    const mime = sniffedImageMime(format);
    if (mime) return upgrade(kind, "image", name, size, probe, read, mime);
    if (format === "text" && kind === "unknown") {
      return upgrade(kind, "text", name, size, probe, read);
    }
  }
  return binary(probe, size, truncationFor(kind, size, probe.length));
}

/**
 * Reads a file the way its kind needs and turns the bytes into what the viewer shows. Media is
 * read whole or refused over its cap; text is cut at 2 MB; anything else is probed from its first
 * kilobyte and, when the bytes reveal an image or text, read again with that kind's budget.
 */
export async function loadViewerContent(
  name: string,
  size: number,
  read: ReadBytes,
): Promise<LoadOutcome> {
  const kind = kindFromName(name);
  const plan = planRead(kind, size);
  if (plan.mode === "too-large") return tooLarge(kind, size);
  const bytes = await read(plan.maxBytes);
  if (kind === "unknown" || kind === "binary" || kind === "sqlite") {
    return fromProbe(kind, name, size, bytes, read);
  }
  return build(kind, name, size, bytes);
}
