<script setup lang="ts">
import { computed, watch } from "vue";
import { useDocumentVisibility, useNow } from "@vueuse/core";
import { ListButton, StatusDot } from "@capubridge/cladd";
import { formatAge } from "@/modules/storage/frame/changeWords";
import type { SqliteChangeSummary } from "@/types/sqliteChanges.types";

/**
 * What the app changed while this database was watched, newest first, from the change index the
 * 5 s check already keeps (no read of its own). A table opens with a click.
 */
const props = defineProps<{
  changed: readonly { table: string; summary: SqliteChangeSummary }[];
  watched: boolean;
}>();

const emit = defineEmits<{ open: [table: string] }>();

const visibility = useDocumentVisibility();
const { now, pause, resume } = useNow({ interval: 5000, controls: true });
watch(visibility, (state) => (state === "hidden" ? pause() : resume()), { immediate: true });

const rows = computed(() =>
  props.changed.map((entry) => {
    const at = entry.summary.latestAt ? Date.parse(entry.summary.latestAt) : Number.NaN;
    return {
      ...entry,
      age: Number.isNaN(at) ? "" : formatAge(now.value.getTime() - at),
    };
  }),
);
</script>

<template>
  <section class="flex flex-col gap-1.5" aria-label="Changed while watched">
    <h3 class="text-2xs font-medium text-[var(--fg-subtle)]">Changed while watched</h3>
    <p v-if="!watched" class="text-xs text-muted-foreground">
      A file opened here is not watched; Read again compares it.
    </p>
    <p v-else-if="rows.length === 0" class="flex items-center gap-2 text-xs text-muted-foreground">
      <StatusDot variant="hollow" size="xs" /> Nothing changed since it was opened
    </p>
    <ListButton
      v-for="row in rows"
      :key="row.table"
      size="sm"
      class="w-full"
      content-class-name="gap-2 px-2"
      @click="emit('open', row.table)"
    >
      <span class="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{{ row.table }}</span>
      <span class="flex shrink-0 gap-1.5 font-mono text-2xs tabular-nums">
        <span v-if="row.summary.add" class="text-success">+{{ row.summary.add }}</span>
        <span v-if="row.summary.update" class="text-warning">~{{ row.summary.update }}</span>
        <span v-if="row.summary.delete" class="text-error">−{{ row.summary.delete }}</span>
      </span>
      <span class="w-16 shrink-0 text-right text-2xs text-[var(--fg-subtle)]">{{ row.age }}</span>
    </ListButton>
  </section>
</template>
