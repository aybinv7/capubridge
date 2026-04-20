<script setup lang="ts">
import { computed } from "vue";
import AssistantTab from "./tabs/AssistantTab.vue";
import ExceptionsTab from "./tabs/ExceptionsTab.vue";
import LogcatTab from "./tabs/LogcatTab.vue";
import OutputTab from "./tabs/OutputTab.vue";
import ReplTab from "./tabs/ReplTab.vue";
import type { DockTab } from "@/types/dock.types";

const props = defineProps<{
  tab: DockTab;
}>();

const componentsByTab = {
  assistant: AssistantTab,
  logcat: LogcatTab,
  repl: ReplTab,
  output: OutputTab,
  exceptions: ExceptionsTab,
} as const;

const activeComponent = computed(() => componentsByTab[props.tab]);
</script>

<template>
  <component :is="activeComponent" class="h-full" />
</template>
