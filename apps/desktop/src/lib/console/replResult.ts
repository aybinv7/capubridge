import { parseRemoteValue } from "@/lib/console-parse";
import { isRecord } from "@/lib/console/consoleFormat";

const MAX_RESULT = 64 * 1024;

/**
 * The text of a prompt result. Objects and arrays returned by value are written as compact
 * JSON (pretty-printed when the row is opened) instead of a bare "Object".
 */
export function replResultText(result: unknown): string {
  if (isRecord(result) && result.type === "object" && result.subtype !== "null") {
    const value = result.value;
    if (typeof value === "object" && value !== null) {
      try {
        const text = JSON.stringify(value);
        if (text.length <= MAX_RESULT) return text;
      } catch {
        return describe(result);
      }
    }
  }
  return describe(result);
}

function describe(result: unknown): string {
  const parsed = parseRemoteValue(result);
  return parsed.kind === "primitive" ? parsed.text : parsed.description;
}
