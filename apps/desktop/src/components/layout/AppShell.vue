<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import TitleBar from "./TitleBar.vue";
import Sidebar from "./Sidebar.vue";
import ConnectionBar from "./ConnectionBar.vue";
import StatusBar from "./StatusBar.vue";
import CommandPalette from "@/components/CommandPalette.vue";

const commandPaletteOpen = ref(false);

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
  <div class="flex flex-col h-screen overflow-hidden bg-surface-0">
    <TitleBar />
    <div class="flex flex-1 overflow-hidden">
      <Sidebar />

      <div class="flex flex-1 flex-col overflow-hidden">
        <ConnectionBar @open-command-palette="commandPaletteOpen = true" />

        <main
          class="flex-1 overflow-hidden bg-surface-1 rounded-tl-xl border-t border-l border-border/30"
        >
          <RouterView />
        </main>

        <StatusBar />
      </div>
    </div>
  </div>

  <CommandPalette :open="commandPaletteOpen" @close="commandPaletteOpen = false" />
</template>
