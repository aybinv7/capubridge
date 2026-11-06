import { ref } from "vue";
import { toast } from "@/lib/toast";
import type { MockTargetConfig } from "@/types/mock.types";
import { LEGACY_KEYS, migrateLegacyRules } from "./mockMigration";
import { indexedDbMockPersistence, type MockRulesPersistence } from "./mockRulesDb";

export const MOCK_SAVE_DEBOUNCE_MS = 400;

let createPersistence: () => MockRulesPersistence = indexedDbMockPersistence;

/** Swaps where rules are kept (tests use memory); affects stores created afterwards. */
export function setMockPersistenceFactory(factory: () => MockRulesPersistence) {
  createPersistence = factory;
}

interface ConfigsAccess {
  read: () => Record<string, MockTargetConfig>;
  write: (next: Record<string, MockTargetConfig>) => void;
}

function readLegacy(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function dropLegacy() {
  try {
    for (const key of Object.values(LEGACY_KEYS)) localStorage.removeItem(key);
  } catch (error) {
    console.warn("Could not remove the old mock rules from localStorage", error);
  }
}

function message(error: unknown): string {
  if (error instanceof DOMException && error.name === "QuotaExceededError") {
    return "The disk space Capubridge may use for rules is full. Delete large rules or bodies.";
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * Loads rules once (moving them out of localStorage on the first run), then writes only the scopes
 * that changed, a moment after the last change. A failed write is said once in a toast and kept
 * in `error` until a later write succeeds.
 */
export function useMockPersistence(configs: ConfigsAccess) {
  const backend = createPersistence();
  const error = ref<string | null>(null);
  const dirty = new Set<string>();
  const pendingAdoptions: Array<[string, string]> = [];
  let hydrated = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let writing: Promise<void> = Promise.resolve();

  async function hydrate() {
    let stored = await backend.load();
    let migrated = false;
    if (stored === null) {
      stored = migrateLegacyRules(readLegacy);
      migrated = true;
    }
    const local = configs.read();
    const merged = { ...stored };
    for (const scope of dirty) {
      const config = local[scope];
      if (!config) continue;
      const known = new Set(config.rules.map((rule) => rule.id));
      merged[scope] = {
        ...config,
        rules: [...config.rules, ...(stored[scope]?.rules ?? []).filter((r) => !known.has(r.id))],
      };
    }
    configs.write(merged);
    hydrated = true;
    if (migrated) {
      for (const scope of Object.keys(merged)) dirty.add(scope);
      await flush();
      if (error.value === null) dropLegacy();
    }
    for (const [earlier, scope] of pendingAdoptions.splice(0)) adoptEarlier(earlier, scope);
    if (dirty.size) schedule();
  }

  const ready = hydrate().catch((cause: unknown) => {
    hydrated = true;
    error.value = message(cause);
    toast.error("Could not load mock rules", { description: error.value });
  });

  function schedule() {
    if (!hydrated) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, MOCK_SAVE_DEBOUNCE_MS);
  }

  function markDirty(scope: string) {
    dirty.add(scope);
    schedule();
  }

  /** Writes pending changes now. */
  function flush(): Promise<void> {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!hydrated || dirty.size === 0) return writing;
    const current = configs.read();
    const changes = new Map<string, MockTargetConfig | null>();
    for (const scope of dirty) changes.set(scope, current[scope] ?? null);
    dirty.clear();
    writing = writing
      .then(() => backend.save(changes))
      .then(() => {
        error.value = null;
      })
      .catch((cause: unknown) => {
        for (const scope of changes.keys()) dirty.add(scope);
        const first = error.value === null;
        error.value = message(cause);
        if (first) toast.error("Could not save mock rules", { description: error.value });
      });
    return writing;
  }

  /** Moves rules waiting in an earlier bucket to the scope now open, once. */
  function adoptEarlier(earlier: string, scope: string) {
    if (!hydrated) {
      pendingAdoptions.push([earlier, scope]);
      return;
    }
    const current = configs.read();
    const waiting = current[earlier];
    if (!waiting?.rules.length || earlier === scope) return;
    const own = current[scope];
    const known = new Set(own?.rules.map((rule) => rule.id));
    const moved = waiting.rules.filter((rule) => !known.has(rule.id));
    const next = { ...current };
    delete next[earlier];
    next[scope] = {
      rules: [...(own?.rules ?? []), ...moved],
      interceptMode: own?.interceptMode ?? "off",
    };
    configs.write(next);
    markDirty(earlier);
    markDirty(scope);
    if (moved.length) {
      toast("Earlier mock rules moved here", {
        description: `${moved.length} ${moved.length === 1 ? "rule" : "rules"} saved for this phone before rules were kept per app now belong to this app.`,
      });
    }
  }

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => void flush());
  }

  return { ready, error, markDirty, flush, adoptEarlier };
}
