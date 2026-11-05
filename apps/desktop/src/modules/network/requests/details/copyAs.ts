import type { NetworkEntry } from "@/types/network.types";

const SKIPPED_HEADERS = new Set(["content-length", "host", "connection"]);

function sendableHeaders(entry: NetworkEntry): Array<[string, string]> {
  return Object.entries(entry.requestHeaders).filter(
    ([name]) => !name.startsWith(":") && !SKIPPED_HEADERS.has(name.toLowerCase()),
  );
}

/** Quotes a value for a POSIX shell: single quotes, with embedded ones closed and reopened. */
export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

/** The request as a `curl` command for a POSIX shell, body included when known. */
export function toCurl(entry: NetworkEntry, body: string | null): string {
  const parts = [`curl ${shellQuote(entry.url)}`];
  const method = entry.method.toUpperCase();
  const impliedMethod = body ? "POST" : "GET";
  if (method !== impliedMethod) parts.push(`-X ${method}`);
  for (const [name, value] of sendableHeaders(entry)) {
    parts.push(`-H ${shellQuote(`${name}: ${value}`)}`);
  }
  if (body) parts.push(`--data-raw ${shellQuote(body)}`);
  return parts.join(" \\\n  ");
}

/** The request as a `fetch()` call, body included when known. */
export function toFetch(entry: NetworkEntry, body: string | null): string {
  const init: Record<string, unknown> = { method: entry.method.toUpperCase() };
  const headers = Object.fromEntries(sendableHeaders(entry));
  if (Object.keys(headers).length > 0) init.headers = headers;
  if (body) init.body = body;
  return `fetch(${JSON.stringify(entry.url)}, ${JSON.stringify(init, null, 2)});`;
}
