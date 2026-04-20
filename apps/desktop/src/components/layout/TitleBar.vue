<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import {
  Minus,
  Maximize2,
  Minimize2,
  X,
  ScreenShare,
  Terminal,
  PanelLeft,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-vue-next";
import { useRouter } from "vue-router";
import { useDevicesStore } from "@/stores/devices.store";
import { useSourceStore } from "@/stores/source.store";
import { useMirrorStore } from "@/stores/mirror.store";
import { useTargetsStore } from "@/stores/targets.store";
import { useDockStore } from "@/stores/dock.store";
import { useUIStore } from "@/stores/ui.store";
import { initCDPWatchers } from "@/composables/useCDP";
import { useSessionPersistence } from "@/composables/useSessionPersistence";
import ConnectionSummary from "./ConnectionSummary.vue";

const emit = defineEmits<{ openCommandPalette: [] }>();

const router = useRouter();
const devicesStore = useDevicesStore();
const sourceStore = useSourceStore();
const mirrorStore = useMirrorStore();
const targetsStore = useTargetsStore();
const dockStore = useDockStore();
const uiStore = useUIStore();

initCDPWatchers();
useSessionPersistence();

const isMaximized = ref(false);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let appWindow: any = null;

const mirrorEnabled = computed(
  () => devicesStore.selectedDevice?.status === "online" || targetsStore.selectedTarget !== null,
);

watch(
  () => devicesStore.devices,
  (devices) => {
    if (devicesStore.selectedDevice) return;
    const first = devices.find((d) => d.status === "online");
    if (first) devicesStore.selectDevice(first);
  },
  { immediate: true },
);

onMounted(async () => {
  void devicesStore.refreshDevices();

  const savedPort = localStorage.getItem("capubridge:chrome-port");
  if (!sourceStore.hasChromeSource) {
    const result = await sourceStore.autoConnectChrome().catch(() => null);
    if (result !== "connected" && savedPort) {
      const port = parseInt(savedPort, 10);
      if (!isNaN(port)) await sourceStore.connectChrome(port).catch(() => null);
    }
  }

  try {
    const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    appWindow = getCurrentWebviewWindow();
    isMaximized.value = await appWindow.isMaximized();
    appWindow.onResized(async () => {
      isMaximized.value = await appWindow.isMaximized();
    });
  } catch {
    appWindow = null;
  }
});

onUnmounted(() => {
  devicesStore.stopPolling();
});

async function minimize() {
  await appWindow?.minimize();
}

async function toggleMaximize() {
  if (!appWindow) return;
  if (isMaximized.value) {
    await appWindow.unmaximize();
    isMaximized.value = false;
  } else {
    await appWindow.maximize();
    isMaximized.value = true;
  }
}

async function close() {
  await appWindow?.close();
}
</script>

<template>
  <div
    class="relative h-11 shrink-0 flex flex-row items-center px-2 select-none border-b border-border/20 bg-background"
    style="-webkit-app-region: drag"
  >
    <!-- Left: sidebar toggle + back/forward -->
    <div class="flex items-center gap-0.5 z-10" style="-webkit-app-region: no-drag">
      <button
        class="flex items-center justify-center w-8 h-8 rounded-md transition-colors duration-[120ms] text-muted-foreground/50 hover:text-foreground hover:bg-surface-2"
        title="Toggle Sidebar (⌘B)"
        @click="uiStore.toggleSidebar()"
      >
        <PanelLeft class="w-3.5 h-3.5" />
      </button>
      <button
        class="flex items-center justify-center w-7 h-7 rounded-md transition-colors duration-[120ms] text-muted-foreground/35 hover:text-foreground hover:bg-surface-2"
        title="Go Back"
        @click="router.back()"
      >
        <ChevronLeft class="w-3.5 h-3.5" />
      </button>
      <button
        class="flex items-center justify-center w-7 h-7 rounded-md transition-colors duration-[120ms] text-muted-foreground/35 hover:text-foreground hover:bg-surface-2"
        title="Go Forward"
        @click="router.forward()"
      >
        <ChevronRight class="w-3.5 h-3.5" />
      </button>

      <button
        class="flex items-center justify-center w-7 h-7 rounded-md transition-colors duration-[120ms] text-muted-foreground/35 hover:text-foreground hover:bg-surface-2"
        title="Command palette (⌘K)"
        @click="emit('openCommandPalette')"
      >
        <Search class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Center: absolutely positioned connection pill -->
    <div class="absolute left-1/2 -translate-x-1/2" style="-webkit-app-region: no-drag">
      <ConnectionSummary />
    </div>

    <!-- Right: dock + mirror + ⌘K + window controls -->
    <div class="flex items-center gap-1 ml-auto z-10" style="-webkit-app-region: no-drag">
      <button
        class="flex items-center justify-center w-8 h-8 rounded-md transition-colors duration-[120ms] relative"
        :class="
          dockStore.isOpen
            ? 'text-accent bg-accent-soft'
            : 'text-muted-foreground/50 hover:text-foreground hover:bg-surface-2'
        "
        title="Toggle Dock (⌘J)"
        @click="dockStore.toggleDock()"
      >
        <Terminal class="w-3.5 h-3.5" />
        <span
          v-if="dockStore.hasUnread"
          class="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent"
        />
      </button>

      <button
        class="flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] transition-all border ml-1"
        :class="
          mirrorStore.isOpen
            ? 'bg-accent/10 border-accent/30 text-accent hover:bg-accent/20'
            : mirrorEnabled
              ? 'border-border/25 text-muted-foreground/50 hover:text-foreground hover:border-border-active hover:bg-surface-2'
              : 'border-border/15 text-muted-foreground/20 cursor-not-allowed'
        "
        :disabled="!mirrorEnabled"
        :title="
          !mirrorEnabled
            ? 'Select target or connect device to enable mirroring'
            : mirrorStore.isOpen
              ? 'Stop mirroring'
              : 'Mirror device screen'
        "
        @click="mirrorEnabled && mirrorStore.toggle()"
      >
        <ScreenShare class="w-3 h-3" />
        <span>Mirror</span>
        <span
          v-if="mirrorStore.isOpen && mirrorStore.isStreaming"
          class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"
        />
      </button>

      <div class="flex items-center ml-1">
        <button
          class="w-10 h-9 flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-surface-2 transition-colors"
          @click="minimize"
        >
          <Minus class="w-3 h-3" />
        </button>
        <button
          class="w-10 h-9 flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-surface-2 transition-colors"
          @click="toggleMaximize"
        >
          <Maximize2 v-if="!isMaximized" class="w-2.5 h-2.5" />
          <Minimize2 v-else class="w-2.5 h-2.5" />
        </button>
        <button
          class="w-10 h-9 flex items-center justify-center text-muted-foreground/40 hover:text-destructive-foreground hover:bg-destructive/80 transition-colors"
          @click="close"
        >
          <X class="w-3 h-3" />
        </button>
      </div>
    </div>
  </div>
</template>
