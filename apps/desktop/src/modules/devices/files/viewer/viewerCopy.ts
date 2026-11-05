import { formatSize } from "../fileKinds";
import { formatBudget } from "./readPlan";
import type { ViewerKind } from "./viewerKinds";

const MISSING = "File not found or is a directory";

/** The plain sentence above a raw read error. */
export function readErrorSentence(message: string): string {
  if (message.includes(MISSING)) return "The file is no longer on the phone, or it is a folder.";
  return "The file could not be read from the phone.";
}

const LIMIT_SUBJECT: Partial<Record<ViewerKind, string>> = {
  image: "Pictures",
  video: "Videos",
  audio: "Recordings",
};

/** Why a file was not read: the budget for its kind, and its own size when known. */
export function tooLargeDetail(kind: ViewerKind, cap: number, size: number | null): string {
  const subject = LIMIT_SUBJECT[kind] ?? "Files";
  const own = size === null ? "This one is larger." : `This one is ${formatSize(size)}.`;
  return `${subject} up to ${formatBudget(cap)} open here. ${own}`;
}

/** The heading of the binary view, naming the extension the way the old dialog did. */
export function noPreviewTitle(name: string, extension: string): string {
  return extension && extension !== name.toLowerCase()
    ? `No preview for .${extension} files`
    : "No preview for this file";
}

export type ViewerKeyAction = "prev" | "next" | "find" | null;

/**
 * What a key press in the viewer asks for. Arrows step between files unless focus is in a field
 * or a media player (where arrows seek); Ctrl/Cmd+F opens find.
 */
export function viewerKeyAction(
  event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">,
  focusOwnsArrows: boolean,
): ViewerKeyAction {
  if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "f") {
    return "find";
  }
  if (focusOwnsArrows || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
    return null;
  }
  if (event.key === "ArrowLeft") return "prev";
  if (event.key === "ArrowRight") return "next";
  return null;
}
