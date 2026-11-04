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
