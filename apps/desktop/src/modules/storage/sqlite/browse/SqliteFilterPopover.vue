<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { ListFilter } from "lucide-vue-next";
import {
  Button,
  FieldError,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Popover,
  Select,
} from "@capubridge/cladd";
import { toast } from "vue-sonner";
import KeyCaps from "@/components/command/KeyCaps.vue";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import { FILTER_OPERATORS, chipLabel } from "./sqliteFilters";
import { columnFilter, type ColumnFilterOperator } from "./sqliteQuery";
import type { SqliteTableQuery } from "./useSqliteTableQuery";

/**
 * Filtering beyond the search: one condition on a column (it becomes a chip), or a SQL WHERE
 * clause for anything else. Apply adds the condition and applies the WHERE; Enter in the WHERE
 * applies it, Esc puts back the applied one. A WHERE the database refuses shows its words here.
 */
const props = defineProps<{
  query: SqliteTableQuery;
  columns: readonly string[];
  /** Why the filters did not run, from the database. */
  error: string | null;
}>();

const open = ref(false);
const column = ref("");
const operator = ref<ColumnFilterOperator>("contains");
const value = ref("");
const where = ref(props.query.whereClause.value);
const form = ref<HTMLElement | null>(null);

watch(
  () => props.query.whereClause.value,
  (applied) => {
    where.value = applied;
  },
);

const needsValue = computed(
  () => FILTER_OPERATORS.find((entry) => entry.value === operator.value)?.needsValue ?? true,
);
const condition = computed(() => {
  if (!column.value || (needsValue.value && value.value === "")) return null;
  const typed = needsValue.value ? value.value : undefined;
  return {
    column: column.value,
    operator: operator.value,
    value: typed,
    label: chipLabel(column.value, operator.value, typed),
    sql: columnFilter(column.value, operator.value, typed),
  };
});
const whereChanged = computed(() => where.value.trim() !== props.query.whereClause.value);
const canApply = computed(() => condition.value !== null || whereChanged.value);
const active = computed(
  () => props.query.filters.value.length > 0 || props.query.whereClause.value !== "",
);

function focus(selector: string) {
  void nextTick(() =>
    requestAnimationFrame(() => form.value?.querySelector<HTMLElement>(selector)?.focus()),
  );
}

/** Opens on a column's condition (header menu "Filter"), or on the WHERE clause. */
function openFor(target: { column?: string; where?: boolean } = {}) {
  column.value = target.column ?? column.value ?? props.columns[0] ?? "";
  if (!column.value) column.value = props.columns[0] ?? "";
  operator.value = "contains";
  value.value = "";
  where.value = props.query.whereClause.value;
  open.value = true;
  focus(target.where ? "[data-where] input" : "[data-condition] input");
}

function apply() {
  if (condition.value) {
    try {
      props.query.addFilter(
        condition.value.column,
        condition.value.operator,
        condition.value.value,
      );
    } catch (error) {
      toast.error("Could not filter on this value", {
        description: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    value.value = "";
  }
  if (whereChanged.value) props.query.setWhere(where.value.trim());
  open.value = false;
}

function applyWhere() {
  props.query.setWhere(where.value.trim());
}

function revertWhere(event: KeyboardEvent) {
  if (!whereChanged.value) return;
  event.stopPropagation();
  where.value = props.query.whereClause.value;
}

function clearAll() {
  props.query.clearConditions();
  where.value = "";
  open.value = false;
}

defineExpose({ openFor });
</script>

<template>
  <Popover v-model:open="open" position="bottom-end" content-class-name="w-96 p-3">
    <template #trigger>
      <Button
        size="sm"
        :variant="active ? 'solid' : 'transparent'"
        :outline="active"
        :color="error ? 'red' : undefined"
        content-class-name="gap-1.5"
        aria-haspopup="dialog"
        aria-label="Filter by a column or with SQL"
      >
        <ListFilter :size="13" aria-hidden="true" />
        Filter
      </Button>
    </template>
    <form ref="form" class="flex flex-col gap-3" @submit.prevent="apply">
      <fieldset data-condition class="flex flex-col gap-2">
        <legend class="mb-1 text-cladd-xs text-cladd-fg-soft">A condition on a column</legend>
        <div class="flex gap-2">
          <Select
            v-model="column"
            size="sm"
            class="min-w-0 flex-1"
            aria-label="Column"
            :options="columns.map((name) => ({ value: name, label: name }))"
          />
          <Select
            v-model="operator"
            size="sm"
            class="w-36 shrink-0"
            aria-label="Condition"
            :options="FILTER_OPERATORS.map(({ value, label }) => ({ value, label }))"
          />
        </div>
        <Input v-if="needsValue" v-model="value" size="sm" placeholder="Value" aria-label="Value" />
        <p v-if="condition" class="truncate font-mono text-cladd-2xs text-cladd-fg-soft">
          {{ condition.sql }}
        </p>
      </fieldset>
      <div data-where class="flex flex-col gap-1.5 border-t border-cladd-outline pt-3">
        <span class="flex items-center gap-2 text-cladd-xs text-cladd-fg-soft">
          Or with SQL
          <KeyCaps keys="enter" />
        </span>
        <InputGroup>
          <InputGroupAddon class="font-mono text-2xs text-[var(--fg-subtle)]"
            >WHERE</InputGroupAddon
          >
          <InputGroupInput
            v-model="where"
            class="font-mono"
            placeholder="qty > 3 AND state = 'draft'"
            aria-label="Filter rows with a SQL WHERE clause"
            :valid="!(error && where)"
            spellcheck="false"
            autocomplete="off"
            @keydown.enter.prevent.stop="applyWhere"
            @keydown.esc="revertWhere"
          />
        </InputGroup>
        <FieldError v-if="error && query.whereClause.value">{{ error }}</FieldError>
      </div>
      <div class="flex justify-end gap-1.5">
        <Button
          v-if="active"
          size="sm"
          variant="transparent"
          :outline="false"
          type="button"
          @click="clearAll"
        >
          Clear the filters
        </Button>
        <Button size="sm" variant="solid-fill" color="brand" type="submit" :disabled="!canApply">
          Apply
        </Button>
      </div>
    </form>
  </Popover>
</template>
