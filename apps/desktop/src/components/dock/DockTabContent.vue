<script setup lang="ts">
import { computed } from "vue";
import ConsoleTab from "./tabs/ConsoleTab.vue";
import ExceptionsTab from "./tabs/ExceptionsTab.vue";
import LogcatTab from "./tabs/LogcatTab.vue";
import ReplTab from "./tabs/ReplTab.vue";
import GatedView from "@/components/gate/GatedView.vue";
import type { GateRequirement } from "@/lib/gates/types";
import type { DockTab } from "@/types/dock.types";

const props = withDefaults(
  defineProps<{
    tab: DockTab;
    gated?: boolean;
  }>(),
  { gated: true },
);

const componentsByTab = {
  logcat: LogcatTab,
  repl: ReplTab,
  console: ConsoleTab,
  exceptions: ExceptionsTab,
} as const;

const requirementsByTab: Record<DockTab, GateRequirement> = {
  logcat: "device",
  repl: "target",
  console: "target",
  exceptions: "target",
};

const activeComponent = computed(() => componentsByTab[props.tab]);
const requirement = computed(() => (props.gated ? requirementsByTab[props.tab] : "none"));
</script>

<template>
  <GatedView :requirement="requirement" density="compact">
    <component :is="activeComponent" class="h-full" />
  </GatedView>
</template>
