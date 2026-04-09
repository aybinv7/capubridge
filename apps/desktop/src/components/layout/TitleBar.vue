<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { Minus, Maximize2, Minimize2, X, Search, ScreenShare } from "lucide-vue-next";
import { useDevicesStore } from "@/stores/devices.store";
import { useSourceStore } from "@/stores/source.store";
import { useMirrorStore } from "@/stores/mirror.store";
import { initCDPWatchers } from "@/composables/useCDP";
import { useSessionPersistence } from "@/composables/useSessionPersistence";
import ConnectionSummary from "./ConnectionSummary.vue";

const emit = defineEmits<{ openCommandPalette: [] }>();

const devicesStore = useDevicesStore();
const sourceStore = useSourceStore();
const mirrorStore = useMirrorStore();

initCDPWatchers();
useSessionPersistence();

const isMaximized = ref(false);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let appWindow: any = null;

const mirrorEnabled = computed(() => devicesStore.selectedDevice?.status === "online");

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
  devicesStore.startPolling(3000);

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
    class="h-11 shrink-0 flex flex-row justify-between w-full items-center px-2 select-none border-b border-border/20"
    style="-webkit-app-region: drag"
  >
    <!-- Mirror toggle -->
    <button
      class="flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] transition-all border"
      :class="
        mirrorStore.isOpen
          ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
          : mirrorEnabled
            ? 'border-border/25 text-muted-foreground/50 hover:text-foreground hover:border-border/45 hover:bg-surface-2'
            : 'border-border/15 text-muted-foreground/20 cursor-not-allowed'
      "
      :disabled="!mirrorEnabled"
      :title="
        !mirrorEnabled
          ? 'Connect a device to enable mirroring'
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
        class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"
      />
    </button>
    <div style="-webkit-app-region: no-drag">
      <ConnectionSummary />
    </div>

    <div class="flex items-center gap-1" style="-webkit-app-region: no-drag">
      <!-- Search / command palette -->
      <button
        class="flex items-center gap-1 h-7 px-2.5 rounded-full border border-border/25 bg-surface-2 hover:border-border/45 hover:bg-surface-3 transition-colors ml-1"
        @click="emit('openCommandPalette')"
        title="Command palette (⌘K)"
      >
        <kbd class="text-[10px] text-muted-foreground/35 font-mono leading-none">⌘ K</kbd>
      </button>

      <!-- Window controls -->
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
          class="w-10 h-9 flex items-center justify-center text-muted-foreground/40 hover:text-[#e05050] hover:bg-[#e05050]/10 transition-colors"
          @click="close"
        >
          <X class="w-3 h-3" />
        </button>
      </div>
    </div>
  </div>
</template>
