<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RefreshCw } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import { useTargetsStore } from "@/stores/targets.store";
import DevtoolsState from "./DevtoolsState.vue";
import { useDevtoolsAddress } from "./useDevtoolsAddress";
import { useLocalDevtoolsView } from "./useLocalDevtoolsView";

/**
 * The full Chrome DevTools of the selected page, docked: a tab on This PC or a phone's WebView,
 * over USB or Wi-Fi. Each says plainly when there is nothing to attach to.
 */
const targets = useTargetsStore();
const { subject, url, error, resolving, retry } = useDevtoolsAddress();

const host = ref<HTMLElement | null>(null);
const viewFailure = ref<string | null>(null);
const failure = computed(() => error.value ?? viewFailure.value);

const source = computed(() => targets.selectedTarget?.source ?? null);

watch(url, () => {
  viewFailure.value = null;
});

function tryAgain() {
  viewFailure.value = null;
  void retry();
}

useLocalDevtoolsView(
  computed(() => (url.value && !failure.value ? host.value : null)),
  url,
  (message) => {
    viewFailure.value = message;
  },
);
</script>

<template>
  <div class="relative h-full w-full bg-surface-0">
    <DevtoolsState
      v-if="source === 'chrome'"
      title="This tab already has Chrome's DevTools"
      text="Open DevTools in Chrome itself for this tab. Docked DevTools covers pages on This PC and phones."
    />
    <DevtoolsState
      v-else-if="source === 'local' && !subject"
      title="Open a page to inspect it"
      text="Chrome DevTools follows the tab open on This PC."
    />
    <DevtoolsState
      v-else-if="source === 'adb' && !subject"
      title="This app has no WebView to inspect"
      text="Chrome DevTools attaches to web content. Open a screen of the app that shows a WebView, then pick it."
    />
    <DevtoolsState v-else-if="failure" title="DevTools could not open" :text="failure">
      <Button size="sm" variant="transparent" @click="tryAgain">
        <RefreshCw :size="12" :stroke-width="1.8" aria-hidden="true" />
        Try again
      </Button>
    </DevtoolsState>
    <DevtoolsState v-else-if="resolving || !url" title="Connecting DevTools to the page" loading />
    <div v-else ref="host" class="absolute inset-0" aria-label="Chrome DevTools" />
  </div>
</template>
