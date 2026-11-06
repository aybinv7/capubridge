import type { CacheStorageEntryDetail } from "@capubridge/cdp-protocol";
import { languageForMime, responseContent, type BodyContent } from "@/shared/http/bodyContent";
import { formatBytes } from "@/shared/format/numbers";

export interface CacheBodyView {
  content: BodyContent;
  /** Said above the body when only its start was read. */
  notice: string | null;
}

/**
 * How to show a cached body: as Network shows a response. A body cut at the read cap is shown
 * as text (a cut JSON would not parse) with a line saying how much of it is shown.
 */
export function cacheBodyView(detail: CacheStorageEntryDetail): CacheBodyView | null {
  const body = detail.body;
  if (!body) return null;
  const mime = detail.response.headers["content-type"] ?? "";
  const size = detail.response.size;
  const cut = size !== null && body.read < size;
  const content = responseContent({ body: body.body, base64Encoded: body.base64Encoded }, mime);
  const notice = cut
    ? `Showing the first ${formatBytes(body.read)} of ${formatBytes(size)}.`
    : null;
  if (cut && content.kind === "json") {
    return {
      content: { kind: "text", text: content.text, language: languageForMime(mime) },
      notice,
    };
  }
  if (cut && content.kind === "svg") {
    return { content: { kind: "text", text: content.text, language: "xml" }, notice };
  }
  if (cut && content.kind === "image") {
    return {
      content: { kind: "binary", bytes: body.read, mime: content.mime, base64: content.base64 },
      notice,
    };
  }
  return { content, notice };
}
