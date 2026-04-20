<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Maximize2, Minimize2, Minus, X } from "lucide-vue-next";
import DockTabContent from "./DockTabContent.vue";
import { dockTabMeta } from "./dock-meta";
import { isDockTab } from "@/types/dock.types";

const dockValue = new URLSearchParams(window.location.search).get("dock");

const activeTab = computed(() => (isDockTab(dockValue) ? dockValue : "assistant"));
const activeMeta = computed(() => dockTabMeta[activeTab.value]);

const isMaximized = ref(false);

let appWindow: Awaited<
  ReturnType<typeof import("@tauri-apps/api/webviewWindow").getCurrentWebviewWindow>
> | null = null;

onMounted(async () => {
  try {
    const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    appWindow = getCurrentWebviewWindow();
    isMaximized.value = await appWindow.isMaximized();
    appWindow.onResized(async () => {
      isMaximized.value = await appWindow?.isMaximized();
    });
  } catch {
    appWindow = null;
  }
});

async function minimize() {
  await appWindow?.minimize();
}

async function toggleMaximize() {
  if (!appWindow) {
    return;
  }

  if (isMaximized.value) {
    await appWindow.unmaximize();
    isMaximized.value = false;
    return;
  }

  await appWindow.maximize();
  isMaximized.value = true;
}

async function close() {
  await appWindow?.close();
}
</script>

<template>
  <div
    class="flex h-screen flex-col overflow-hidden bg-background dark select-none"
    style="-webkit-app-region: drag"
  >
    <div
      class="flex h-10 shrink-0 items-center justify-between border-b border-border bg-background px-2"
    >
      <div class="flex items-center gap-2 px-2 text-sm text-foreground/85">
        <component :is="activeMeta.icon" class="size-4 text-muted-foreground" />
        <span class="font-medium">{{ activeMeta.windowTitle }}</span>
      </div>

      <div class="flex items-center" style="-webkit-app-region: no-drag">
        <button
          class="flex h-9 w-10 items-center justify-center text-muted-foreground/50 transition-colors hover:bg-surface-2 hover:text-foreground"
          @click="minimize"
        >
          <Minus class="size-3" />
        </button>
        <button
          class="flex h-9 w-10 items-center justify-center text-muted-foreground/50 transition-colors hover:bg-surface-2 hover:text-foreground"
          @click="toggleMaximize"
        >
          <Maximize2 v-if="!isMaximized" class="size-3" />
          <Minimize2 v-else class="size-3" />
        </button>
        <button
          class="flex h-9 w-10 items-center justify-center text-muted-foreground/50 transition-colors hover:bg-destructive/80 hover:text-destructive-foreground"
          @click="close"
        >
          <X class="size-3" />
        </button>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-hidden" style="-webkit-app-region: no-drag">
      <DockTabContent :tab="activeTab" />
    </div>
  </div>
</template>
