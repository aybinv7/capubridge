<script setup lang="ts">
import { computed } from "vue";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-vue-next";
import { Badge } from "@/components/ui/badge";
import type { MoveDirection, StepRow as StepRowData } from "./stepRowModel";

const props = defineProps<{
  row: StepRowData;
  depth: number;
  selected: boolean;
  isRunning: boolean;
  /** False while a run is executing or a recorded run is open; structure is read-only then. */
  canEdit: boolean;
}>();

const emit = defineEmits<{
  select: [stepId: string];
  move: [stepId: string, direction: MoveDirection];
  delete: [stepId: string];
}>();

/**
 * Keyboard structure editing, so reordering does not require a pointer.
 * Alt is the modifier because a bare arrow belongs to list navigation.
 * Produced rows (depth 1) are run artifacts and are never editable.
 */
function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    emit("select", props.row.stepId);
    return;
  }
  if (!canEditRow.value) {
    return;
  }
  if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
    event.preventDefault();
    emit("move", props.row.stepId, event.key === "ArrowUp" ? "up" : "down");
    return;
  }
  if (event.key === "Delete") {
    event.preventDefault();
    emit("delete", props.row.stepId);
  }
}

const strengthVariant: Record<string, string> = {
  strong: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  fair: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  weak: "bg-red-500/15 text-red-700 dark:text-red-400",
};

/** A produced row belongs to a goal's run output, so it never edits the flow. */
const canEditRow = computed(() => props.canEdit && props.depth === 0);

function outcomeClass(outcome: string | null): string {
  if (outcome === "ok") {
    return "text-emerald-600 dark:text-emerald-400";
  }
  if (outcome === "failed") {
    return "text-red-600 dark:text-red-400";
  }
  return "text-muted-foreground";
}
</script>

<template>
  <div
    role="button"
    tabindex="0"
    class="group flex h-10 w-full items-center gap-2 border-b border-border/20 px-3 text-left text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
    :class="[selected ? 'bg-brand-soft border-brand/30' : '', depth === 1 ? 'pl-8' : '']"
    @click="emit('select', row.stepId)"
    @keydown="onKeydown"
  >
    <span class="w-8 shrink-0 tabular-nums text-muted-foreground">
      {{ row.index + 1 }}
    </span>

    <Badge variant="outline" class="shrink-0 px-1.5 py-0 text-xs">
      {{ row.operation }}
    </Badge>

    <span
      v-if="row.targetStrength !== null"
      class="shrink-0 rounded px-1 py-0 text-xs"
      :class="strengthVariant[row.targetStrength] ?? ''"
    >
      {{ row.targetStrength }}
    </span>

    <span class="min-w-0 flex-1 truncate text-muted-foreground">
      {{ row.targetSummary }}
    </span>

    <span
      v-if="row.isGoal && row.nestedRows.length > 0"
      class="shrink-0 text-xs text-muted-foreground"
    >
      {{ row.nestedRows.length }} steps
    </span>

    <span
      v-if="row.confidence !== null"
      class="shrink-0 tabular-nums text-xs text-muted-foreground"
    >
      {{ row.confidence.toFixed(2) }}
    </span>

    <span v-if="row.outcome !== null" class="shrink-0 text-xs" :class="outcomeClass(row.outcome)">
      {{ row.outcome }}
    </span>

    <span
      v-if="row.verificationStatus === 'unverified'"
      class="shrink-0 rounded bg-amber-500/15 px-1 py-0 text-xs text-amber-700 dark:text-amber-400"
      title="The command was dispatched, but the next observation did not prove a screen transition"
    >
      unverified
    </span>

    <span
      v-if="row.error !== null"
      class="max-w-32 shrink-0 truncate text-xs text-destructive"
      :title="row.error"
    >
      {{ row.error }}
    </span>

    <span
      v-if="isRunning && row.outcome === null"
      class="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent"
    />

    <span
      v-if="canEditRow"
      class="ml-1 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      :class="selected ? 'opacity-100' : ''"
    >
      <button
        type="button"
        class="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Move step up (Alt+Up)"
        aria-label="Move step up"
        @click.stop="emit('move', row.stepId, 'up')"
      >
        <ArrowUp :size="13" />
      </button>
      <button
        type="button"
        class="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Move step down (Alt+Down)"
        aria-label="Move step down"
        @click.stop="emit('move', row.stepId, 'down')"
      >
        <ArrowDown :size="13" />
      </button>
      <button
        type="button"
        class="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        title="Delete step (Delete)"
        aria-label="Delete step"
        @click.stop="emit('delete', row.stepId)"
      >
        <Trash2 :size="13" />
      </button>
    </span>
  </div>
</template>
