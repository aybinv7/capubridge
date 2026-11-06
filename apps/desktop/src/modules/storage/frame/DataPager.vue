<script setup lang="ts">
import { computed } from "vue";
import { ChevronLeft, ChevronRight } from "lucide-vue-next";
import { Select } from "@capubridge/cladd";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";

/** Rows past this offset make the device walk every earlier record, so the pager says so. */
const SLOW_OFFSET = 5_000;

const props = withDefaults(
  defineProps<{
    page: number;
    pageSize: number;
    hasMore: boolean;
    rowsOnPage: number;
    total?: number | null;
    sizes?: readonly number[];
  }>(),
  { total: null, sizes: () => [50, 100, 500] },
);

const emit = defineEmits<{ "update:page": [page: number]; "update:pageSize": [size: number] }>();

const first = computed(() => props.page * props.pageSize);
const range = computed(() => {
  if (props.rowsOnPage === 0) return props.page === 0 ? "No rows" : `Page ${props.page + 1}`;
  const start = (first.value + 1).toLocaleString("en-US");
  const end = (first.value + props.rowsOnPage).toLocaleString("en-US");
  const total = props.total === null ? "" : ` of ${props.total.toLocaleString("en-US")}`;
  return `${start}–${end}${total}`;
});
const slow = computed(() => first.value >= SLOW_OFFSET);
const sizeOptions = computed(() =>
  props.sizes.map((size) => ({ value: size, label: `${size} a page` })),
);
const sizeModel = computed({
  get: () => props.pageSize,
  set: (value: unknown) => {
    if (typeof value === "number") emit("update:pageSize", value);
  },
});
</script>

<template>
  <div class="flex items-center gap-1">
    <HintTooltip
      :text="
        slow
          ? 'The phone reads every earlier record to reach this page, so far pages are slow on big stores.'
          : null
      "
    >
      <span class="font-mono text-2xs tabular-nums" :class="slow ? 'text-warning' : ''">
        {{ range }}
      </span>
    </HintTooltip>
    <IconAction
      label="Previous page"
      size="sm"
      :disabled="page === 0"
      @click="emit('update:page', page - 1)"
    >
      <ChevronLeft :stroke-width="1.8" />
    </IconAction>
    <IconAction
      label="Next page"
      size="sm"
      :disabled="!hasMore"
      @click="emit('update:page', page + 1)"
    >
      <ChevronRight :stroke-width="1.8" />
    </IconAction>
    <Select
      v-model="sizeModel"
      :options="sizeOptions"
      size="xs"
      variant="transparent"
      :outline="false"
      :keyboard-hints="false"
      popover-position="top-start"
      aria-label="Rows per page"
      class="w-auto shrink-0 text-muted-foreground"
    >
      {{ pageSize }} a page
    </Select>
  </div>
</template>
