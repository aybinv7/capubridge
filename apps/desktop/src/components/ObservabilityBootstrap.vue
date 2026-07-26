<script setup lang="ts">
import { onMounted, onUnmounted, watch } from "vue";
import { useNetwork } from "@/composables/useNetwork";
import { useConsoleStore } from "@/stores/console.store";

const consoleStore = useConsoleStore();

useNetwork();

onMounted(() => {
  void consoleStore.initialize();
  void consoleStore.acquireLease();
});

watch(
  () => consoleStore.activeTarget,
  (target) => {
    void consoleStore.syncLease(target ?? null);
  },
);

onUnmounted(() => {
  void consoleStore.releaseLease();
});
</script>

<template></template>
