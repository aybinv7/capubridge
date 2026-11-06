<script setup lang="ts">
import { Trash2 } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";

/**
 * The foot of every Data pane, the same in each tab: a quiet delete on the left that names
 * what it deletes (red only on the confirmation it opens), a status line, then the pane's own
 * actions on the right, where at most one is the accented primary (Save, Open).
 */
const props = defineProps<{
  /** "Delete key…", "Delete entry…"; no delete button when absent. */
  deleteLabel?: string | null;
  /** Why the delete cannot run now, shown on hover; disables it. */
  deleteReason?: string | null;
  deleteDisabled?: boolean;
  busy?: boolean;
}>();

const emit = defineEmits<{ delete: [] }>();

defineSlots<{ status?: () => unknown; actions?: () => unknown }>();
</script>

<template>
  <footer class="flex shrink-0 items-center gap-2 border-t border-border-subtle px-3 py-2">
    <HintTooltip v-if="props.deleteLabel" :text="props.deleteReason ?? null">
      <Button
        size="sm"
        variant="transparent"
        content-class-name="gap-1.5"
        :disabled="Boolean(props.deleteReason) || props.deleteDisabled"
        :loading="props.busy"
        @click="emit('delete')"
      >
        <Trash2 :size="12" aria-hidden="true" />
        {{ props.deleteLabel }}
      </Button>
    </HintTooltip>
    <span class="min-w-0 flex-1 truncate text-2xs">
      <slot name="status" />
    </span>
    <slot name="actions" />
  </footer>
</template>
