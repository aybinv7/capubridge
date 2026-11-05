<script setup lang="ts">
import { Segmented, SegmentedButton } from "@capubridge/cladd";
import { useNetworkStore } from "../stores/useNetworkStore";
import { TYPE_FILTERS } from "./requestFilters";

const props = defineProps<{ summary: string }>();

const store = useNetworkStore();
</script>

<template>
  <div class="flex shrink-0 items-center gap-3 border-b border-border-subtle px-3 py-1.5">
    <div class="min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
      <Segmented size="sm" aria-label="Show requests of this type" class="w-max">
        <SegmentedButton
          v-for="option in TYPE_FILTERS"
          :key="option.value"
          :active="store.typeFilter === option.value"
          :title="option.hint"
          @click="store.typeFilter = option.value"
        >
          {{ option.label }}
        </SegmentedButton>
      </Segmented>
    </div>
    <span class="shrink-0 font-mono text-2xs text-[var(--fg-subtle)] tabular-nums">
      {{ props.summary }}
    </span>
  </div>
</template>
