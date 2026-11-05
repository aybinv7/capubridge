<script setup lang="ts">
import { computed } from "vue";
import { X } from "lucide-vue-next";
import { StatusDot } from "@capubridge/cladd";
import type { AppPresence } from "@/lib/gates/presence";
import IconAction from "@/shared/components/presentation/IconAction.vue";

const props = defineProps<{ presence: AppPresence; appName: string }>();

const emit = defineEmits<{ dismiss: [] }>();

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
    class="mx-2 mb-1.5 flex items-start gap-2 rounded-control bg-surface-2 py-1.5 pr-1 pl-2.5 shadow-bevel"
    role="status"
  >
    <StatusDot color="yellow" class="mt-1.5" />
    <div class="flex min-w-0 flex-1 flex-col">
      <span class="truncate text-xs text-foreground">{{ copy.title }}</span>
      <span class="text-2xs text-muted-foreground">{{ copy.hint }}</span>
    </div>
    <IconAction
      label="Dismiss"
      hint="Shows again the next time the app leaves the screen"
      size="sm"
      position="bottom"
      class="shrink-0"
      @click="emit('dismiss')"
    >
      <X :stroke-width="1.8" />
    </IconAction>
  </div>
</template>
