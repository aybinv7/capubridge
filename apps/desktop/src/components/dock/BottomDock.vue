<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import DockResizeHandle from "./DockResizeHandle.vue";
import DockTabBar from "./DockTabBar.vue";
import DockTabContent from "./DockTabContent.vue";
import { useDockStore } from "@/stores/dock.store";
import { dockTabMeta } from "./dock-meta";
import { dockTabIds, type DockTab } from "@/types/dock.types";

const emit = defineEmits<{
  requestMainFocus: [];
}>();

const dockStore = useDockStore();
const { activeTab, heightPx, poppedOutTabs, unreadByTab } = storeToRefs(dockStore);

const rootRef = ref<HTMLElement | null>(null);

const visibleTabs = computed(() => dockTabIds.filter((tab) => !poppedOutTabs.value.has(tab)));

const currentTab = computed(() => {
  if (visibleTabs.value.includes(activeTab.value)) {
    return activeTab.value;
  }

  return visibleTabs.value[0] ?? "assistant";
});

function focusDock() {
  void nextTick(() => {
    rootRef.value?.focus();
  });
}

function handleFocusIn() {
  dockStore.setFocused(true);
}

function handleFocusOut(event: FocusEvent) {
  const nextTarget = event.relatedTarget;
  if (nextTarget instanceof Node && rootRef.value?.contains(nextTarget)) {
    return;
  }

  dockStore.setFocused(false);
}

function handleKeydown(event: KeyboardEvent) {
  const hasModifier = event.ctrlKey || event.metaKey;

  if (event.key === "Escape") {
    event.preventDefault();
    dockStore.setFocused(false);
    emit("requestMainFocus");
    return;
  }

  if (!hasModifier) {
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    dockStore.resizeBy(80);
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    dockStore.resizeBy(-80);
    return;
  }

  const tabIndex = Number.parseInt(event.key, 10);
  if (Number.isNaN(tabIndex)) {
    return;
  }

  const nextTab = visibleTabs.value[tabIndex - 1];
  if (!nextTab) {
    return;
  }

  event.preventDefault();
  dockStore.setActiveTab(nextTab);
}

function startResize(event: MouseEvent) {
  const startY = event.clientY;
  const startHeight = heightPx.value;
  const previousCursor = document.body.style.cursor;
  const previousUserSelect = document.body.style.userSelect;

  const onMove = (nextEvent: MouseEvent) => {
    dockStore.setHeight(startHeight + (startY - nextEvent.clientY));
  };

  const onUp = () => {
    document.body.style.cursor = previousCursor;
    document.body.style.userSelect = previousUserSelect;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };

  document.body.style.cursor = "row-resize";
  document.body.style.userSelect = "none";

  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

async function popoutTab(tab: DockTab) {
  dockStore.setPoppedOut(tab, true);

  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const label = `dock-${tab}`;
    const existingWindow = await WebviewWindow.getByLabel(label);

    if (existingWindow) {
      await existingWindow.show();
      await existingWindow.setFocus();
      return;
    }

    const windowTitle = `${dockTabMeta[tab].windowTitle} - Capubridge`;
    const dockWindow = new WebviewWindow(label, {
      url: `/?dock=${tab}`,
      title: windowTitle,
      width: 960,
      height: 420,
      minWidth: 640,
      minHeight: 220,
      resizable: true,
      decorations: false,
    });

    dockWindow.once("tauri://destroyed", () => {
      dockStore.setPoppedOut(tab, false);
    });

    dockWindow.once("tauri://error", () => {
      dockStore.setPoppedOut(tab, false);
      toast.error(`Failed to open ${dockTabMeta[tab].label}`);
    });
  } catch (error) {
    dockStore.setPoppedOut(tab, false);
    toast.error(`Failed to open ${dockTabMeta[tab].label}`, {
      description: String(error),
    });
  }
}

defineExpose({
  focusDock,
});
</script>

<template>
  <div
    ref="rootRef"
    tabindex="-1"
    class="relative flex shrink-0 flex-col overflow-hidden border-t border-border bg-background shadow-[0_-16px_40px_-28px_rgb(0_0_0_/_0.9)] outline-none"
    :style="{ height: `${heightPx}px` }"
    @focusin="handleFocusIn"
    @focusout="handleFocusOut"
    @keydown.capture="handleKeydown"
  >
    <DockResizeHandle @resize-start="startResize" @toggle-height="dockStore.toggleHeightPreset()" />
    <DockTabBar
      :active-tab="currentTab"
      :tabs="visibleTabs"
      :unread-by-tab="unreadByTab"
      @close="
        dockStore.closeDock();
        emit('requestMainFocus');
      "
      @popout="popoutTab"
      @update:active-tab="dockStore.setActiveTab"
    />
    <div class="min-h-0 flex-1 overflow-hidden bg-surface-0">
      <DockTabContent :tab="currentTab" />
    </div>
  </div>
</template>
