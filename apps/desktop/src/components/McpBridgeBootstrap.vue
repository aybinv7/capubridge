<script setup lang="ts">
// Renderless: wires up the MCP → frontend bridge listener so MCP tools like
// select_target can drive the app UI. Mounted once in the main app window only.
import { onMounted, onBeforeUnmount } from "vue";
import { useMcpBridge } from "@/composables/useMcpBridge";

const bridge = useMcpBridge();
let unlisten: (() => void) | null = null;

onMounted(async () => {
  unlisten = await bridge.start();
});

onBeforeUnmount(() => {
  unlisten?.();
  unlisten = null;
});
</script>

<template>
  <span aria-hidden="true" class="hidden" />
</template>
