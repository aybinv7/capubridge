<script setup lang="ts">
import { Plus } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";

/** Editing an opened file: add a row, and save or drop the changes made so far. */
defineProps<{ pending: number; saving: boolean; note: string | null }>();

const emit = defineEmits<{ addRow: []; discard: []; save: [] }>();
</script>

<template>
  <div
    class="flex shrink-0 items-center gap-2 border-b border-border-subtle px-3 py-1.5"
    role="toolbar"
    aria-label="Changes to the file"
  >
    <Button size="sm" variant="solid" @click="emit('addRow')">
      <Plus :size="14" :stroke-width="1.8" />
      Add a row
    </Button>
    <span v-if="note" class="min-w-0 truncate text-xs text-foreground" role="status">
      {{ note }}
    </span>
    <span v-else class="min-w-0 truncate text-xs text-muted-foreground">
      Double-click a cell to edit. Changes are saved to the file on this computer, together.
    </span>
    <template v-if="pending > 0">
      <span class="ml-auto shrink-0 text-xs text-foreground tabular-nums" role="status">
        {{ pending === 1 ? "1 change not saved" : `${pending} changes not saved` }}
      </span>
      <Button size="sm" variant="transparent" :disabled="saving" @click="emit('discard')">
        Discard
      </Button>
      <Button
        size="sm"
        variant="solid-fill"
        color="brand"
        :loading="saving"
        title="Ctrl+S"
        @click="emit('save')"
      >
        Save changes
      </Button>
    </template>
  </div>
</template>
