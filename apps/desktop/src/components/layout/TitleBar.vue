<script setup lang="ts">
import { Minus, Maximize2, Minimize2, X } from "lucide-vue-next";
import { ref, onMounted } from "vue";

const isMaximized = ref(false);
let appWindow: any = null;

onMounted(async () => {
  try {
    const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    appWindow = getCurrentWebviewWindow();
    await appWindow.isMaximized();
    appWindow.onResized(async () => {
      isMaximized.value = await appWindow.isMaximized();
    });
  } catch {
    appWindow = null;
  }
});

async function minimize() {
  if (!appWindow) return;
  await appWindow.minimize();
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
  if (!appWindow) return;
  await appWindow.close();
}
</script>

<template>
  <div
    class="h-8 shrink-0 flex items-center justify-between px-3 bg-surface-0 select-none"
    style="-webkit-app-region: drag"
  >
    <div class="flex items-center gap-2">
      <span class="text-2xs font-medium text-muted-foreground/60">Capubridge</span>
    </div>
    <div class="flex items-center" style="-webkit-app-region: no-drag">
      <button
        class="w-10 h-8 flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-surface-2/50 transition-colors"
        @click="minimize"
      >
        <Minus class="w-3.5 h-3.5" />
      </button>
      <button
        class="w-10 h-8 flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-surface-2/50 transition-colors"
        @click="toggleMaximize"
      >
        <Maximize2 v-if="!isMaximized" class="w-3 h-3" />
        <Minimize2 v-else class="w-3 h-3" />
      </button>
      <button
        class="w-10 h-8 flex items-center justify-center text-muted-foreground/60 hover:text-error hover:bg-error/10 transition-colors"
        @click="close"
      >
        <X class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</template>
