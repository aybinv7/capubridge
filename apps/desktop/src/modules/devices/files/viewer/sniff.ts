/** What the first bytes of a file say it is, regardless of its name. */
export type SniffedFormat = "png" | "jpeg" | "gif" | "webp" | "sqlite" | "pdf" | "text" | "binary";

const SQLITE_MAGIC = "SQLite format 3\0";
const TEXT_SAMPLE = 8192;
const CONTROL_RATIO = 0.05;

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function asciiAt(bytes: Uint8Array, offset: number, length: number): string {
  if (bytes.length < offset + length) return "";
  let out = "";
  for (let index = offset; index < offset + length; index += 1) {
    out += String.fromCharCode(bytes[index] ?? 0);
  }
  return out;
}

function isAllowedControl(byte: number): boolean {
  return byte === 9 || byte === 10 || byte === 12 || byte === 13 || byte === 27;
}

/**
 * True when a sample reads as text: no NUL byte, few control characters, and valid UTF-8 up to
 * the end of the sample (a character cut off by the sample end is allowed).
 */
export function looksLikeText(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, TEXT_SAMPLE);
  let controls = 0;
  for (const byte of sample) {
    if (byte === 0) return false;
    if (byte < 32 && !isAllowedControl(byte)) controls += 1;
  }
  if (sample.length > 0 && controls / sample.length > CONTROL_RATIO) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(sample, { stream: true });
    return true;
  } catch {
    return false;
  }
}

/** Reads magic numbers first, then falls back to telling text from binary. */
export function sniffBytes(bytes: Uint8Array): SniffedFormat {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (asciiAt(bytes, 0, 6) === "GIF87a" || asciiAt(bytes, 0, 6) === "GIF89a") return "gif";
  if (asciiAt(bytes, 0, 4) === "RIFF" && asciiAt(bytes, 8, 4) === "WEBP") return "webp";
  if (asciiAt(bytes, 0, SQLITE_MAGIC.length) === SQLITE_MAGIC) return "sqlite";
  if (asciiAt(bytes, 0, 5) === "%PDF-") return "pdf";
  return looksLikeText(bytes) ? "text" : "binary";
}

const IMAGE_MIME: Partial<Record<SniffedFormat, string>> = {
  png: "image/png",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

/** The image MIME type for a sniffed format, or null when it is not an image. */
export function sniffedImageMime(format: SniffedFormat): string | null {
  return IMAGE_MIME[format] ?? null;
}
