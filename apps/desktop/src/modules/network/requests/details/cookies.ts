export interface RequestCookie {
  name: string;
  value: string;
}

export interface ResponseCookie extends RequestCookie {
  attributes: Array<[name: string, value: string | true]>;
}

/** Header lookup that ignores case, as HTTP does. Returns "" when absent. */
export function findHeader(headers: Record<string, string>, name: string): string {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return value;
  }
  return "";
}

/** Splits a `Cookie` request header into name/value pairs. */
export function parseRequestCookies(header: string): RequestCookie[] {
  return header
    .split(";")
    .map((pair) => {
      const trimmed = pair.trim();
      const eq = trimmed.indexOf("=");
      return eq >= 0
        ? { name: trimmed.slice(0, eq).trim(), value: trimmed.slice(eq + 1).trim() }
        : { name: trimmed, value: "" };
    })
    .filter((cookie) => cookie.name !== "");
}

/** Parses `Set-Cookie` lines (CDP joins several with a newline), keeping attribute order. */
export function parseSetCookies(header: string): ResponseCookie[] {
  return header
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [first = "", ...rest] = line.split(";");
      const eq = first.indexOf("=");
      const attributes: ResponseCookie["attributes"] = [];
      for (const part of rest) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const attrEq = trimmed.indexOf("=");
        if (attrEq >= 0)
          attributes.push([trimmed.slice(0, attrEq).trim(), trimmed.slice(attrEq + 1).trim()]);
        else attributes.push([trimmed, true]);
      }
      return {
        name: (eq >= 0 ? first.slice(0, eq) : first).trim(),
        value: eq >= 0 ? first.slice(eq + 1).trim() : "",
        attributes,
      };
    });
}
