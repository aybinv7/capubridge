<script setup lang="ts">
import { Segmented, SegmentedButton } from "@capubridge/cladd";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import { SEGMENT_TEXT } from "@/shared/components/presentation/segmentText";
import { useNetworkStore } from "../stores/useNetworkStore";
import { TYPE_FILTERS } from "./requestFilters";

const props = defineProps<{ summary: string }>();

const store = useNetworkStore();

defineSlots<{ default?: () => unknown }>();
</script>

<template>
  <div class="flex shrink-0 items-center gap-3 border-b border-border-subtle px-3 py-1.5">
    <div class="min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
      <Segmented
        size="sm"
        active-variant="solid"
        aria-label="Show requests of this type"
        class="w-max"
      >
        <HintTooltip v-for="option in TYPE_FILTERS" :key="option.value" :text="option.hint">
          <SegmentedButton
            :active="store.typeFilter === option.value"
            :class="SEGMENT_TEXT"
            @click="store.typeFilter = option.value"
          >
            {{ option.label }}
          </SegmentedButton>
        </HintTooltip>
      </Segmented>
    </div>
    <span class="shrink-0 font-mono text-2xs text-[var(--fg-subtle)] tabular-nums">
      {{ props.summary }}
    </span>
    <slot />
  </div>
</template>
