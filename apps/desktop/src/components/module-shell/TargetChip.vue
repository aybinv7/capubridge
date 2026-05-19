<script setup lang="ts">
import type { TabScope } from "@/types/tabs.types";
import { Smartphone, FileVideo, Circle } from "lucide-vue-next";

const props = defineProps<{
  scope: TabScope;
  /** "online" | "offline" | "unauthorized" | etc. — purely visual. */
  status?: string | null;
}>();

function statusColor(status: string | null | undefined) {
  if (status === "online") return "var(--state-success)";
  if (status === "unauthorized") return "var(--state-warning)";
  if (status === "offline") return "var(--state-danger)";
  return "var(--fg-subtle)";
}

function label(): string {
  switch (props.scope.kind) {
    case "target":
      return props.scope.webviewId
        ? `${props.scope.serial} / ${props.scope.webviewId}`
        : props.scope.serial;
    case "recording":
      return props.scope.capuPath.split(/[/\\]/).pop() ?? props.scope.capuPath;
    case "singleton":
      return "—";
  }
}
</script>

<template>
  <span
    class="inline-flex h-6 max-w-[280px] items-center gap-1.5 truncate rounded-md border border-[var(--border-default)] bg-[var(--bg-surface-raised)] px-2 text-xs text-[var(--fg-default)]"
    :title="label()"
  >
    <Smartphone v-if="scope.kind === 'target'" :size="11" class="shrink-0 text-[var(--fg-muted)]" />
    <FileVideo
      v-else-if="scope.kind === 'recording'"
      :size="11"
      class="shrink-0 text-[var(--fg-muted)]"
    />
    <span class="truncate">{{ label() }}</span>
    <Circle
      v-if="scope.kind === 'target'"
      :size="7"
      :stroke-width="0"
      :fill="statusColor(status)"
      class="shrink-0"
      aria-hidden="true"
    />
  </span>
</template>
