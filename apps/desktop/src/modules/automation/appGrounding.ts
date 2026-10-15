/**
 * Grounds a free-text app reference (from a Jev text_span) to an installed
 * package name. Dotted input passes through untouched; bare names match
 * against the live third-party package list with a token fallback.
 */
export function groundAppPackage(text: string, installed: string[] = []): string | null {
  const trimmed = text.trim();
  const raw = trimmed.toLowerCase();
  if (raw === "") {
    return null;
  }
  if (raw.includes(".")) {
    return trimmed;
  }
  const stopWords = new Set(["a", "an", "app", "application", "launch", "open", "start", "the"]);
  const words = raw.split(/[^a-z0-9]+/).filter((word) => word !== "" && !stopWords.has(word));
  const queries = [...new Set([raw, words.join(" "), ...words].filter((query) => query !== ""))];
  const lowered = installed.map((pkg) => ({ original: pkg, lower: pkg.toLowerCase() }));
  const byShortest = (left: { original: string }, right: { original: string }): number =>
    left.original.length - right.original.length;
  for (const query of queries.sort((left, right) => right.length - left.length)) {
    const exact = lowered.find((entry) => entry.lower === query);
    if (exact !== undefined) {
      return exact.original;
    }
    const token = query.replace(/[^a-z0-9]+/g, "");
    if (token.length < 3) {
      continue;
    }
    const tokenHits = lowered
      .filter((entry) => entry.lower.replace(/[^a-z0-9]+/g, "").includes(token))
      .sort(byShortest);
    if (tokenHits.length > 0) {
      return tokenHits[0]?.original ?? null;
    }
    const subHits = lowered.filter((entry) => entry.lower.includes(query)).sort(byShortest);
    if (subHits.length > 0) {
      return subHits[0]?.original ?? null;
    }
  }
  return null;
}
