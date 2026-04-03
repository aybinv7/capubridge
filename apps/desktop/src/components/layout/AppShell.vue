<script setup lang="ts">
import Sidebar from "./Sidebar.vue";
import ConnectionBar from "./ConnectionBar.vue";
import StatusBar from "./StatusBar.vue";
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-surface-0">
    <Sidebar />

    <div class="flex flex-1 flex-col overflow-hidden">
      <ConnectionBar />

      <main
        class="flex-1 overflow-hidden bg-surface-1 rounded-tl-xl border-t border-l border-border/30"
      >
        <RouterView />
      </main>

      <StatusBar />
    </div>
  </div>
</template>
