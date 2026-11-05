import type {
  MockInterceptMode,
  MockResponseHeader,
  MockRule,
  MockTargetConfig,
} from "@/types/mock.types";
import { GLOBAL_SCOPE, earlierScopeOfPageId, isPageIdScope } from "./mockScope";

/** The localStorage keys rules lived under before they moved to IndexedDB. */
export const LEGACY_KEYS = {
  configs: "capubridge:mock-target-configs",
  rules: "capubridge:mock-rules",
  mode: "capubridge:mock-mode",
  migrated: "capubridge:mock-target-configs-migrated",
} as const;

const MODES: readonly MockInterceptMode[] = ["off", "cdp", "http"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function number(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function headers(value: unknown): MockResponseHeader[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((header) => ({
    id: text(header.id) || crypto.randomUUID(),
    name: text(header.name),
    value: text(header.value),
  }));
}

/** A stored rule read defensively; older fields (the hit count) are dropped. Null when unusable. */
export function sanitizeRule(value: unknown): MockRule | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  const matchType = text(value.urlMatchType, "contains");
  return {
    id: value.id,
    name: text(value.name, "Rule"),
    enabled: value.enabled !== false,
    method: text(value.method, "ANY") as MockRule["method"],
    urlPattern: text(value.urlPattern),
    urlMatchType: (["contains", "glob", "regex", "exact"].includes(matchType)
      ? matchType
      : "contains") as MockRule["urlMatchType"],
    statusCode: number(value.statusCode, 200),
    contentType: text(value.contentType),
    responseHeaders: headers(value.responseHeaders),
    responseBody: text(value.responseBody),
    ...(value.bodyEncoding === "base64" ? { bodyEncoding: "base64" as const } : {}),
    delayMs: number(value.delayMs, 0),
    passThrough: value.passThrough === true,
    createdAt: number(value.createdAt, Date.now()),
  };
}

function rulesOf(value: unknown): MockRule[] {
  return Array.isArray(value)
    ? value.map(sanitizeRule).filter((rule): rule is MockRule => rule !== null)
    : [];
}

function modeOf(value: unknown): MockInterceptMode {
  return MODES.includes(value as MockInterceptMode) ? (value as MockInterceptMode) : "off";
}

function parse(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function addRules(
  into: Record<string, MockTargetConfig>,
  scope: string,
  rules: readonly MockRule[],
  mode: MockInterceptMode,
) {
  const current = into[scope];
  const known = new Set(current?.rules.map((rule) => rule.id));
  into[scope] = {
    rules: [...(current?.rules ?? []), ...rules.filter((rule) => !known.has(rule.id))],
    interceptMode: current?.interceptMode ?? mode,
  };
}

/**
 * Reads every rule kept in localStorage and files it under today's scopes. Rules saved under a
 * page's DevTools id (which changes whenever the app restarts) wait in an "earlier" bucket per
 * device until that device's app is opened; interception starts off for them. Nothing is lost:
 * unreadable rules are skipped one by one, not as a whole.
 */
export function migrateLegacyRules(
  read: (key: string) => string | null,
): Record<string, MockTargetConfig> {
  const configs: Record<string, MockTargetConfig> = {};
  const stored = parse(read(LEGACY_KEYS.configs));
  if (isRecord(stored)) {
    for (const [scope, value] of Object.entries(stored)) {
      if (!isRecord(value)) continue;
      const rules = rulesOf(value.rules);
      if (isPageIdScope(scope)) {
        if (rules.length) addRules(configs, earlierScopeOfPageId(scope), rules, "off");
      } else {
        addRules(configs, scope, rules, modeOf(value.interceptMode));
      }
    }
  }
  const oldest = rulesOf(parse(read(LEGACY_KEYS.rules)));
  if (oldest.length && read(LEGACY_KEYS.migrated) !== "true") {
    addRules(configs, GLOBAL_SCOPE, oldest, "off");
  }
  return configs;
}
