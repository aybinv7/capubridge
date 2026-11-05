/** Label prefix Capubridge gives the native webviews that preview a page on this PC. */
export const LOCAL_PREVIEW_LABEL_PREFIX = "local-preview-";

/**
 * True when a preview would load Capubridge itself. Its dev server and a preview share an origin,
 * so the copy would share storage and the backend with the real app and fight it for state.
 */
export function isCapubridgeOrigin(url: string, ownOrigin = window.location.origin): boolean {
  try {
    return new URL(url).origin === ownOrigin;
  } catch {
    return false;
  }
}

export function ownPreviewError(url: string): Error {
  return new Error(
    `${url} is Capubridge itself. Previewing it would run a second copy of the app against the same storage and devices. Run the app you want to inspect on another port.`,
  );
}

/** True when this page is running inside one of Capubridge's preview webviews. */
export function runsInsidePreview(): boolean {
  const internals = (window as { __TAURI_INTERNALS__?: { metadata?: unknown } })
    .__TAURI_INTERNALS__;
  const metadata = internals?.metadata as { currentWebview?: { label?: unknown } } | undefined;
  const label = metadata?.currentWebview?.label;
  return typeof label === "string" && label.startsWith(LOCAL_PREVIEW_LABEL_PREFIX);
}
