/** Above these the JSON editor (one DOM row per line, highlighted) is too slow to type in. */
export const EDITOR_MAX_CHARS = 200_000;
export const EDITOR_MAX_LINES = 2_000;

/** Whether a body is too large for the rich editor; stops counting lines at the limit. */
export function exceedsEditorLimit(text: string): boolean {
  if (text.length > EDITOR_MAX_CHARS) return true;
  let lines = 1;
  let index = text.indexOf("\n");
  while (index !== -1) {
    lines += 1;
    if (lines > EDITOR_MAX_LINES) return true;
    index = text.indexOf("\n", index + 1);
  }
  return false;
}
