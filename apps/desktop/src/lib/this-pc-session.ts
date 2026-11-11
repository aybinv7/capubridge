/** The tabs of This PC as saved between runs: their addresses, the open one, and whether This PC was the context. */
export interface SavedThisPc {
  urls: string[];
  selected: number | null;
  active: boolean;
}

export const EMPTY_THIS_PC: SavedThisPc = { urls: [], selected: null, active: false };

/** Pages on This PC are opened over the network only; anything else saved is ignored. */
function isPageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function isSavedThisPc(value: unknown): value is SavedThisPc {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    Array.isArray(candidate.urls) &&
    candidate.urls.every(isPageUrl) &&
    (candidate.selected === null ||
      (typeof candidate.selected === "number" && Number.isInteger(candidate.selected))) &&
    typeof candidate.active === "boolean"
  );
}

/** The saved tab to open again, if the saved index still points at one. */
export function savedSelection(saved: SavedThisPc): string | null {
  const index = saved.selected;
  return index === null ? null : (saved.urls[index] ?? null);
}
