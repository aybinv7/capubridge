<script setup lang="ts">
import { ref, onMounted, shallowRef } from "vue";
import type { Component } from "vue";
import type { InspectPlugin } from "./types";

const props = defineProps<{
  plugin: InspectPlugin;
  cdpWsUrl: string;
}>();

const PluginComponent = shallowRef<Component | null>(null);
const loadError = ref<string | null>(null);

onMounted(async () => {
  try {
    PluginComponent.value = await props.plugin.component();
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
  }
});
</script>

<template>
  <div class="h-full flex flex-col">
    <div v-if="loadError" class="flex-1 flex items-center justify-center text-sm text-red-400">
      Failed to load {{ plugin.name }}: {{ loadError }}
    </div>
    <component
      v-else-if="PluginComponent"
      :is="PluginComponent"
      :cdp-ws-url="cdpWsUrl"
      class="flex-1"
    />
    <div v-else class="flex-1 flex items-center justify-center text-sm text-muted-foreground/40">
      Loading {{ plugin.name }}...
    </div>
  </div>
</template>
