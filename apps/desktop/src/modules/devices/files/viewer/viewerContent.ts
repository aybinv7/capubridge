import type { Truncation } from "./readPlan";
import type { SqliteHeaderFacts } from "./sqliteHeader";
import type { JsonParse } from "@/shared/code-viewer/textLines";
import type { TextLanguage, ViewerKind } from "./viewerKinds";

/** Bytes as the IPC layer hands them over: a view on a plain `ArrayBuffer`. */
export type FileBytes = Uint8Array<ArrayBuffer>;

/** Size is the whole file's size in bytes, or null when the phone did not say. */
interface ContentBase {
  size: number | null;
}

export interface MediaContent extends ContentBase {
  kind: "image" | "video" | "audio";
  blob: Blob;
  head: FileBytes;
}

export interface TextContent extends ContentBase {
  kind: "text";
  text: string;
  language: TextLanguage;
  truncation: Truncation | null;
}

export interface JsonContent extends ContentBase {
  kind: "json";
  text: string;
  pretty: string;
  parse: JsonParse | null;
  truncation: Truncation | null;
}

export interface SqliteContent extends ContentBase {
  kind: "sqlite";
  header: SqliteHeaderFacts | null;
  head: FileBytes;
}

export interface BinaryContent extends ContentBase {
  kind: "binary";
  head: FileBytes;
  truncation: Truncation | null;
}

export type ViewerContent =
  | MediaContent
  | TextContent
  | JsonContent
  | SqliteContent
  | BinaryContent;

export type ViewerState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "too-large"; kind: ViewerKind; cap: number; size: number | null }
  | { status: "ready"; content: ViewerContent };

export type LoadOutcome = Extract<ViewerState, { status: "ready" | "too-large" }>;

/** Reads at most `maxBytes` from the start of the file being opened. */
export type ReadBytes = (maxBytes: number) => Promise<FileBytes>;
