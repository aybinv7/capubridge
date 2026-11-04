<script setup lang="ts">
import { computed } from "vue";
import WorkbenchGate from "@/components/gate/WorkbenchGate.vue";
import GateStrip from "@/components/gate/GateStrip.vue";
import { useGate } from "@/composables/useGate";
import { useActiveContextStore } from "@/stores/activeContext.store";
import { degradedCopy, noticeCopy } from "@/lib/gates/copy";
import type { GateRequirement } from "@/lib/gates/types";

const props = withDefaults(
  defineProps<{
    requirement: GateRequirement;
    density?: "full" | "compact";
  }>(),
  { density: "full" },
);

const context = useActiveContextStore();
const { result, subject, mode } = useGate(() => props.requirement);

const blockedKind = computed(() => (result.value.kind === "open" ? null : result.value.kind));

const strip = computed(() => {
  const kind = blockedKind.value;
  if (mode.value === "degraded" && kind) {
    return degradedCopy(kind, context.gateInput, props.requirement);
  }
  const notice = result.value.notice;
  return notice && mode.value === "open" ? noticeCopy(notice, context.gateInput) : null;
});
</script>

<template>
  <WorkbenchGate
    v-if="mode === 'blocked' && blockedKind"
    :requirement="requirement"
    :kind="blockedKind"
    :density="density"
  />
  <div v-else class="flex h-full min-h-0 flex-col" :data-gate-mode="mode">
    <GateStrip v-if="strip" :content="strip" :stale="mode === 'degraded'" />
    <div :key="subject" class="min-h-0 flex-1 overflow-hidden">
      <slot />
    </div>
  </div>
</template>
