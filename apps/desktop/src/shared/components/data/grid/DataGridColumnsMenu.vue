<script setup lang="ts">
import { computed, ref } from "vue";
import { Columns3 } from "lucide-vue-next";
import { Button, Checkbox, Popover } from "@capubridge/cladd";
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
</script>

<template>
  <Popover position="bottom-end" content-class-name="w-64 p-1">
    <template #trigger>
      <Button size="sm" variant="transparent" :outline="false" content-class-name="gap-1.5">
        <Columns3 :size="13" aria-hidden="true" />
        Columns
        <span v-if="hiddenCount > 0" class="tabular-nums text-muted-foreground">
          {{ columns.length - hiddenCount }}/{{ columns.length }}
        </span>
      </Button>
    </template>
    <div class="flex flex-col gap-1">
      <input
        v-if="columns.length > 8"
        v-model="query"
        type="search"
        placeholder="Find a column…"
        aria-label="Find a column"
        class="h-7 rounded-md bg-[var(--bg-surface-cut)] px-2 text-xs text-foreground shadow-cut outline-none placeholder:text-[var(--fg-subtle)] focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
      />
      <div class="max-h-72 overflow-auto">
        <label
          v-for="column in listed"
          :key="column.id"
          class="flex h-7 w-full cursor-default items-center gap-2 rounded-md px-2 text-xs hover:bg-[var(--bg-surface-raised)]"
        >
          <Checkbox
            as="span"
            size="xs"
            :model-value="visibility[column.id] !== false"
            @update:model-value="setVisible(column.id, $event)"
          />
          <span class="truncate font-mono">{{ column.title }}</span>
          <span v-if="column.typeLabel" class="ml-auto truncate text-2xs text-[var(--fg-subtle)]">
            {{ column.typeLabel }}
          </span>
        </label>
      </div>
      <Button
        v-if="hiddenCount > 0"
        size="sm"
        variant="transparent"
        :outline="false"
        @click="showAll"
      >
        Show all columns
      </Button>
    </div>
  </Popover>
</template>
