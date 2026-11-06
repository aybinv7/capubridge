<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { ListFilter, X } from "lucide-vue-next";
import {
  Button,
  FieldError,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Select,
} from "@capubridge/cladd";
import { toast } from "@/lib/toast";
import KeyCaps from "@/components/command/KeyCaps.vue";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { FILTER_OPERATORS, chipLabel } from "./sqliteFilters";
import { columnFilter, type ColumnFilterOperator } from "./sqliteQuery";
import type { SqliteTableQuery } from "./useSqliteTableQuery";

/**
 * Filtering beyond the search: the Filter button opens a row under the toolbar (no overlay, so
 * its menus never close it) with one condition on a column (it becomes a chip) and a SQL WHERE
 * clause for anything else. Apply adds the condition and applies the WHERE; Enter in the WHERE
 * applies it, Esc puts back the applied one, then closes the row. A WHERE the database refuses
 * shows its words here.
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

function onPanelKeydown(event: KeyboardEvent) {
  if (event.key !== "Escape" || event.defaultPrevented) return;
  event.preventDefault();
  open.value = false;
}

function toggle() {
  if (open.value) open.value = false;
  else openFor();
}

function clearAll() {
  props.query.clearConditions();
  where.value = "";
  open.value = false;
}

defineExpose({ openFor });
</script>

<template>
  <Button
    size="sm"
    :variant="active || open ? 'solid' : 'transparent'"
    :outline="active"
    :color="error ? 'red' : undefined"
    content-class-name="gap-1.5"
    :aria-expanded="open"
    aria-label="Filter by a column or with SQL"
    @click="toggle"
  >
    <ListFilter :size="13" aria-hidden="true" />
    Filter
  </Button>
  <Transition
    enter-active-class="transition-[opacity,translate] duration-300 ease-cladd-spring motion-reduce:transition-none"
    leave-active-class="transition-[opacity,translate] duration-150 ease-in motion-reduce:transition-none"
    enter-from-class="-translate-y-2 opacity-0"
    leave-to-class="-translate-y-1 opacity-0"
  >
    <div
      v-if="open"
      ref="form"
      role="form"
      class="order-last flex basis-full flex-wrap items-end gap-x-3 gap-y-2 rounded-well bg-surface-cut px-3 py-2.5 shadow-cut"
      aria-label="Filter the rows"
      @keydown="onPanelKeydown"
    >
      <fieldset data-condition class="flex min-w-0 flex-[2_1_28rem] flex-col gap-1.5">
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
            class="w-40 shrink-0"
            aria-label="Condition"
            :options="FILTER_OPERATORS.map(({ value, label }) => ({ value, label }))"
          />
          <Input
            v-if="needsValue"
            v-model="value"
            size="sm"
            class="min-w-0 flex-1"
            placeholder="Value"
            aria-label="Value"
            @keydown.enter.prevent="apply"
          />
        </div>
      </fieldset>
      <div data-where class="flex min-w-0 flex-[2_1_22rem] flex-col gap-1.5">
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
      </div>
      <div class="flex shrink-0 items-center gap-1.5">
        <Button
          v-if="active"
          size="sm"
          variant="transparent"
          :outline="false"
          type="button"
          @click="clearAll"
        >
          Clear
        </Button>
        <Button
          size="sm"
          variant="solid-fill"
          color="brand"
          type="button"
          :disabled="!canApply"
          @click="apply"
        >
          Apply
        </Button>
        <IconAction label="Close the filter" keys="escape" size="sm" @click="open = false">
          <X :stroke-width="1.8" />
        </IconAction>
      </div>
      <p v-if="condition" class="basis-full truncate font-mono text-cladd-2xs text-cladd-fg-soft">
        {{ condition.sql }}
      </p>
      <FieldError v-if="error && query.whereClause.value" class="basis-full">{{
        error
      }}</FieldError>
    </div>
  </Transition>
</template>
