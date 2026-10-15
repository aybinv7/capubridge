<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";
import type { Flow } from "@/types/automation.types";
import type { RunViewStep } from "./runSource";
import { buildStepRows, canEditStructure, flattenRows, failingRowIndex } from "./stepRowModel";
import type { FlatRow, MoveDirection } from "./stepRowModel";
import StepRow from "./StepRow.vue";

const props = defineProps<{
  flow: Flow;
  runSteps: RunViewStep[] | null;
  selectedStepId: string | null;
  isRunning: boolean;
}>();

const emit = defineEmits<{
  select: [stepId: string];
  move: [stepId: string, direction: MoveDirection];
  delete: [stepId: string];
}>();

/**
 * Structure editing is off while a run executes and while a recorded run is
 * open. A run in flight is being walked by the executor; a recorded run is
 * evidence, and editing it would make the trace describe a flow that never ran.
 */
const canEdit = computed(() =>
  canEditStructure({ isRunning: props.isRunning, hasRun: props.runSteps !== null }),
);

const scrollContainerRef = ref<HTMLDivElement | null>(null);

const rows = computed(() => buildStepRows(props.flow, props.runSteps));
const flatRows = computed(() => flattenRows(rows.value));

const virtualizer = useVirtualizer(
  computed(() => ({
    count: flatRows.value.length,
    getScrollElement: () => scrollContainerRef.value,
    estimateSize: () => 40,
    overscan: 10,
  })),
);

const virtualItems = computed(() => virtualizer.value.getVirtualItems());

watch(
  () => props.runSteps,
  () => {
    if (props.isRunning && scrollContainerRef.value !== null) {
      const el = scrollContainerRef.value;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      if (isNearBottom) {
        virtualizer.value.scrollToIndex(flatRows.value.length - 1, { align: "end" });
      }
    }
  },
  { flush: "post" },
);

function selectFailing(): void {
  const index = failingRowIndex(rows.value);
  if (index !== null) {
    const flatIndex = flatRows.value.findIndex((f) => f.row.index === index);
    if (flatIndex >= 0) {
      virtualizer.value.scrollToIndex(flatIndex);
      emit("select", flatRows.value[flatIndex]?.row.stepId ?? "");
    }
  }
}

defineExpose({ selectFailing });
</script>

<template>
  <div ref="scrollContainerRef" class="h-full overflow-auto">
    <div :style="{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }">
      <div
        v-for="virtualRow in virtualItems"
        :key="virtualRow.key"
        :style="{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          transform: `translateY(${virtualRow.start}px)`,
        }"
      >
        <StepRow
          :row="flatRows[virtualRow.index]?.row ?? flatRows[0]?.row"
          :depth="flatRows[virtualRow.index]?.depth ?? 0"
          :selected="flatRows[virtualRow.index]?.row.stepId === selectedStepId"
          :is-running="isRunning"
          :can-edit="canEdit"
          @select="(id) => emit('select', id)"
          @move="(id, direction) => emit('move', id, direction)"
          @delete="(id) => emit('delete', id)"
        />
      </div>
    </div>
    <div
      v-if="flatRows.length === 0"
      class="flex h-full items-center justify-center p-8 text-center"
    >
      <p class="text-sm text-muted-foreground">No steps in this flow. Add steps to get started.</p>
    </div>
  </div>
</template>
