import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useLocalStorage } from "@vueuse/core";
import type {
  MockRule,
  MockLogEntry,
  MockInterceptMode,
  MockTargetConfig,
  UrlMatchType,
} from "@/types/mock.types";

const MAX_LOG = 500;
const GLOBAL_SCOPE = "global";

function emptyConfig(): MockTargetConfig {
  return { rules: [], interceptMode: "off" };
}

function newRule(overrides: Partial<MockRule> = {}): MockRule {
  return {
    id: crypto.randomUUID(),
    name: "New Rule",
    enabled: true,
    method: "ANY",
    urlPattern: "",
    urlMatchType: "contains",
    statusCode: 200,
    contentType: "application/json",
    responseHeaders: [],
    responseBody: '{\n  "data": []\n}',
    delayMs: 0,
    passThrough: false,
    hitCount: 0,
    createdAt: Date.now(),
    ...overrides,
  };
}

export const useMockStore = defineStore("mock", () => {
  const scopedConfigs = useLocalStorage<Record<string, MockTargetConfig>>(
    "capubridge:mock-target-configs",
    {},
  );
  const legacyRules = useLocalStorage<MockRule[]>("capubridge:mock-rules", []);
  const legacyMode = useLocalStorage<MockInterceptMode>("capubridge:mock-mode", "off");
  const legacyMigrated = useLocalStorage("capubridge:mock-target-configs-migrated", false);
  const currentScope = ref(GLOBAL_SCOPE);
  const httpPort = useLocalStorage<number>("capubridge:mock-http-port", 3001);

  const log = ref<MockLogEntry[]>([]);
  const httpServerRunning = ref(false);

  const currentConfig = computed(() => scopedConfigs.value[currentScope.value] ?? emptyConfig());
  const rules = computed<MockRule[]>({
    get: () => currentConfig.value.rules,
    set: (value) => updateCurrentConfig({ rules: value }),
  });
  const interceptMode = computed<MockInterceptMode>({
    get: () => currentConfig.value.interceptMode,
    set: (value) => updateCurrentConfig({ interceptMode: value }),
  });
  const activeRules = computed(() => rules.value.filter((r) => r.enabled));
  const enabledCount = computed(() => activeRules.value.length);

  function updateCurrentConfig(update: Partial<MockTargetConfig>) {
    scopedConfigs.value = {
      ...scopedConfigs.value,
      [currentScope.value]: {
        ...currentConfig.value,
        ...update,
      },
    };
  }

  function setScope(scope: string) {
    const nextScope = scope || GLOBAL_SCOPE;
    if (
      nextScope !== GLOBAL_SCOPE &&
      !legacyMigrated.value &&
      (legacyRules.value.length > 0 || legacyMode.value !== "off")
    ) {
      scopedConfigs.value = {
        ...scopedConfigs.value,
        [nextScope]: {
          rules: legacyRules.value,
          interceptMode: legacyMode.value,
        },
      };
      legacyRules.value = [];
      legacyMode.value = "off";
      legacyMigrated.value = true;
    }
    currentScope.value = nextScope;
  }

  // Rule actions
  function addRule(overrides: Partial<MockRule> = {}) {
    const rule = newRule(overrides);
    rules.value = [rule, ...rules.value];
    return rule.id;
  }

  function duplicateRule(id: string) {
    const src = rules.value.find((r) => r.id === id);
    if (!src) return null;
    const dup = newRule({
      ...src,
      id: crypto.randomUUID(),
      name: `${src.name} (copy)`,
      hitCount: 0,
      createdAt: Date.now(),
    });
    const idx = rules.value.findIndex((r) => r.id === id);
    rules.value = [...rules.value.slice(0, idx + 1), dup, ...rules.value.slice(idx + 1)];
    return dup.id;
  }

  function updateRule(rule: MockRule) {
    rules.value = rules.value.map((r) => (r.id === rule.id ? rule : r));
  }

  function deleteRule(id: string) {
    rules.value = rules.value.filter((r) => r.id !== id);
  }

  function setRuleEnabled(id: string, enabled: boolean) {
    rules.value = rules.value.map((r) => (r.id === id ? { ...r, enabled } : r));
  }

  function incrementHitCount(id: string) {
    rules.value = rules.value.map((r) => (r.id === id ? { ...r, hitCount: r.hitCount + 1 } : r));
  }

  function clearHitCounts() {
    rules.value = rules.value.map((r) => ({ ...r, hitCount: 0 }));
  }

  // Log actions
  function addLogEntry(entry: MockLogEntry) {
    log.value = [entry, ...log.value.slice(0, MAX_LOG - 1)];
  }

  function clearLog() {
    log.value = [];
  }

  // Matching helper — exported so composable can use it
  function findMatchingRule(method: string, url: string): MockRule | null {
    for (const rule of activeRules.value) {
      if (rule.method !== "ANY" && rule.method.toUpperCase() !== method.toUpperCase()) continue;
      if (!matchUrl(rule.urlPattern, rule.urlMatchType, url)) continue;
      return rule;
    }
    return null;
  }

  return {
    rules,
    interceptMode,
    httpPort,
    currentScope,
    log,
    httpServerRunning,
    activeRules,
    enabledCount,
    setScope,
    addRule,
    duplicateRule,
    updateRule,
    deleteRule,
    setRuleEnabled,
    incrementHitCount,
    clearHitCounts,
    addLogEntry,
    clearLog,
    findMatchingRule,
  };
});

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
      try {
        return new RegExp(pattern, "i").test(url);
      } catch {
        return false;
      }
  }
}

function globMatch(pattern: string, text: string): boolean {
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
