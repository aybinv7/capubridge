<script setup lang="ts" generic="Id extends string">
import { computed } from "vue";
import { Columns3 } from "lucide-vue-next";
import { Button, Checkbox, Popover } from "@capubridge/cladd";
import type { ListColumn } from "./listColumns";

/**
 * Shows or hides a list's columns. A column people asked for that is hidden for now says why:
 * the context hides it (the waterfall while the details are open) or the list is too narrow.
 */
const props = defineProps<{
  columns: readonly ListColumn<Id>[];
  isHidden: (id: Id) => boolean;
  dropped: ReadonlySet<Id>;
  reasons: Partial<Record<Id, string>>;
}>();

const emit = defineEmits<{ toggle: [id: Id, visible: boolean]; showAll: [] }>();

const listed = computed(() =>
  props.columns.filter((column) => !column.flex && column.hideable !== false && !column.action),
);
const hiddenCount = computed(
  () => listed.value.filter((column) => props.isHidden(column.id)).length,
);

function note(id: Id): string | null {
  if (props.isHidden(id)) return null;
  return props.reasons[id] ?? (props.dropped.has(id) ? "No room" : null);
}
</script>

<template>
  <Popover position="bottom-end" class="w-64" content-class-name="p-1.5">
    <template #trigger>
      <Button
        size="sm"
        variant="transparent"
        :outline="false"
        content-class-name="gap-1.5"
        class="text-muted-foreground hover:text-foreground"
      >
        <Columns3 :size="13" aria-hidden="true" />
        Columns
        <span v-if="hiddenCount > 0" class="text-[var(--fg-subtle)] tabular-nums">
          {{ listed.length - hiddenCount }}/{{ listed.length }}
        </span>
      </Button>
    </template>
    <div class="flex flex-col gap-1.5">
      <ul class="flex flex-col" aria-label="Columns">
        <li v-for="column in listed" :key="column.id">
          <label
            class="flex h-7 w-full cursor-default items-center gap-2.5 rounded-cladd-sm px-2 text-xs hover:bg-cladd-surface-hover"
          >
            <Checkbox
              as="span"
              size="xs"
              :model-value="!props.isHidden(column.id)"
              @update:model-value="emit('toggle', column.id, $event === true)"
            />
            <span
              class="min-w-0 flex-1 truncate"
              :class="props.isHidden(column.id) ? 'text-muted-foreground' : 'text-foreground'"
              >{{ column.label }}</span
            >
            <span v-if="note(column.id)" class="shrink-0 truncate text-2xs text-[var(--fg-subtle)]">
              {{ note(column.id) }}
            </span>
          </label>
        </li>
      </ul>
      <div
        class="flex items-center justify-between gap-2 border-t border-border-subtle px-1 pt-1.5"
      >
        <span class="text-2xs text-[var(--fg-subtle)]">Drag a header edge to resize</span>
        <Button
          size="xs"
          variant="transparent"
          :outline="false"
          :disabled="hiddenCount === 0"
          @click="emit('showAll')"
        >
          Show all
        </Button>
      </div>
    </div>
  </Popover>
</template>
