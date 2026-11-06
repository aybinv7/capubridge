/** JSON found inside a log message, with the text around it. */
export interface JsonInText {
  before: string;
  value: unknown;
  pretty: string;
  after: string;
}

const MAX_SCAN = 256 * 1024;
const MAX_ATTEMPTS = 16;

function closingIndex(text: string, start: number): number {
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (char === "\\") index += 1;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === open) depth += 1;
    else if (char === close) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function tryAt(text: string, start: number): JsonInText | null {
  const end = closingIndex(text, start);
  if (end < 0) return null;
  const slice = text.slice(start, end + 1);
  try {
    const value: unknown = JSON.parse(slice);
    if (typeof value !== "object" || value === null) return null;
    return {
      before: text.slice(0, start),
      value,
      pretty: JSON.stringify(value, null, 2),
      after: text.slice(end + 1),
    };
  } catch {
    return null;
  }
}

/**
 * The first JSON object or array in `text` (`payload={"a":1}`, a logged response), or null.
 * Meant for an expanded row, not for every line: it parses on demand.
 */
export function findJson(text: string): JsonInText | null {
  if (text.length > MAX_SCAN) return null;
  let attempts = 0;
  for (let index = 0; index < text.length && attempts < MAX_ATTEMPTS; index += 1) {
    const char = text[index];
    if (char !== "{" && char !== "[") continue;
    attempts += 1;
    const found = tryAt(text, index);
    if (found) return found;
  }
  return null;
}
