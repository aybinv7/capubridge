import { defineStore } from "pinia";
import { computed, reactive, ref, shallowRef } from "vue";
import { useLocalStorage } from "@vueuse/core";
import type {
  MockInterceptMode,
  MockLogEntry,
  MockRule,
  MockTargetConfig,
} from "@/types/mock.types";
import { matchUrl } from "./mockMatch";
import { GLOBAL_SCOPE } from "./mockScope";
import { useMockPersistence } from "./useMockPersistence";

export { matchUrl } from "./mockMatch";

const MAX_LOG = 500;

function emptyConfig(): MockTargetConfig {
  return { rules: [], interceptMode: "off" };
}

function newRule(overrides: Partial<MockRule> = {}): MockRule {
  return {
    id: crypto.randomUUID(),
    name: "New rule",
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
    createdAt: Date.now(),
    ...overrides,
  };
}

/**
 * Mock rules and interception mode per app, plus what interception did. Rules persist through
 * `useMockPersistence` (IndexedDB, debounced, only on definition changes); how often a rule answered
 * lives in memory beside them, so a busy rule never rewrites the stored rules.
 */
export const useMockStore = defineStore("mock", () => {
  const configs = shallowRef<Record<string, MockTargetConfig>>({});
  const currentScope = ref(GLOBAL_SCOPE);
  const httpPort = useLocalStorage<number>("capubridge:mock-http-port", 3001);
  const log = shallowRef<MockLogEntry[]>([]);
  const httpServerRunning = ref(false);
  const hits = reactive(new Map<string, number>());
  const scopeListeners = new Set<() => void>();

  const persistence = useMockPersistence({
    read: () => configs.value,
    write: (next) => {
      configs.value = next;
    },
  });

  const currentConfig = computed(() => configs.value[currentScope.value] ?? emptyConfig());
  const rules = computed<readonly MockRule[]>(() => currentConfig.value.rules);
  const interceptMode = computed<MockInterceptMode>({
    get: () => currentConfig.value.interceptMode,
    set: (value) => updateConfig(currentScope.value, { interceptMode: value }),
  });
  const activeRules = computed(() => rules.value.filter((rule) => rule.enabled));
  const enabledCount = computed(() => activeRules.value.length);
  const anyHits = computed(() => rules.value.some((rule) => (hits.get(rule.id) ?? 0) > 0));

  function updateConfig(scope: string, update: Partial<MockTargetConfig>) {
    const current = configs.value[scope] ?? emptyConfig();
    configs.value = { ...configs.value, [scope]: { ...current, ...update } };
    persistence.markDirty(scope);
  }

  function setRules(next: MockRule[], scope = currentScope.value) {
    updateConfig(scope, { rules: next });
  }

  /** Runs before the scope changes, while the old scope is still current (the editor saves here). */
  function onBeforeScopeChange(listener: () => void): () => void {
    scopeListeners.add(listener);
    return () => scopeListeners.delete(listener);
  }

  /**
   * Switches to a target's rules. The first time an app is opened after an upgrade, rules saved
   * under that device's old page-scoped keys move to it.
   */
  function setScope(scope: string, earlierScope: string | null = null) {
    const next = scope || GLOBAL_SCOPE;
    if (next !== currentScope.value) for (const listener of scopeListeners) listener();
    currentScope.value = next;
    if (earlierScope) persistence.adoptEarlier(earlierScope, next);
  }

  function addRule(overrides: Partial<MockRule> = {}) {
    const rule = newRule(overrides);
    setRules([rule, ...rules.value]);
    return rule.id;
  }

  function duplicateRule(id: string) {
    const index = rules.value.findIndex((rule) => rule.id === id);
    const source = rules.value[index];
    if (!source) return null;
    const copy = newRule({
      ...source,
      id: crypto.randomUUID(),
      name: `${source.name} (copy)`,
      createdAt: Date.now(),
    });
    setRules([...rules.value.slice(0, index + 1), copy, ...rules.value.slice(index + 1)]);
    return copy.id;
  }

  function updateRule(rule: MockRule) {
    setRules(rules.value.map((candidate) => (candidate.id === rule.id ? rule : candidate)));
  }

  /** Deletes a rule and says where it was, so Undo can put it back in the same app and place. */
  function deleteRule(id: string): { scope: string; index: number; rule: MockRule } | null {
    const index = rules.value.findIndex((rule) => rule.id === id);
    const rule = rules.value[index];
    if (!rule) return null;
    setRules(rules.value.filter((candidate) => candidate.id !== id));
    hits.delete(id);
    return { scope: currentScope.value, index, rule };
  }

  function restoreRule(removed: { scope: string; index: number; rule: MockRule }) {
    const list = configs.value[removed.scope]?.rules ?? [];
    if (list.some((rule) => rule.id === removed.rule.id)) return;
    setRules(
      [...list.slice(0, removed.index), removed.rule, ...list.slice(removed.index)],
      removed.scope,
    );
  }

  function setRuleEnabled(id: string, enabled: boolean) {
    setRules(rules.value.map((rule) => (rule.id === id ? { ...rule, enabled } : rule)));
  }

  function hitCountOf(id: string): number {
    return hits.get(id) ?? 0;
  }

  function incrementHitCount(id: string) {
    hits.set(id, (hits.get(id) ?? 0) + 1);
  }

  function clearHitCounts() {
    for (const rule of rules.value) hits.delete(rule.id);
  }

  function addLogEntry(entry: MockLogEntry) {
    log.value = [entry, ...log.value.slice(0, MAX_LOG - 1)];
  }

  function clearLog() {
    log.value = [];
  }

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
    anyHits,
    ready: persistence.ready,
    saveError: persistence.error,
    flush: persistence.flush,
    setScope,
    onBeforeScopeChange,
    addRule,
    duplicateRule,
    updateRule,
    deleteRule,
    restoreRule,
    setRuleEnabled,
    hitCountOf,
    incrementHitCount,
    clearHitCounts,
    addLogEntry,
    clearLog,
    findMatchingRule,
  };
});
