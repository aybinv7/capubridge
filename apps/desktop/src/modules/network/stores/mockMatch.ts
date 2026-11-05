import type { UrlMatchType } from "@/types/mock.types";

const regexCache = new Map<string, RegExp | null>();

function compiled(pattern: string): RegExp | null {
  let regex = regexCache.get(pattern);
  if (regex === undefined) {
    try {
      regex = new RegExp(pattern, "i");
    } catch {
      regex = null;
    }
    if (regexCache.size > 256) regexCache.clear();
    regexCache.set(pattern, regex);
  }
  return regex;
}

/** Whether a URL matches a rule's pattern; an empty pattern matches every URL. */
export function matchUrl(pattern: string, type: UrlMatchType, url: string): boolean {
  if (!pattern) return true;
  switch (type) {
    case "contains":
      return url.includes(pattern);
    case "exact":
      return url === pattern;
    case "glob":
      return globMatch(pattern, url);
    case "regex":
      return compiled(pattern)?.test(url) ?? false;
  }
}

/** Case-insensitive wildcard match: `*` any run of characters, `?` one character. */
export function globMatch(pattern: string, text: string): boolean {
  const p = pattern.toLowerCase();
  const t = text.toLowerCase();
  let pi = 0;
  let ti = 0;
  let starPi = -1;
  let starTi = 0;

  while (ti < t.length) {
    if (pi < p.length && (p[pi] === "?" || p[pi] === t[ti])) {
      pi++;
      ti++;
    } else if (pi < p.length && p[pi] === "*") {
      starPi = pi;
      starTi = ti;
      pi++;
    } else if (starPi !== -1) {
      pi = starPi + 1;
      starTi++;
      ti = starTi;
    } else {
      return false;
    }
  }

  while (pi < p.length && p[pi] === "*") pi++;
  return pi === p.length;
}
