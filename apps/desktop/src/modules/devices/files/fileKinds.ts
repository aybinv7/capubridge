import { Archive, File, FileText, Film, Image, Music, Package } from "lucide-vue-next";
import type { FileEntry } from "@/types/adb.types";
import { isFolderEntry, type DeviceFileListEntry } from "./filePaths";

export type DeviceFileViewerKind = "image" | "video" | "json" | "text";

export interface DeviceFileViewerContent {
  entry: DeviceFileListEntry;
  kind: DeviceFileViewerKind;
  mime: string;
  dataUrl: string;
  text: string;
  jsonValue: unknown;
}

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "ogv", "mov", "m4v", "3gp"]);
const JSON_EXTENSIONS = new Set(["json", "har", "map"]);
const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "log",
  "csv",
  "xml",
  "yaml",
  "yml",
  "ini",
  "conf",
  "properties",
  "html",
  "css",
  "js",
  "ts",
  "tsx",
  "jsx",
  "vue",
  "rs",
  "kt",
  "java",
  "gradle",
  "sh",
]);
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  ogv: "video/ogg",
  mov: "video/quicktime",
  m4v: "video/mp4",
  "3gp": "video/3gpp",
  json: "application/json",
  har: "application/json",
  map: "application/json",
  txt: "text/plain",
  md: "text/markdown",
  log: "text/plain",
  csv: "text/csv",
  xml: "application/xml",
  yaml: "text/yaml",
  yml: "text/yaml",
};

export function entryExtension(entry: FileEntry) {
  return entry.name.split(".").pop()?.toLowerCase() ?? "";
}

export function fileViewerKind(entry: FileEntry): DeviceFileViewerKind | null {
  const ext = entryExtension(entry);
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  if (JSON_EXTENSIONS.has(ext)) return "json";
  if (TEXT_EXTENSIONS.has(ext)) return "text";
  return null;
}

export function fileMimeType(entry: FileEntry, kind: DeviceFileViewerKind) {
  const ext = entryExtension(entry);
  return MIME_BY_EXTENSION[ext] ?? (kind === "text" ? "text/plain" : "application/octet-stream");
}

export function decodeBase64Text(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export function parseJsonViewerValue(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** The icon for a file, by extension; folders draw their own. */
export function fileIcon(entry: FileEntry) {
  if (isFolderEntry(entry)) return null;
  const ext = entryExtension(entry);
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "heic"].includes(ext)) return Image;
  if (["mp4", "mkv", "mov", "avi", "webm", "flv", "3gp"].includes(ext)) return Film;
  if (["mp3", "flac", "wav", "ogg", "m4a", "aac"].includes(ext)) return Music;
  if (ext === "apk") return Package;
  if (["zip", "tar", "gz", "bz2", "xz", "7z", "rar"].includes(ext)) return Archive;
  if (["txt", "md", "pdf", "doc", "docx", "csv", "log", "json", "xml", "yaml", "yml"].includes(ext))
    return FileText;
  return File;
}

export function formatSize(bytes: number, compact = true) {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes === 0) return compact ? "0 B" : "0 bytes";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const digits = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

export function formatSizeLabel(entry: FileEntry) {
  return isFolderEntry(entry) ? "Folder" : formatSize(entry.size, false);
}

/** A plain-words kind for the details pane. */
export function entryKindLabel(entry: FileEntry): string {
  if (entry.entryType === "dir") return "Folder";
  if (entry.entryType === "symlink") return "Link to a folder";
  if (entry.entryType === "other") return "Special file";
  const ext = entryExtension(entry);
  return ext && ext !== entry.name.toLowerCase() ? `${ext.toUpperCase()} file` : "File";
}

export function formatFileEntrySize(entry: FileEntry, zeroLabel = "0 B") {
  if (isFolderEntry(entry)) return "—";
  if (entry.size <= 0) return zeroLabel;
  return formatSize(entry.size, false);
}
