<script setup lang="ts">
import { computed, markRaw, ref, watch } from "vue";
import type { Component } from "vue";
import { useRoute } from "vue-router";
import { RefreshCw } from "lucide-vue-next";
import { useInspectPlugins } from "./useInspectPlugins";

const route = useRoute();
const inspectPlugins = useInspectPlugins();

const PluginComponent = ref<Component | null>(null);
const loadError = ref<string | null>(null);
const isLoading = ref(false);

const routeSegment = computed(() =>
  typeof route.params.pluginId === "string" ? route.params.pluginId : "",
);
const plugin = computed(() => inspectPlugins.getPluginByRouteSegment(routeSegment.value));
const isDetected = computed(() =>
  plugin.value ? inspectPlugins.isPluginEnabled(plugin.value.id) : false,
);

async function loadPluginComponent() {
  if (!plugin.value) {
    PluginComponent.value = null;
    loadError.value = null;
    return;
  }

  isLoading.value = true;
  loadError.value = null;

  try {
    const component = await plugin.value.component();
    PluginComponent.value = markRaw(component);
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error);
    PluginComponent.value = null;
  } finally {
    isLoading.value = false;
  }
}

async function refreshDetection() {
  await inspectPlugins.refreshPlugins();
}

watch(
  plugin,
  () => {
    void loadPluginComponent();
  },
  { immediate: true },
);
</script>

<template>
  <div
    class="h-full w-full flex items-center justify-center bg-surface-0 text-sm text-muted-foreground/70"
  >
    <div v-if="!plugin" class="text-center">Unknown inspect plugin.</div>
    <div v-else-if="loadError" class="text-center text-error">
      Failed to load {{ plugin.name }} plugin: {{ loadError }}
    </div>
    <div v-else-if="!isDetected" class="text-center">
      <div>{{ plugin.name }} runtime not detected on current target.</div>
      <button
        class="mt-3 inline-flex items-center gap-2 rounded-lg border border-border/40 bg-surface-2 px-3 py-1.5 text-xs text-foreground/80 transition-colors hover:bg-surface-3"
        :disabled="inspectPlugins.isDetecting.value"
        @click="refreshDetection"
      >
        <RefreshCw :size="12" :class="inspectPlugins.isDetecting ? 'animate-spin' : ''" />
        Re-check
      </button>
    </div>
    <div v-else-if="isLoading" class="text-center">Loading {{ plugin.name }}...</div>
    <component v-else-if="PluginComponent" :is="PluginComponent" class="h-full w-full" />
  </div>
</template>
