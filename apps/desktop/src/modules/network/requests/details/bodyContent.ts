import { base64ByteLength, base64ToBytes, base64ToUtf8 } from "@/lib/base64";
import type { TextLanguage } from "@/shared/code-viewer/codeLanguage";
import { parseJson, type JsonParse } from "@/shared/code-viewer/textLines";

/** A body as CDP returns it from `Network.getResponseBody`. */
export interface RawBody {
  body: string;
  base64Encoded: boolean;
}

export type BodyContent =
  | { kind: "empty" }
  | { kind: "json"; text: string; pretty: string; parse: JsonParse }
  | { kind: "text"; text: string; language: TextLanguage }
  | { kind: "image"; blob: Blob; base64: string; mime: string }
  | { kind: "svg"; text: string; blob: Blob }
  | { kind: "binary"; bytes: number; mime: string; base64: string };

const TEXT_MIME =
  /^(text\/|application\/(json|.*\+json|javascript|ecmascript|xml|.*\+xml|x-www-form-urlencoded|graphql))/i;

/** The bare media type of a MIME or `Content-Type` value, lower case. */
export function mediaType(mime: string): string {
  return mime.split(";")[0]?.trim().toLowerCase() ?? "";
}

/** Whether bytes of this type read as text. */
export function isTextMime(mime: string): boolean {
  return TEXT_MIME.test(mediaType(mime)) || mediaType(mime) === "image/svg+xml";
}

/** The code viewer language for a media type. */
export function languageForMime(mime: string): TextLanguage {
  const type = mediaType(mime);
  if (type.includes("json")) return "json";
  if (type.includes("javascript") || type.includes("ecmascript")) return "javascript";
  if (type === "text/css") return "css";
  if (type === "text/html") return "html";
  if (type.includes("xml") || type === "image/svg+xml") return "xml";
  return "plain";
}

function textContent(text: string, mime: string): BodyContent {
  if (!text) return { kind: "empty" };
  if (mediaType(mime) === "image/svg+xml") {
    return { kind: "svg", text, blob: new Blob([text], { type: "image/svg+xml" }) };
  }
  const language = languageForMime(mime);
  const trimmed = text.trimStart();
  const looksJson = trimmed.startsWith("{") || trimmed.startsWith("[");
  if (language === "json" || (language === "plain" && looksJson)) {
    const parse = parseJson(text);
    if (parse.ok)
      return { kind: "json", text, pretty: JSON.stringify(parse.value, null, 2), parse };
    if (language === "json") return { kind: "json", text, pretty: text, parse };
  }
  return { kind: "text", text, language };
}

/** How to show a response body: JSON, text, a picture, or bytes that only download makes sense of. */
export function responseContent(raw: RawBody, mime: string): BodyContent {
  if (!raw.body) return { kind: "empty" };
  if (!raw.base64Encoded) return textContent(raw.body, mime);
  const type = mediaType(mime);
  if (type.startsWith("image/") && type !== "image/svg+xml") {
    return {
      kind: "image",
      blob: new Blob([base64ToBytes(raw.body)], { type }),
      base64: raw.body,
      mime: type,
    };
  }
  const binary: BodyContent = {
    kind: "binary",
    bytes: base64ByteLength(raw.body),
    mime: type || "unknown",
    base64: raw.body,
  };
  if (!isTextMime(mime)) return binary;
  try {
    return textContent(base64ToUtf8(raw.body), mime);
  } catch {
    return binary;
  }
}

/** Form fields as `name: value` lines, or null when the text is not a URL-encoded form. */
export function formFields(text: string): string | null {
  if (!text.includes("=") || /\s/.test(text.trim())) return null;
  const pairs = [...new URLSearchParams(text).entries()];
  return pairs.length > 0 ? pairs.map(([name, value]) => `${name}: ${value}`).join("\n") : null;
}

/** Base64 cut into 76-character lines (as in MIME), so no single line is megabytes long. */
export function base64Lines(value: string): string {
  const lines: string[] = [];
  for (let index = 0; index < value.length; index += 76) lines.push(value.slice(index, index + 76));
  return lines.join("\n");
}

/** How to show a request body: JSON, form fields, or its text. */
export function payloadContent(text: string, contentType: string): BodyContent {
  if (!text) return { kind: "empty" };
  const content = textContent(text, mediaType(contentType) === "image/svg+xml" ? "" : contentType);
  if (content.kind !== "text") return content;
  const form =
    mediaType(contentType) === "application/x-www-form-urlencoded" || content.language === "plain"
      ? formFields(text)
      : null;
  return form ? { kind: "text", text: form, language: "plain" } : content;
}

/** The decoded text of a response, for mocks and copies; null when it is not text. */
export function responseText(raw: RawBody, mime: string): string | null {
  if (!raw.base64Encoded) return raw.body;
  if (!isTextMime(mime)) return null;
  try {
    return base64ToUtf8(raw.body);
  } catch {
    return null;
  }
}
