<script setup lang="ts">
import { onMounted, onUnmounted, watch } from "vue";
import { useDockTargetRelay } from "@/composables/useDockTargetRelay";
import { useLogcatCapture } from "@/composables/useLogcatCapture";
import { useNetwork } from "@/composables/useNetwork";
import { useConsoleStore } from "@/stores/console.store";

const consoleStore = useConsoleStore();

function report(prefix: string, error: unknown) {
  consoleStore.error = `${prefix}: ${error instanceof Error ? error.message : String(error)}`;
}

useNetwork();
useLogcatCapture();
useDockTargetRelay((message) => {
  consoleStore.error = message;
});

onMounted(() => {
  consoleStore.acquireLease().catch((error: unknown) => report("Console capture failed", error));
});

watch(
  () => consoleStore.activeTarget,
  (target) => {
    consoleStore
      .syncLease(target ?? null)
      .catch((error: unknown) => report("Console capture failed", error));
  },
);

onUnmounted(() => {
  consoleStore
    .releaseLease()
    .catch((error: unknown) => report("Console capture did not stop cleanly", error));
});
</script>

<template></template>
