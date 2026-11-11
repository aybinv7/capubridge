import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import { readPersisted, writePersisted } from "@/lib/persisted";
import { EMPTY_THIS_PC, isSavedThisPc, type SavedThisPc } from "@/lib/this-pc-session";
import { useTargetsStore } from "@/stores/targets.store";
import type { CDPTarget } from "@/types/cdp.types";

const LS_THIS_PC = "capubridge:this-pc-tabs";

/** What a tab's page last reported about itself: where it is, its title and its icon. */
export interface LivePage {
  url: string;
  title: string;
  icon: string | null;
}

/**
 * This PC as a browser: each page open on This PC is a tab, and This PC stays the context even
 * with no tab open, showing a New Tab page instead of asking for a target. Picking a phone's
 * target leaves it.
 */
export const useThisPcBrowserStore = defineStore("thisPcBrowser", () => {
  const targetsStore = useTargetsStore();
  const browsing = ref(false);
  const newTabOpen = ref(false);
  const pages = ref<Record<string, LivePage>>({});

  const tabs = computed<CDPTarget[]>(() =>
    targetsStore.targets.filter((target) => target.source === "local"),
  );
  const selectedTab = computed<CDPTarget | null>(() => {
    const selected = targetsStore.selectedTarget;
    return selected?.source === "local" ? selected : null;
  });
  const active = computed(() => browsing.value || selectedTab.value !== null);
  const showingNewTab = computed(
    () => active.value && (newTabOpen.value || selectedTab.value === null),
  );

  watch(
    () => targetsStore.selectedTarget,
    (selected) => {
      if (!selected) return;
      browsing.value = selected.source === "local";
      newTabOpen.value = false;
    },
  );

  function enter() {
    browsing.value = true;
    if (!selectedTab.value) newTabOpen.value = true;
  }

  function leave() {
    browsing.value = false;
    newTabOpen.value = false;
  }

  function openNewTab() {
    browsing.value = true;
    newTabOpen.value = true;
  }

  function closeNewTab() {
    newTabOpen.value = false;
  }

  const saved = readPersisted<SavedThisPc>(LS_THIS_PC, EMPTY_THIS_PC, isSavedThisPc);
  let saving = false;

  const snapshot = computed<SavedThisPc>(() => {
    const selectedId = selectedTab.value?.id ?? null;
    return {
      urls: tabs.value.map((tab) => pages.value[tab.id]?.url || tab.url),
      selected: selectedId ? tabs.value.findIndex((tab) => tab.id === selectedId) : null,
      active: active.value,
    };
  });

  watch(snapshot, (next) => {
    if (saving) writePersisted(LS_THIS_PC, next);
  });

  /**
   * The tabs saved by the last run, handed out once. Saving starts only then, so the empty state
   * before the restore never replaces what was saved.
   */
  function takeSaved(): SavedThisPc {
    saving = true;
    return saved;
  }

  function notePage(targetId: string, page: LivePage) {
    pages.value = { ...pages.value, [targetId]: page };
  }

  function forgetPage(targetId: string) {
    const next = { ...pages.value };
    delete next[targetId];
    pages.value = next;
  }

  return {
    tabs,
    selectedTab,
    active,
    showingNewTab,
    pages,
    enter,
    leave,
    openNewTab,
    closeNewTab,
    notePage,
    forgetPage,
    takeSaved,
  };
});
