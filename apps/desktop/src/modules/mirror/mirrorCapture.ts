import { invokeCommand } from "@/runtime/ipc";
import { base64ToBytes } from "./mirrorDecoder";

const THUMBNAIL_EDGE_PX = 160;

export interface CaptureToastContent {
  kind: "screenshot" | "recording";
  title: string;
  detail: string;
  path?: string | null;
  thumbnail?: string | null;
  duration?: string | null;
  partial?: boolean;
}

export interface SavedCapture {
  name: string;
  path: string;
}

export function pngBlobFromBase64(data: string): Blob {
  const bytes = base64ToBytes(data);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type: "image/png" });
}

/**
 * Puts a PNG on the system clipboard. The item is created at once with a pending blob, so the
 * write keeps the click's user activation even though the device takes a moment to answer.
 */
export async function copyPngToClipboard(png: Promise<Blob>): Promise<void> {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    throw new Error("This system does not allow images on the clipboard");
  }
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}

async function downloadPath(filename: string): Promise<string> {
  const { downloadDir, join } = await import("@tauri-apps/api/path");
  return join(await downloadDir(), filename);
}

export async function savePngToDownloads(data: string): Promise<SavedCapture> {
  const name = `screenshot_${Date.now()}.png`;
  const path = await downloadPath(name);
  await invokeCommand("save_base64_file", { path, data });
  return { name, path };
}

export async function recordingDestination(): Promise<SavedCapture> {
  const name = `capubridge_rec_${Date.now()}.mp4`;
  return { name, path: await downloadPath(name) };
}

/** A small still of what the stream shows now, for the toast that confirms a saved recording. */
export function streamThumbnail(canvas: HTMLCanvasElement | null): string | null {
  if (!canvas || canvas.width === 0 || canvas.height === 0) return null;
  const scale = Math.min(1, THUMBNAIL_EDGE_PX / Math.max(canvas.width, canvas.height));
  const still = document.createElement("canvas");
  still.width = Math.max(1, Math.round(canvas.width * scale));
  still.height = Math.max(1, Math.round(canvas.height * scale));
  const context = still.getContext("2d");
  if (!context) return null;
  try {
    context.drawImage(canvas, 0, 0, still.width, still.height);
    return still.toDataURL("image/jpeg", 0.75);
  } catch (error) {
    console.warn("Failed to capture a recording thumbnail", error);
    return null;
  }
}
