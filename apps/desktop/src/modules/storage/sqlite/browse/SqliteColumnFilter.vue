<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Button, Input, Popover, Select } from "@capubridge/cladd";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import { columnFilter, type ColumnFilterOperator } from "./sqliteQuery";

const props = defineProps<{
  /** Column being filtered; `null` closes the form. */
  column: string | null;
  anchor: HTMLElement | null;
}>();

const emit = defineEmits<{ apply: [clause: string]; close: [] }>();

const OPERATORS: Array<{ value: ColumnFilterOperator; label: string; needsValue: boolean }> = [
  { value: "contains", label: "contains", needsValue: true },
  { value: "=", label: "equals", needsValue: true },
  { value: "!=", label: "does not equal", needsValue: true },
  { value: "starts", label: "starts with", needsValue: true },
  { value: "ends", label: "ends with", needsValue: true },
  { value: ">", label: "greater than", needsValue: true },
  { value: ">=", label: "at least", needsValue: true },
  { value: "<", label: "less than", needsValue: true },
  { value: "<=", label: "at most", needsValue: true },
  { value: "null", label: "is NULL", needsValue: false },
  { value: "not-null", label: "is not NULL", needsValue: false },
];

const operator = ref<ColumnFilterOperator>("contains");
const value = ref("");

const open = computed({
  get: () => props.column !== null,
  set: (next: boolean) => {
    if (!next) emit("close");
  },
});

watch(
  () => props.column,
  () => {
    operator.value = "contains";
    value.value = "";
  },
);

const needsValue = computed(
  () => OPERATORS.find((entry) => entry.value === operator.value)?.needsValue ?? true,
);
const preview = computed(() =>
  props.column && (!needsValue.value || value.value !== "")
    ? columnFilter(props.column, operator.value, value.value)
    : "",
);

function apply() {
  if (!preview.value) return;
  emit("apply", preview.value);
  emit("close");
}
</script>

<template>
  <Popover
    v-model:open="open"
    :anchor-element="anchor ?? undefined"
    position="bottom-start"
    content-class-name="w-80 p-3"
  >
    <form class="flex flex-col gap-2.5" @submit.prevent="apply">
      <p class="text-cladd-xs text-cladd-fg-soft">
        Filter <code class="font-mono text-cladd-fg">{{ column }}</code>
      </p>
      <div class="flex gap-2">
        <Select
          v-model="operator"
          size="sm"
          class="w-36 shrink-0"
          aria-label="Condition"
          :options="OPERATORS.map(({ value, label }) => ({ value, label }))"
        />
        <Input
          v-if="needsValue"
          v-model="value"
          size="sm"
          class="min-w-0 flex-1"
          placeholder="Value"
          autofocus
        />
      </div>
      <HintTooltip v-if="preview" :text="preview">
        <code
          tabindex="0"
          class="block truncate rounded-cladd-3xs bg-cladd-surface-cut px-2 py-1 font-mono text-cladd-2xs text-cladd-fg-soft"
          >{{ preview }}</code
        >
      </HintTooltip>
      <div class="flex justify-end gap-1.5">
        <Button
          size="sm"
          variant="transparent"
          :outline="false"
          type="button"
          @click="emit('close')"
        >
          Cancel
        </Button>
        <Button size="sm" variant="solid-fill" color="brand" type="submit" :disabled="!preview">
          Add filter
        </Button>
      </div>
    </form>
  </Popover>
</template>
