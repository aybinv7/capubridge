import type { KvEntry, KvSourceKind } from "./kvModel";

/** How the value is edited: plain text, or JSON checked before it is saved. */
export type KvEditorMode = "text" | "json";

/**
 * The editor a value opens in. Local and Session storage hold text, so JSON objects and
 * lists open as JSON (checked, still saved as typed); everything else as text. LocalForage
 * strings open as text, every other value as JSON.
 */
export function initialMode(kind: KvSourceKind, entry: KvEntry | null): KvEditorMode {
  if (!entry) return "text";
  if (kind !== "forage") return entry.type === "object" || entry.type === "array" ? "json" : "text";
  return typeof entry.value === "string" ? "text" : "json";
}

/**
 * The text the editor starts from. Local and Session storage values start exactly as stored
 * (nothing is reformatted, so opening a value never makes it look changed).
 */
export function initialDraft(
  kind: KvSourceKind,
  entry: KvEntry | null,
  mode: KvEditorMode,
): string {
  if (!entry) return "";
  if (kind !== "forage") return entry.stored;
  if (mode === "text" && typeof entry.value === "string") return entry.value;
  return JSON.stringify(entry.value, null, 2) ?? "";
}

/** Why the draft cannot be saved in this mode, or `null`. */
export function draftProblem(draft: string, mode: KvEditorMode): string | null {
  if (mode !== "json") return null;
  if (draft.trim() === "") return "Type a JSON value, or switch to Text.";
  try {
    JSON.parse(draft);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * The value sent to the phone. Local and Session storage get the draft text exactly as typed;
 * LocalForage gets the text itself, or the parsed JSON value.
 */
export function valueToWrite(kind: KvSourceKind, mode: KvEditorMode, draft: string): unknown {
  if (kind !== "forage" || mode === "text") return draft;
  return JSON.parse(draft) as unknown;
}

/** The draft as indented JSON, or `null` when it is not valid JSON. */
export function formatJson(draft: string): string | null {
  try {
    return JSON.stringify(JSON.parse(draft), null, 2) ?? null;
  } catch {
    return null;
  }
}

/**
 * The draft carried over to the other mode. Local and Session storage keep the text as it is.
 * LocalForage text becomes a JSON string (or the JSON it already holds), a JSON string becomes
 * its text.
 */
export function switchDraft(kind: KvSourceKind, to: KvEditorMode, draft: string): string {
  if (kind !== "forage") return draft;
  if (to === "json") return formatJson(draft) === null ? JSON.stringify(draft) : draft;
  try {
    const parsed: unknown = JSON.parse(draft);
    return typeof parsed === "string" ? parsed : draft;
  } catch {
    return draft;
  }
}

/** One plain sentence on what Save does with the draft in this mode. */
export function modeNote(kind: KvSourceKind, mode: KvEditorMode): string {
  if (kind === "forage") {
    return mode === "text"
      ? "Saved as text."
      : "Saved as the JSON value it holds (object, list, number, true/false or null).";
  }
  return mode === "json"
    ? "Checked as JSON, then saved exactly as typed."
    : "Saved exactly as typed.";
}

/** A key the pane can save under, or why not. */
export function keyProblem(key: string): string | null {
  return key === "" ? "A key needs at least one character." : null;
}
