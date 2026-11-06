<script setup lang="ts">
import { Button } from "@capubridge/cladd";
import type { RowAction } from "./streamView.types";

/** The quiet action row at the foot of an opened row; the row menu offers the same list. */
const props = defineProps<{ actions: readonly RowAction[] }>();
const emit = defineEmits<{ action: [id: string] }>();
</script>

<template>
  <div v-if="props.actions.length > 0" class="flex flex-wrap items-center gap-1">
    <Button
      v-for="action in props.actions"
      :key="action.id"
      size="xs"
      variant="transparent"
      :outline="false"
      class="text-muted-foreground hover:text-foreground"
      content-class-name="gap-1.5"
      @click="emit('action', action.id)"
    >
      <component :is="action.icon" class="size-3" />
      {{ action.label }}
    </Button>
  </div>
</template>
