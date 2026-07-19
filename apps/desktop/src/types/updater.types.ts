/** Lifecycle of the in-app updater, surfaced in the Updates settings panel. */
export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "up-to-date"
  | "error";

/** Metadata for an available update, returned by the `updater_check` command. */
export interface UpdateInfo {
  version: string;
  currentVersion: string;
  notes: string | null;
  pubDate: string | null;
}

/** Payload of the `updater://progress` event emitted while downloading. */
export interface UpdaterProgressPayload {
  chunkLength: number;
  contentLength: number | null;
}
