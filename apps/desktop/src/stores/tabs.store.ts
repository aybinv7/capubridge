import { computed, ref } from "vue";
import { defineStore } from "pinia";
import type { Tab, TabScope, ToolId } from "../types/tabs.types";
import { tabKey } from "../types/tabs.types";
import { useTabStateStore } from "./tabState.store";

const LS_KEY = "capubridge:tabs:v1";
const PERSIST_DEBOUNCE_MS = 500;

const TOOL_LABEL: Record<ToolId, string> = {
  storage: "Storage",
  network: "Network",
  inspect: "Inspect",
  console: "Console",
  replay: "Replay",
  capacitor: "Capacitor",
  "browser-preview": "Browser Preview",
  settings: "Settings",
  devices: "Devices",
  app: "App",
};

function scopeLabel(scope: TabScope): string {
  switch (scope.kind) {
    case "target":
      return scope.webviewId ? `${scope.serial} / ${scope.webviewId}` : scope.serial;
    case "recording":
      return scope.capuPath.split(/[/\\]/).pop() ?? scope.capuPath;
    case "singleton":
      return "";
  }
}

export function deriveTitle(tool: ToolId, scope: TabScope): string {
  const tool_ = TOOL_LABEL[tool];
  const scope_ = scopeLabel(scope);
  return scope_ ? `${tool_} · ${scope_}` : tool_;
}

interface PersistedTab {
  id: string;
  tool: ToolId;
  scope: TabScope;
  title: string;
  createdAt: number;
  lastFocusedAt: number;
}

interface PersistedState {
  tabs: PersistedTab[];
  activeTabId: string | null;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export const useTabsStore = defineStore("tabs", () => {
  const tabs = ref<Tab[]>([]);
  const activeTabId = ref<string | null>(null);
  let persistTimer: ReturnType<typeof setTimeout> | null = null;

  const activeTab = computed<Tab | null>(
    () => tabs.value.find((t) => t.id === activeTabId.value) ?? null,
  );

  function findTab(tool: ToolId, scope: TabScope): Tab | undefined {
    const key = tabKey(tool, scope);
    return tabs.value.find((t) => tabKey(t.tool, t.scope) === key);
  }

  function persist() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      const payload: PersistedState = {
        tabs: tabs.value.map((t) => ({
          id: t.id,
          tool: t.tool,
          scope: t.scope,
          title: t.title,
          createdAt: t.createdAt,
          lastFocusedAt: t.lastFocusedAt,
        })),
        activeTabId: activeTabId.value,
      };
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(payload));
      } catch {
        // ignore quota errors
      }
    }, PERSIST_DEBOUNCE_MS);
  }

  function initialize() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedState;
      if (!parsed || !Array.isArray(parsed.tabs)) return;
      tabs.value = parsed.tabs.map<Tab>((t) => ({
        id: t.id,
        tool: t.tool,
        scope: t.scope,
        title: t.title,
        createdAt: t.createdAt,
        lastFocusedAt: t.lastFocusedAt,
      }));
      activeTabId.value =
        parsed.activeTabId && tabs.value.some((t) => t.id === parsed.activeTabId)
          ? parsed.activeTabId
          : (tabs.value[0]?.id ?? null);
    } catch {
      // corrupt JSON — start fresh
      tabs.value = [];
      activeTabId.value = null;
    }
  }

  function openTab(tool: ToolId, scope: TabScope): Tab {
    const existing = findTab(tool, scope);
    if (existing) {
      focusTab(existing.id);
      return existing;
    }
    const now = Date.now();
    const tab: Tab = {
      id: uuid(),
      tool,
      scope,
      title: deriveTitle(tool, scope),
      createdAt: now,
      lastFocusedAt: now,
    };
    tabs.value = [...tabs.value, tab];
    activeTabId.value = tab.id;
    useTabStateStore().ensure(tab.id, tool);
    persist();
    return tab;
  }

  function closeTab(id: string) {
    const idx = tabs.value.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const wasActive = activeTabId.value === id;
    const next = [...tabs.value];
    next.splice(idx, 1);
    tabs.value = next;
    if (wasActive) {
      const neighbour = next[idx] ?? next[idx - 1] ?? null;
      activeTabId.value = neighbour ? neighbour.id : null;
    }
    useTabStateStore().dispose(id);
    persist();
  }

  function closeOthers(id: string) {
    tabs.value = tabs.value.filter((t) => t.id === id);
    activeTabId.value = id;
    persist();
  }

  function closeAll() {
    tabs.value = [];
    activeTabId.value = null;
    persist();
  }

  function closeToRight(id: string) {
    const idx = tabs.value.findIndex((t) => t.id === id);
    if (idx === -1) return;
    tabs.value = tabs.value.slice(0, idx + 1);
    if (activeTabId.value && !tabs.value.some((t) => t.id === activeTabId.value)) {
      activeTabId.value = id;
    }
    persist();
  }

  function focusTab(id: string) {
    const tab = tabs.value.find((t) => t.id === id);
    if (!tab) return;
    tab.lastFocusedAt = Date.now();
    activeTabId.value = id;
    persist();
  }

  function moveTab(id: string, toIndex: number) {
    const fromIndex = tabs.value.findIndex((t) => t.id === id);
    if (fromIndex === -1) return;
    const clampedTo = Math.max(0, Math.min(tabs.value.length - 1, toIndex));
    if (fromIndex === clampedTo) return;
    const next = [...tabs.value];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(clampedTo, 0, moved);
    tabs.value = next;
    persist();
  }

  function nextTab() {
    if (tabs.value.length === 0) return;
    const idx = tabs.value.findIndex((t) => t.id === activeTabId.value);
    const target = tabs.value[(idx + 1) % tabs.value.length];
    focusTab(target.id);
  }

  function prevTab() {
    if (tabs.value.length === 0) return;
    const idx = tabs.value.findIndex((t) => t.id === activeTabId.value);
    const target = tabs.value[(idx - 1 + tabs.value.length) % tabs.value.length];
    focusTab(target.id);
  }

  function jumpTo(index: number) {
    if (index < 0 || index >= tabs.value.length) return;
    focusTab(tabs.value[index].id);
  }

  return {
    tabs,
    activeTabId,
    activeTab,
    initialize,
    openTab,
    closeTab,
    closeOthers,
    closeAll,
    closeToRight,
    focusTab,
    moveTab,
    nextTab,
    prevTab,
    jumpTo,
  };
});
