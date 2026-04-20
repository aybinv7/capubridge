<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import BottomDock from "@/components/dock/BottomDock.vue";
import TitleBar from "./TitleBar.vue";
import Sidebar from "./Sidebar.vue";
import CommandPalette from "@/components/CommandPalette.vue";
import MirrorPanel from "@/modules/mirror/MirrorPanel.vue";
import { clearDockOpenRequest, dockOpenEventName, readDockOpenRequest } from "@/lib/dock-events";
import { useMirrorStore } from "@/stores/mirror.store";
import { useInspectStore } from "@/stores/inspect.store";
import { useUIStore } from "@/stores/ui.store";
import { useDockStore } from "@/stores/dock.store";
import type { DockTab } from "@/types/dock.types";

const commandPaletteOpen = ref(false);
const mainContentRef = ref<HTMLElement | null>(null);
const bottomDockRef = ref<InstanceType<typeof BottomDock> | null>(null);
const mirrorStore = useMirrorStore();
const inspectStore = useInspectStore();
const uiStore = useUIStore();
const dockStore = useDockStore();
const router = useRouter();
let unlistenInspectRequest: (() => void) | null = null;
let unlistenInspectHover: (() => void) | null = null;
let unlistenInspectSelect: (() => void) | null = null;
let unlistenInspectLeave: (() => void) | null = null;
let unlistenInspectClose: (() => void) | null = null;
let removeDockOpenListener: (() => void) | null = null;

const showMirrorLeft = computed(
  () => mirrorStore.isOpen && !mirrorStore.isDetached && mirrorStore.side === "left",
);
const showMirrorRight = computed(
  () => mirrorStore.isOpen && !mirrorStore.isDetached && mirrorStore.side === "right",
);
const mirrorBottomInset = computed(() => (dockStore.isOpen ? `${dockStore.heightPx}px` : "0px"));

async function syncInspectModeToDetached(enabled: boolean) {
  try {
    const { emitTo } = await import("@tauri-apps/api/event");
    await emitTo("mirror-detached", "capubridge:set-inspect-mode", { enabled });
  } catch {}
}

function focusMainContent() {
  mainContentRef.value?.focus();
}

async function focusDock() {
  await nextTick();
  bottomDockRef.value?.focusDock();
}

function openDock(tab?: DockTab) {
  dockStore.openDock(tab);
  clearDockOpenRequest();
  void focusDock();
}

function handleDockOpenRequest(event: Event) {
  const customEvent = event as CustomEvent<{ tab?: DockTab }>;
  openDock(customEvent.detail?.tab);
}

function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    commandPaletteOpen.value = true;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "j") {
    e.preventDefault();
    if (dockStore.isOpen) {
      dockStore.closeDock();
      focusMainContent();
      return;
    }

    openDock();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "b") {
    e.preventDefault();
    uiStore.toggleSidebar();
  }
}

function onResize() {
  dockStore.syncToViewport();
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("resize", onResize);
  window.addEventListener(dockOpenEventName, handleDockOpenRequest as EventListener);
  removeDockOpenListener = () => {
    window.removeEventListener(dockOpenEventName, handleDockOpenRequest as EventListener);
  };

  const pendingDockTab = readDockOpenRequest();
  if (pendingDockTab) {
    openDock(pendingDockTab);
  }
});

onMounted(async () => {
  try {
    const { listen } = await import("@tauri-apps/api/event");
    unlistenInspectRequest = await listen("capubridge:open-inspect", async () => {
      await router.push("/inspect/elements");
      inspectStore.inspectMode = true;
    });
    unlistenInspectHover = await listen<{ x: number; y: number }>(
      "capubridge:inspect-hover",
      (event) => {
        if (!inspectStore.inspectMode) return;
        inspectStore.setMirrorHoverPoint(event.payload.x, event.payload.y);
      },
    );
    unlistenInspectSelect = await listen<{ x: number; y: number }>(
      "capubridge:inspect-select",
      (event) => {
        if (!inspectStore.inspectMode) return;
        inspectStore.setMirrorSelectPoint(event.payload.x, event.payload.y);
      },
    );
    unlistenInspectLeave = await listen("capubridge:inspect-leave", () => {
      if (!inspectStore.inspectMode) return;
      inspectStore.clearMirrorHoverPoint();
    });
    unlistenInspectClose = await listen("capubridge:close-inspect", () => {
      inspectStore.clearMirrorHoverPoint();
      inspectStore.inspectMode = false;
    });
  } catch {}
});

watch(
  () => inspectStore.inspectMode,
  (enabled) => {
    void syncInspectModeToDetached(enabled);
  },
);

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("resize", onResize);
  if (removeDockOpenListener) {
    removeDockOpenListener();
    removeDockOpenListener = null;
  }
  if (unlistenInspectRequest) {
    unlistenInspectRequest();
    unlistenInspectRequest = null;
  }
  if (unlistenInspectHover) {
    unlistenInspectHover();
    unlistenInspectHover = null;
  }
  if (unlistenInspectSelect) {
    unlistenInspectSelect();
    unlistenInspectSelect = null;
  }
  if (unlistenInspectLeave) {
    unlistenInspectLeave();
    unlistenInspectLeave = null;
  }
  if (unlistenInspectClose) {
    unlistenInspectClose();
    unlistenInspectClose = null;
  }
});
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden bg-background dark">
    <TitleBar @open-command-palette="commandPaletteOpen = true" />

    <div class="flex flex-1 overflow-hidden">
      <Sidebar />

      <div class="relative flex flex-1 flex-col overflow-hidden min-w-0 bg-surface-0">
        <main ref="mainContentRef" tabindex="-1" class="flex-1 overflow-hidden outline-none">
          <RouterView />
        </main>

        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          leave-active-class="transition-all duration-150 ease-in"
          enter-from-class="translate-y-full opacity-0"
          leave-to-class="translate-y-full opacity-0"
        >
          <BottomDock
            v-if="dockStore.isOpen"
            ref="bottomDockRef"
            @request-main-focus="focusMainContent"
          />
        </Transition>

        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          leave-active-class="transition-all duration-150 ease-in"
          enter-from-class="opacity-0 -translate-x-full"
          leave-to-class="opacity-0 -translate-x-full"
        >
          <div
            v-if="showMirrorLeft"
            class="absolute inset-y-0 left-0 z-20"
            :style="{ bottom: mirrorBottomInset }"
          >
            <MirrorPanel />
          </div>
        </Transition>

        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          leave-active-class="transition-all duration-150 ease-in"
          enter-from-class="opacity-0 translate-x-full"
          leave-to-class="opacity-0 translate-x-full"
        >
          <div
            v-if="showMirrorRight"
            class="absolute inset-y-0 right-0 z-20"
            :style="{ bottom: mirrorBottomInset }"
          >
            <MirrorPanel />
          </div>
        </Transition>
      </div>
    </div>
  </div>

  <CommandPalette :open="commandPaletteOpen" @close="commandPaletteOpen = false" />
</template>
