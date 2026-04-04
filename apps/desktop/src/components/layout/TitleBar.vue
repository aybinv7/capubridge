<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { Minus, Maximize2, Minimize2, X, Circle, ChevronDown } from "lucide-vue-next";
import DeviceManagerModal from "@/components/DeviceManagerModal.vue";
import { Search } from "lucide-vue-next";

const isMaximized = ref(false);
const emit = defineEmits<{ openCommandPalette: [] }>();

const clock = ref("");
const deviceModalOpen = ref(false);
const activeDevice = ref({ model: "Galaxy S23", id: "R5CR30LHXXY" });

function updateClock() {
  const now = new Date();
  clock.value = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

let timer: ReturnType<typeof setInterval>;

function onSelectDevice(id: string) {
  const map: Record<string, string> = {
    R5CR30LHXXY: "Galaxy S23",
    emulator_5554: "Pixel 7 Emulator",
    "8XH3R9K21B": "Huawei P30 Pro",
  };
  activeDevice.value = { model: map[id] ?? id, id };
}

let appWindow: any = null;

onMounted(async () => {
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

onMounted(() => {
  updateClock();
  timer = setInterval(updateClock, 1000);
});
onUnmounted(() => clearInterval(timer));
</script>

<template>
  <div class="h-10 shrink-0 flex items-center select-none" style="-webkit-app-region: drag">
    <!-- Device selector -->
    <button
      @click="deviceModalOpen = true"
      class="flex items-center gap-2 text-xs surface-interactive rounded-full ml-2 px-3 py-1.5 transition-colors border border-border/30 hover:border-border/50"
    >
      <Circle class="w-1.5 h-1.5 fill-success text-success" />
      <span class="font-medium text-foreground">{{ activeDevice.model }}</span>
      <span class="text-muted-foreground/50 font-mono text-2xs">{{
        activeDevice.id.slice(0, 8)
      }}</span>
      <ChevronDown class="w-3 h-3 text-muted-foreground/50" />
    </button>

    <div class="flex-1" />

    <!-- Center: search bar -->
    <button
      class="flex items-center gap-2.5 px-4 py-1 bg-surface-2 border border-border/30 rounded-full min-w-[320px] surface-interactive hover:border-border/50 hover:bg-surface-3 transition-colors"
      style="-webkit-app-region: no-drag"
      @click="emit('openCommandPalette')"
    >
      <Search class="w-4 h-4 text-muted-foreground/40" />
      <span class="text-sm text-muted-foreground/50 flex-1 text-left">Search…</span>
      <kbd
        class="text-[10px] text-muted-foreground/40 bg-surface-3 border border-border/30 px-2 py-0.5 rounded-lg font-mono"
        >⌘+K</kbd
      >
    </button>

    <div class="flex-1" />

    <!-- Window controls -->
    <div class="flex items-center" style="-webkit-app-region: no-drag">
      <button
        class="w-11 h-9 flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-surface-2 transition-colors"
        @click="minimize"
      >
        <Minus class="w-3.5 h-3.5" />
      </button>
      <button
        class="w-11 h-9 flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-surface-2 transition-colors"
        @click="toggleMaximize"
      >
        <Maximize2 v-if="!isMaximized" class="w-3 h-3" />
        <Minimize2 v-else class="w-3 h-3" />
      </button>
      <button
        class="w-11 h-9 flex items-center justify-center text-muted-foreground/50 hover:text-[#981515] hover:bg-[#981515]/10 transition-colors"
        @click="close"
      >
        <X class="w-3.5 h-3.5" />
      </button>
    </div>

    <DeviceManagerModal
      :open="deviceModalOpen"
      @close="deviceModalOpen = false"
      @select-device="onSelectDevice"
    />
  </div>
</template>
