<script setup lang="ts">
import { computed } from "vue";
import WorkbenchGate from "@/components/gate/WorkbenchGate.vue";
import GateStrip from "@/components/gate/GateStrip.vue";
import { useGate } from "@/composables/useGate";
import { useAppPackages } from "@/composables/useAppPackages";
import { useActiveContextStore } from "@/stores/activeContext.store";
import { degradedCopy, noticeCopy } from "@/lib/gates/copy";
import type { GateRequirement } from "@/lib/gates/types";

const props = withDefaults(
  defineProps<{
    requirement: GateRequirement;
    density?: "full" | "compact";
    secondary?: { commandId: string; label: string; hint?: string };
  }>(),
  { density: "full" },
);

const context = useActiveContextStore();
const { result, subject, mode } = useGate(() => props.requirement);

const serial = computed(() => context.device?.serial ?? "");
const { getCachedPackage } = useAppPackages(serial);
const appLabel = computed(() => {
  const packageName = context.gateInput.target?.packageName;
  return packageName ? (getCachedPackage(packageName)?.label ?? null) : null;
});

const blockedKind = computed(() => (result.value.kind === "open" ? null : result.value.kind));

const strip = computed(() => {
  const kind = blockedKind.value;
  if (mode.value === "degraded" && kind) {
    return degradedCopy(kind, context.gateInput, props.requirement);
  }
  const notice = result.value.notice;
  if (!notice || mode.value !== "open") return null;
  const copy = noticeCopy(notice, context.gateInput, appLabel.value);
  return { ...copy, actions: copy.actions.filter((action) => action !== "bring-to-front") };
});
</script>

<template>
  <WorkbenchGate
    v-if="mode === 'blocked' && blockedKind"
    :requirement="requirement"
    :kind="blockedKind"
    :density="density"
    :secondary="secondary"
  />
  <div v-else class="flex h-full min-h-0 flex-col" :data-gate-mode="mode">
    <GateStrip v-if="strip" :content="strip" :stale="mode === 'degraded'" />
    <div :key="subject" class="min-h-0 flex-1 overflow-hidden">
      <slot />
    </div>
  </div>
</template>
