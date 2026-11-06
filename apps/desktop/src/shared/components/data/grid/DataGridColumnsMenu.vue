<script setup lang="ts">
import { computed, ref } from "vue";
import { Columns3 } from "lucide-vue-next";
import { Button, Checkbox, Popover, SearchField } from "@capubridge/cladd";
import type { GridColumn } from "./types";

const props = defineProps<{
  columns: readonly GridColumn[];
  /** Hidden columns map to `false`; absent ids are visible. */
  visibility: Readonly<Record<string, boolean>>;
}>();

const emit = defineEmits<{ "update:visibility": [visibility: Record<string, boolean>] }>();

const query = ref("");
const hiddenCount = computed(
  () => props.columns.filter((column) => props.visibility[column.id] === false).length,
);
const listed = computed(() => {
  const needle = query.value.trim().toLowerCase();
  return needle
    ? props.columns.filter((column) => column.title.toLowerCase().includes(needle))
    : props.columns;
});

function setVisible(id: string, visible: boolean) {
  const next = { ...props.visibility };
  if (visible) delete next[id];
  else next[id] = false;
  emit("update:visibility", next);
}

function showAll() {
  emit("update:visibility", {});
}

function hideAllButFirst() {
  const next: Record<string, boolean> = {};
  props.columns.slice(1).forEach((column) => {
    next[column.id] = false;
  });
  emit("update:visibility", next);
}

/** A column's type, short: `TIMESTAMP WITH TIME ZONE` reads `TIMESTAMP`. */
function shortType(label: string | undefined): string {
  if (!label) return "";
  const first = label.split(/[\s(]/, 1)[0] ?? label;
  return first.length > 9 ? `${first.slice(0, 8)}…` : first;
}
</script>

<template>
  <Popover position="bottom-end" class="w-80" content-class-name="p-1.5">
    <template #trigger>
      <Button size="sm" variant="transparent" :outline="false" content-class-name="gap-1.5">
        <Columns3 :size="13" aria-hidden="true" />
        Columns
        <span v-if="hiddenCount > 0" class="tabular-nums text-muted-foreground">
          {{ columns.length - hiddenCount }}/{{ columns.length }}
        </span>
      </Button>
    </template>
    <div class="flex flex-col gap-1.5">
      <SearchField
        v-if="columns.length > 8"
        v-model="query"
        size="sm"
        placeholder="Find a column"
        aria-label="Find a column"
      />
      <ul class="flex max-h-80 flex-col overflow-y-auto" aria-label="Columns">
        <li v-for="column in listed" :key="column.id">
          <label
            class="flex h-7 w-full cursor-default items-center gap-2.5 rounded-cladd-sm px-2 text-xs hover:bg-cladd-surface-hover"
          >
            <Checkbox
              as="span"
              size="xs"
              :model-value="visibility[column.id] !== false"
              @update:model-value="setVisible(column.id, $event)"
            />
            <span
              class="min-w-0 flex-1 truncate font-mono"
              :class="visibility[column.id] === false ? 'text-muted-foreground' : 'text-foreground'"
              :title="column.title"
              >{{ column.title }}</span
            >
            <span
              v-if="column.typeLabel"
              class="shrink-0 font-mono text-2xs tracking-wide text-[var(--fg-subtle)] uppercase"
              >{{ shortType(column.typeLabel) }}</span
            >
          </label>
        </li>
        <li v-if="listed.length === 0" class="px-2 py-1.5 text-xs text-muted-foreground">
          No column matches
        </li>
      </ul>
      <div
        class="flex items-center justify-between gap-2 border-t border-border-subtle px-1 pt-1.5"
      >
        <span class="text-2xs text-[var(--fg-subtle)] tabular-nums">
          {{ columns.length - hiddenCount }} of {{ columns.length }} shown
        </span>
        <span class="flex gap-1">
          <Button size="xs" variant="transparent" :outline="false" @click="hideAllButFirst">
            Hide all
          </Button>
          <Button
            size="xs"
            variant="transparent"
            :outline="false"
            :disabled="hiddenCount === 0"
            @click="showAll"
          >
            Show all
          </Button>
        </span>
      </div>
    </div>
  </Popover>
</template>
