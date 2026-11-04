<script setup lang="ts">
import { computed } from "vue";
import { StatusDot } from "@capubridge/cladd";
import type { AppPresence } from "@/lib/gates/presence";

const props = defineProps<{ presence: AppPresence; appName: string }>();

const copy = computed(() => {
  if (props.presence === "view-hidden") {
    return {
      title: `Another view of ${props.appName} is in front`,
      hint: "The screen shows that view, not the selected target.",
    };
  }
  return {
    title: `${props.appName} is in the background`,
    hint: "The screen shows whatever is in front. Bring the app back to inspect it.",
  };
});
</script>

<template>
  <div
    class="mx-2 mb-1.5 flex items-start gap-2 rounded-control bg-surface-2 px-2.5 py-1.5 shadow-bevel"
    role="status"
  >
    <StatusDot color="yellow" class="mt-1.5" />
    <div class="flex min-w-0 flex-col">
      <span class="truncate text-xs text-foreground">{{ copy.title }}</span>
      <span class="text-2xs text-muted-foreground">{{ copy.hint }}</span>
    </div>
  </div>
</template>
