import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import { dockTabIds, type DockTab, isDockTab } from "@/types/dock.types";

const dockStorageKey = "capubridge:dock";
const dockDefaultHeight = 320;
const dockMinHeight = 120;

interface PersistedDockState {
  activeTab: DockTab;
  heightPx: number;
  isOpen: boolean;
  poppedOutTabs: DockTab[];
}

function normalizePersistedTab(value: string | null | undefined): DockTab | null {
  if (value === "output") {
    return "console";
  }

  return isDockTab(value) ? value : null;
}

function getMaxHeight() {
  if (typeof window === "undefined") {
    return 560;
  }

  return Math.max(dockMinHeight, Math.floor(window.innerHeight * 0.7));
}

function clampHeight(height: number) {
  return Math.min(Math.max(Math.round(height), dockMinHeight), getMaxHeight());
}

function readPersistedDockState(): PersistedDockState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(dockStorageKey);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedDockState>;
    const poppedOutTabs = Array.isArray(parsed.poppedOutTabs)
      ? parsed.poppedOutTabs
          .map((tab) => normalizePersistedTab(tab))
          .filter((tab): tab is DockTab => tab !== null)
      : [];

    return {
      activeTab: normalizePersistedTab(parsed.activeTab) ?? "assistant",
      heightPx: clampHeight(
        typeof parsed.heightPx === "number" ? parsed.heightPx : dockDefaultHeight,
      ),
      isOpen: parsed.isOpen === true,
      poppedOutTabs,
    };
  } catch {
    return null;
  }
}

export const useDockStore = defineStore("dock", () => {
  const persistedState = readPersistedDockState();

  const isOpen = ref(persistedState?.isOpen ?? false);
  const activeTab = ref<DockTab>(persistedState?.activeTab ?? "assistant");
  const heightPx = ref(clampHeight(persistedState?.heightPx ?? dockDefaultHeight));
  const isFocused = ref(false);
  const unreadByTab = ref<Record<DockTab, boolean>>({
    assistant: false,
    logcat: false,
    repl: false,
    console: false,
    exceptions: false,
  });
  const poppedOutTabs = ref<Set<DockTab>>(new Set(persistedState?.poppedOutTabs ?? []));

  const visibleTabs = computed(() => dockTabIds.filter((tab) => !poppedOutTabs.value.has(tab)));

  function resolveActiveTab(preferred?: DockTab) {
    if (preferred && visibleTabs.value.includes(preferred)) {
      return preferred;
    }

    if (visibleTabs.value.includes(activeTab.value)) {
      return activeTab.value;
    }

    return visibleTabs.value[0] ?? "assistant";
  }

  function persistState() {
    if (typeof window === "undefined") {
      return;
    }

    const payload: PersistedDockState = {
      activeTab: activeTab.value,
      heightPx: heightPx.value,
      isOpen: isOpen.value,
      poppedOutTabs: Array.from(poppedOutTabs.value),
    };

    window.localStorage.setItem(dockStorageKey, JSON.stringify(payload));
  }

  function closeDock() {
    isOpen.value = false;
    isFocused.value = false;
  }

  function openDock(tab?: DockTab) {
    const nextTab = resolveActiveTab(tab);

    if (visibleTabs.value.length === 0) {
      closeDock();
      return;
    }

    isOpen.value = true;
    activeTab.value = nextTab;
    unreadByTab.value[nextTab] = false;
  }

  function toggleDock(tab?: DockTab) {
    if (isOpen.value && !tab) {
      closeDock();
      return;
    }

    openDock(tab);
  }

  function setHeight(height: number) {
    heightPx.value = clampHeight(height);
  }

  function resizeBy(delta: number) {
    setHeight(heightPx.value + delta);
  }

  function toggleHeightPreset() {
    const minHeight = dockMinHeight;
    const maxHeight = getMaxHeight();
    const threshold = minHeight + (maxHeight - minHeight) / 2;
    setHeight(heightPx.value > threshold ? minHeight : maxHeight);
  }

  function syncToViewport() {
    setHeight(heightPx.value);
  }

  function setFocused(focused: boolean) {
    isFocused.value = focused;
  }

  function setPoppedOut(tab: DockTab, poppedOut: boolean) {
    const nextTabs = new Set(poppedOutTabs.value);

    if (poppedOut) {
      nextTabs.add(tab);
    } else {
      nextTabs.delete(tab);
    }

    poppedOutTabs.value = nextTabs;

    if (poppedOut) {
      unreadByTab.value[tab] = false;
    }

    if (visibleTabs.value.length === 0) {
      closeDock();
      activeTab.value = tab;
      return;
    }

    activeTab.value = resolveActiveTab(poppedOut ? undefined : tab);

    if (!poppedOut && !isOpen.value) {
      unreadByTab.value[tab] = false;
    }
  }

  function setActiveTab(tab: DockTab) {
    if (poppedOutTabs.value.has(tab)) {
      return;
    }

    activeTab.value = tab;
    unreadByTab.value[tab] = false;
  }

  function markUnread(tab: DockTab) {
    if (activeTab.value !== tab || !isOpen.value) {
      unreadByTab.value[tab] = true;
    }
  }

  const hasUnread = computed(() => Object.values(unreadByTab.value).some(Boolean));

  if (visibleTabs.value.length === 0) {
    isOpen.value = false;
  } else {
    activeTab.value = resolveActiveTab(activeTab.value);
  }

  watch(
    () => [isOpen.value, activeTab.value, heightPx.value, Array.from(poppedOutTabs.value)] as const,
    () => {
      persistState();
    },
    { deep: true },
  );

  return {
    isOpen,
    activeTab,
    heightPx,
    isFocused,
    unreadByTab,
    visibleTabs,
    poppedOutTabs,
    closeDock,
    toggleDock,
    openDock,
    setActiveTab,
    setHeight,
    resizeBy,
    toggleHeightPreset,
    syncToViewport,
    setFocused,
    setPoppedOut,
    markUnread,
    hasUnread,
  };
});
