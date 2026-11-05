/**
 * UTF-8 text from bytes without a byte-order mark. A cut read decodes in stream mode, so a
 * character split by the cut is dropped instead of showing as a replacement mark.
 */
export function decodeText(bytes: Uint8Array, cut: boolean): string {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes, { stream: cut });
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Lines without their terminators; a final newline does not add an empty last line. */
export function splitLines(text: string): string[] {
  if (text === "") return [""];
  const lines = text.split(/\r\n|\n|\r/);
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** The longest line in characters, used to size the scroll width without measuring. */
export function longestLine(lines: readonly string[]): number {
  let longest = 0;
  for (const line of lines) if (line.length > longest) longest = line.length;
  return longest;
}

export type JsonParse = { ok: true; value: unknown } | { ok: false; message: string };

/** Parses JSON and keeps the parser's message when it is not valid. */
export function parseJson(text: string): JsonParse {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
