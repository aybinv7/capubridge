<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import TitleBar from "./TitleBar.vue";
import ConnectionBar from "./ConnectionBar.vue";
import Sidebar from "./Sidebar.vue";
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
  <div class="flex flex-col h-screen overflow-hidden bg-background dark">
    <!-- Title bar with window controls -->
    <TitleBar @open-command-palette="commandPaletteOpen = true" />

    <!-- Main area: sidebar + content -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Sidebar -->
      <Sidebar />

      <!-- Content column -->
      <div
        class="flex flex-1 flex-col border-t border-l rounded-tl-xl overflow-hidden bg-[#151515]"
      >
        <main class="flex-1 overflow-hidden">
          <RouterView />
        </main>

        <StatusBar />
      </div>
    </div>
  </div>

  <CommandPalette :open="commandPaletteOpen" @close="commandPaletteOpen = false" />
</template>
