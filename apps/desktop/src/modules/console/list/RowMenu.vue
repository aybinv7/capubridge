<script setup lang="ts">
import { ContextMenuContent, ContextMenuItem } from "@/components/ui/context-menu";
import type { RowAction } from "./streamView.types";

/** The right-click menu of a row: the same actions an opened row shows. */
const props = defineProps<{ actions: readonly RowAction[] }>();
const emit = defineEmits<{ action: [id: string] }>();
</script>

<template>
  <ContextMenuContent class="min-w-52">
    <ContextMenuItem
      v-for="action in props.actions"
      :key="action.id"
      class="gap-2 text-xs"
      @select="emit('action', action.id)"
    >
      <component :is="action.icon" class="size-3.5 text-muted-foreground" />
      {{ action.label }}
    </ContextMenuItem>
  </ContextMenuContent>
</template>
