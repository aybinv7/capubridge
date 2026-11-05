/** How a request is named in a row: the part that tells it apart, then where it went, quietly. */
export interface RequestNameParts {
  main: string;
  detail: string;
}

/** What a request is called: the path and query, the media type for `data:` URLs. */
export function requestName(url: string): string {
  if (url.startsWith("data:")) {
    const end = url.search(/[;,]/);
    return end > 0 ? url.slice(0, end) : "data:";
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "blob:") return url;
    return `${parsed.pathname}${parsed.search}` || "/";
  } catch {
    return url;
  }
}

/** The host a request went to, or an empty string when the URL has none. */
export function requestHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/**
 * The last path segment and query as the main text ("orders?page=2"), and the host and the path
 * before it as the quiet detail ("api.shop.test/v1/"). A site root reads as its host; a
 * CapacitorHttp call is named by the address it carries.
 */
export function requestNameParts(url: string): RequestNameParts {
  if (url.startsWith("data:") || url.startsWith("blob:")) {
    return { main: requestName(url), detail: "" };
  }
  try {
    const parsed = new URL(url);
    const proxied = parsed.pathname.includes("_capacitor_http_interceptor_")
      ? parsed.searchParams.get("u")
      : null;
    if (proxied && proxied !== url) return requestNameParts(proxied);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const trailing = parsed.pathname.endsWith("/") && segments.length > 0 ? "/" : "";
    const last = segments.pop();
    const folder = segments.length ? `/${segments.join("/")}/` : "/";
    if (last === undefined) {
      return parsed.search
        ? { main: `/${parsed.search}`, detail: parsed.host }
        : { main: parsed.host || url, detail: "" };
    }
    return { main: `${last}${trailing}${parsed.search}`, detail: `${parsed.host}${folder}` };
  } catch {
    return { main: url, detail: "" };
  }
}
