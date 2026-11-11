<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useDevtoolsSettingsStore } from "@/stores/devtoolsSettings.store";
import { useTargetsStore } from "@/stores/targets.store";
import { useThisPcBrowserStore } from "@/stores/thisPcBrowser.store";
import DevtoolsState from "./DevtoolsState.vue";
import { inspectorUrlFor, withScreencast } from "./inspectorUrl";
import { useLocalDevtoolsView } from "./useLocalDevtoolsView";

/**
 * The full Chrome DevTools of the selected page. On This PC it is the engine's own DevTools,
 * docked here; phones get theirs next, and say so rather than showing an empty pane.
 */
const targets = useTargetsStore();
const thisPc = useThisPcBrowserStore();
const settings = useDevtoolsSettingsStore();

const host = ref<HTMLElement | null>(null);
const failure = ref<string | null>(null);

const source = computed(() => targets.selectedTarget?.source ?? null);
const tab = computed(() => (thisPc.showingNewTab ? null : thisPc.selectedTab));
const inspectorUrl = computed(() => {
  const socket = tab.value?.webSocketDebuggerUrl;
  const base = socket ? inspectorUrlFor(socket) : null;
  return base ? withScreencast(base, !settings.hideScreencast) : null;
});

watch(inspectorUrl, () => {
  failure.value = null;
});

useLocalDevtoolsView(
  computed(() => (tab.value && inspectorUrl.value && !failure.value ? host.value : null)),
  inspectorUrl,
  (message) => {
    failure.value = message;
  },
);
</script>

<template>
  <div class="relative h-full w-full bg-surface-0">
    <DevtoolsState
      v-if="source === 'adb'"
      title="Chrome DevTools for phones comes next"
      text="On a phone, Elements, Network, Data and the Vue and React tabs work today. Full DevTools works on pages on This PC."
    />
    <DevtoolsState
      v-else-if="source === 'chrome'"
      title="This tab already has Chrome's DevTools"
      text="Open DevTools in Chrome itself for this tab. Docked DevTools here works on pages on This PC."
    />
    <DevtoolsState
      v-else-if="!tab"
      title="Open a page to inspect it"
      text="Chrome DevTools follows the tab open on This PC."
    />
    <DevtoolsState v-else-if="failure" title="DevTools could not open" :text="failure" />
    <DevtoolsState v-else-if="!inspectorUrl" title="Connecting DevTools to the page" loading />
    <div v-else ref="host" class="absolute inset-0" aria-label="Chrome DevTools" />
  </div>
</template>
