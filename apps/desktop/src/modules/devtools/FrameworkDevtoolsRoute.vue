<script setup lang="ts">
import { computed, defineAsyncComponent, toRef } from "vue";
import { RefreshCw } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import DevtoolsState from "./DevtoolsState.vue";
import { FRAMEWORK_NAMES, type Framework } from "./frameworkDetection";
import { useFrameworkDetection } from "./useFrameworkDetection";

/**
 * The Vue or React tab: the framework's own DevTools when the page runs it, and a plain answer
 * when it does not, instead of hiding the tab and leaving the reason to guess.
 */
const props = defineProps<{ framework: Framework }>();

const PANELS = {
  vue: defineAsyncComponent(() => import("./VueDevtoolsPanel.vue")),
  react: defineAsyncComponent(() => import("./ReactDevtoolsPanel.vue")),
} as const;

const { state, check } = useFrameworkDetection(toRef(props, "framework"));
const name = computed(() => FRAMEWORK_NAMES[props.framework]);
const panel = computed(() => PANELS[props.framework]);
</script>

<template>
  <component :is="panel" v-if="state === 'present'" class="h-full w-full" />
  <DevtoolsState
    v-else-if="state === 'checking'"
    :title="`Looking for ${name} on this page`"
    loading
  />
  <DevtoolsState
    v-else-if="state === 'absent'"
    :title="`This page has no ${name} app`"
    :text="`Capubridge looked for a mounted ${name} app and found none. If the page is still starting, check again once it has loaded.`"
  >
    <Button size="sm" variant="transparent" @click="check">
      <RefreshCw :size="12" :stroke-width="1.8" aria-hidden="true" />
      Check again
    </Button>
  </DevtoolsState>
  <DevtoolsState
    v-else
    :title="`Could not look for ${name}`"
    text="The page did not answer. Bring it to the front, or pick it again, then check again."
  >
    <Button size="sm" variant="transparent" @click="check">
      <RefreshCw :size="12" :stroke-width="1.8" aria-hidden="true" />
      Check again
    </Button>
  </DevtoolsState>
</template>
