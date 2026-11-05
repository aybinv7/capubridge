<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Plus, X } from "lucide-vue-next";
import { Button, Input, Popover, Segmented, SegmentedButton, Select } from "@capubridge/cladd";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { GridColumn } from "../grid/types";
import {
  operatorInfo,
  operatorsFor,
  valueKindFor,
  type DataPredicate,
  type PredicateJoin,
  type PredicateOperator,
} from "./predicates";

/**
 * Conditions on columns, edited as a draft: nothing changes until Apply, and closing the
 * popover drops the draft. The value field follows the column type (date, number or text).
 */
const props = defineProps<{
  columns: readonly GridColumn[];
  predicates: readonly DataPredicate[];
  join: PredicateJoin;
  anchor: HTMLElement | null;
  /** Column to start a new condition on when the popover opens from a header menu. */
  seedColumn?: string | null;
}>();

const open = defineModel<boolean>("open", { required: true });

const emit = defineEmits<{ apply: [predicates: DataPredicate[], join: PredicateJoin] }>();

const draft = ref<DataPredicate[]>([]);
const draftJoin = ref<PredicateJoin>("and");
let nextId = 0;

const columnOptions = computed(() =>
  props.columns.map((column) => ({ value: column.id, label: column.title })),
);
const typeById = computed(() => new Map(props.columns.map((column) => [column.id, column.type])));

function freshPredicate(columnId: string): DataPredicate {
  const operator = operatorsFor(typeById.value.get(columnId))[0] ?? "contains";
  nextId += 1;
  return { id: `p${nextId}`, columnId, operator, value: "" };
}

watch(open, (isOpen) => {
  if (!isOpen) return;
  draft.value = props.predicates.map((predicate) => ({ ...predicate }));
  draftJoin.value = props.join;
  const seed = props.seedColumn ?? null;
  if (seed) draft.value.push(freshPredicate(seed));
  if (draft.value.length === 0 && props.columns[0]) {
    draft.value.push(freshPredicate(props.columns[0].id));
  }
});

function operatorOptions(columnId: string) {
  return operatorsFor(typeById.value.get(columnId)).map((id) => ({
    value: id,
    label: operatorInfo(id).label,
  }));
}

function setColumn(predicate: DataPredicate, value: unknown) {
  if (typeof value !== "string") return;
  predicate.columnId = value;
  const allowed = operatorsFor(typeById.value.get(value));
  if (!allowed.includes(predicate.operator)) predicate.operator = allowed[0] ?? "contains";
}

function setOperator(predicate: DataPredicate, value: unknown) {
  if (typeof value === "string") predicate.operator = value as PredicateOperator;
}

function inputType(predicate: DataPredicate): string {
  const kind = valueKindFor(typeById.value.get(predicate.columnId), predicate.operator);
  return kind === "date" ? "date" : "text";
}

function add() {
  const last = draft.value[draft.value.length - 1];
  draft.value.push(freshPredicate(last?.columnId ?? props.columns[0]?.id ?? ""));
}

function remove(id: string) {
  draft.value = draft.value.filter((predicate) => predicate.id !== id);
}

function apply() {
  emit(
    "apply",
    draft.value.map((predicate) => ({ ...predicate })),
    draftJoin.value,
  );
  open.value = false;
}

function clearAll() {
  emit("apply", [], draftJoin.value);
  open.value = false;
}
</script>

<template>
  <Popover
    v-model:open="open"
    :anchor-element="anchor ?? undefined"
    position="bottom-start"
    :offset="6"
    class="w-[34rem] max-w-[calc(100vw-32px)]"
    content-class-name="w-full p-3"
    aria-label="Filter rows"
  >
    <div class="flex flex-col gap-3" @keydown.enter.prevent="apply">
      <div class="flex items-center gap-2">
        <p class="text-sm font-medium text-foreground">Show rows where</p>
        <Segmented
          v-if="draft.length > 1"
          size="xs"
          active-variant="solid"
          aria-label="How conditions combine"
        >
          <SegmentedButton :active="draftJoin === 'and'" @click="draftJoin = 'and'">
            all match
          </SegmentedButton>
          <SegmentedButton :active="draftJoin === 'or'" @click="draftJoin = 'or'">
            any matches
          </SegmentedButton>
        </Segmented>
      </div>

      <ul class="flex flex-col gap-1.5">
        <li v-for="predicate in draft" :key="predicate.id" class="flex items-center gap-1.5">
          <Select
            :model-value="predicate.columnId"
            :options="columnOptions"
            size="sm"
            :keyboard-hints="false"
            aria-label="Column"
            class="w-36 shrink-0"
            @update:model-value="setColumn(predicate, $event)"
          />
          <Select
            :model-value="predicate.operator"
            :options="operatorOptions(predicate.columnId)"
            size="sm"
            :keyboard-hints="false"
            aria-label="Condition"
            class="w-40 shrink-0"
            @update:model-value="setOperator(predicate, $event)"
          />
          <Input
            v-if="operatorInfo(predicate.operator).takesValue"
            v-model="predicate.value"
            :type="inputType(predicate)"
            size="sm"
            aria-label="Value"
            placeholder="Value"
            class="min-w-0 flex-1"
            input-class-name="font-mono"
          />
          <span v-else class="min-w-0 flex-1" />
          <IconAction label="Remove this condition" size="sm" @click="remove(predicate.id)">
            <X :stroke-width="1.8" />
          </IconAction>
        </li>
      </ul>

      <div class="flex items-center gap-2">
        <Button size="sm" variant="transparent" @click="add">
          <Plus :size="12" aria-hidden="true" />
          Add a condition
        </Button>
        <span class="flex-1" />
        <Button v-if="predicates.length > 0" size="sm" variant="transparent" @click="clearAll">
          Clear filters
        </Button>
        <Button size="sm" variant="solid-fill" @click="apply">Apply</Button>
      </div>
    </div>
  </Popover>
</template>
