<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import TitleBar from "./TitleBar.vue";
import ConnectionBar from "./ConnectionBar.vue";
import Sidebar from "./Sidebar.vue";
import StatusBar from "./StatusBar.vue";
import CommandPalette from "@/components/CommandPalette.vue";
import MirrorPanel from "@/modules/mirror/MirrorPanel.vue";
import { useMirrorStore } from "@/stores/mirror.store";

const commandPaletteOpen = ref(false);
const mirrorStore = useMirrorStore();

const showMirrorLeft = computed(
  () => mirrorStore.isOpen && !mirrorStore.isDetached && mirrorStore.side === "left",
);
const showMirrorRight = computed(
  () => mirrorStore.isOpen && !mirrorStore.isDetached && mirrorStore.side === "right",
);

function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault();
    commandPaletteOpen.value = true;
  }
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden bg-background dark">
    <!-- Title bar with window controls -->
    <TitleBar @open-command-palette="commandPaletteOpen = true" />

    <!-- Main area: [mirror-left?] + sidebar + content + [mirror-right?] -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Mirror panel on left -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        leave-active-class="transition-all duration-150 ease-in"
        enter-from-class="opacity-0 -translate-x-full"
        leave-to-class="opacity-0 -translate-x-full"
      >
        <MirrorPanel v-if="showMirrorLeft" />
      </Transition>

      <!-- Sidebar -->
      <Sidebar />

      <!-- Content column -->
      <div
        class="flex flex-1 flex-col border-t border-l border-border/40 rounded-tl-2xl overflow-hidden bg-surface-1 min-w-0"
      >
        <main class="flex-1 overflow-hidden">
          <RouterView />
        </main>

        <StatusBar />
      </div>

      <!-- Mirror panel on right -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        leave-active-class="transition-all duration-150 ease-in"
        enter-from-class="opacity-0 translate-x-full"
        leave-to-class="opacity-0 translate-x-full"
      >
        <MirrorPanel v-if="showMirrorRight" />
      </Transition>
    </div>
  </div>

  <CommandPalette :open="commandPaletteOpen" @close="commandPaletteOpen = false" />
</template>
