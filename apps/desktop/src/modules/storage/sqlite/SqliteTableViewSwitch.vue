<script setup lang="ts">
import { Segmented, SegmentedButton } from "@capubridge/cladd";
import type { SqliteTableView } from "./useSqliteLocation";

/** Rows · Structure · SQL of one table. */
defineProps<{ view: SqliteTableView }>();

const emit = defineEmits<{ setView: [view: SqliteTableView] }>();
</script>

<template>
  <Segmented size="xs" active-variant="solid" aria-label="What to show of the table">
    <SegmentedButton :active="view === 'rows'" @click="emit('setView', 'rows')"
      >Rows</SegmentedButton
    >
    <SegmentedButton :active="view === 'structure'" @click="emit('setView', 'structure')">
      Structure
    </SegmentedButton>
    <SegmentedButton :active="view === 'sql'" @click="emit('setView', 'sql')">SQL</SegmentedButton>
  </Segmented>
</template>
