import { ref } from "vue";
import { defineStore } from "pinia";
import type { TabState, ToolId } from "../types/tabs.types";
import { defaultStateFor } from "../types/tabs.types";

const LS_KEY = "capubridge:tab-state:v1";
const PERSIST_DEBOUNCE_MS = 500;

export const useTabStateStore = defineStore("tabState", () => {
  const states = ref<Record<string, TabState>>({});
  let persistTimer: ReturnType<typeof setTimeout> | null = null;

  function persist() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(states.value));
      } catch {
        // ignore quota
      }
    }, PERSIST_DEBOUNCE_MS);
  }

  function initialize() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, TabState>;
      if (parsed && typeof parsed === "object") {
        states.value = parsed;
      }
    } catch {
      states.value = {};
    }
  }

  function ensure(tabId: string, tool: ToolId): TabState {
    const existing = states.value[tabId];
    if (existing && existing.tool === tool) return existing;
    const fresh = defaultStateFor(tool);
    states.value = { ...states.value, [tabId]: fresh };
    persist();
    return fresh;
  }

  function get(tabId: string): TabState | null {
    return states.value[tabId] ?? null;
  }

  function set(tabId: string, state: TabState) {
    states.value = { ...states.value, [tabId]: state };
    persist();
  }

  function patch<T extends TabState>(tabId: string, patch: Partial<T>) {
    const current = states.value[tabId];
    if (!current) return;
    const merged = { ...current, ...patch } as TabState;
    states.value = { ...states.value, [tabId]: merged };
    persist();
  }

  function dispose(tabId: string) {
    if (!(tabId in states.value)) return;
    const next = { ...states.value };
    delete next[tabId];
    states.value = next;
    persist();
  }

  function pruneTo(tabIds: ReadonlyArray<string>) {
    const keep = new Set(tabIds);
    let changed = false;
    const next: Record<string, TabState> = {};
    for (const id of Object.keys(states.value)) {
      if (keep.has(id)) next[id] = states.value[id];
      else changed = true;
    }
    if (changed) {
      states.value = next;
      persist();
    }
  }

  return {
    states,
    initialize,
    ensure,
    get,
    set,
    patch,
    dispose,
    pruneTo,
  };
});
