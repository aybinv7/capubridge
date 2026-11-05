/** The query parameters of a URL as name/value pairs, in order, repeated names kept. */
export function queryParameters(url: string): Array<[string, string]> {
  try {
    return [...new URL(url).searchParams.entries()];
  } catch {
    return [];
  }
}
