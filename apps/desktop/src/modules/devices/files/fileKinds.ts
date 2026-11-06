import { Archive, File, FileText, Film, Image, Music, Package } from "lucide-vue-next";
import type { FileEntry } from "@/types/adb.types";
import { isFolderEntry } from "./filePaths";
import { kindFromName, type NameKind } from "@/shared/file-viewer/viewerKinds";
import { formatSize } from "@/shared/format/fileSize";

export function entryExtension(entry: FileEntry) {
  return entry.name.split(".").pop()?.toLowerCase() ?? "";
}

/** What the viewer would open a file as, judged by its name; null for folders. */
export function fileViewerKind(entry: FileEntry): NameKind | null {
  return isFolderEntry(entry) ? null : kindFromName(entry.name);
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

export { formatSize };

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
