/** Saves text through the WebView's download flow (Tauri routes it to the Downloads folder). */
export function downloadText(content: string, filename: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** A filename-safe stem: keeps letters, digits, dot, dash and underscore. */
export function fileStem(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .join("_")
    .replace(/[^\w.-]+/g, "_")
    .slice(0, 120);
}

export interface SaveFilter {
  name: string;
  extensions: string[];
}

function base64Of(bytes: Uint8Array): string {
  const chunk = 32_768;
  let binary = "";
  for (let start = 0; start < bytes.length; start += chunk) {
    binary += String.fromCharCode(...bytes.subarray(start, start + chunk));
  }
  return btoa(binary);
}

/**
 * Asks where to save and writes there (Tauri save dialog). Resolves to the chosen path, or
 * `null` when the person cancelled.
 */
export async function saveFileAs(
  content: string | Uint8Array,
  suggestedName: string,
  filters: readonly SaveFilter[],
): Promise<string | null> {
  const [{ save }, { invokeCommand }] = await Promise.all([
    import("@tauri-apps/plugin-dialog"),
    import("@/runtime/ipc/client"),
  ]);
  const path = await save({ defaultPath: suggestedName, filters: [...filters] });
  if (!path) return null;
  const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
  await invokeCommand("save_base64_file", { path, data: base64Of(bytes) });
  return path;
}
