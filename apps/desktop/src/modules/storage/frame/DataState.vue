<script setup lang="ts">
import { computed } from "vue";
import { Button, Spinner, StatusDot } from "@capubridge/cladd";
import { CircleAlert } from "lucide-vue-next";

/**
 * The one way a Data pane says it is loading, empty, failed or waiting for the app. Errors
 * always carry the device's own words and a way to try again.
 */
const props = withDefaults(
  defineProps<{
    kind: "loading" | "empty" | "error" | "waiting";
    title: string;
    text?: string;
    detail?: string | null;
    compact?: boolean;
  }>(),
  { text: undefined, detail: null, compact: false },
);

const emit = defineEmits<{ retry: [] }>();

defineSlots<{ default?: () => unknown }>();

const role = computed(() => (props.kind === "error" ? "alert" : "status"));
</script>

<template>
  <div
    :role="role"
    class="flex flex-col"
    :class="
      compact
        ? 'gap-2 px-4 py-4'
        : 'h-full min-h-0 items-center justify-center gap-3 px-8 py-10 text-center'
    "
  >
    <div class="flex items-center gap-2" :class="compact ? '' : 'justify-center'">
      <Spinner v-if="kind === 'loading'" size="xs" />
      <CircleAlert
        v-else-if="kind === 'error'"
        :size="14"
        class="shrink-0 text-error"
        aria-hidden="true"
      />
      <StatusDot v-else-if="kind === 'waiting'" color="yellow" variant="hollow" />
      <p class="text-sm text-foreground" :class="compact && 'text-xs'">{{ title }}</p>
    </div>
    <p v-if="text" class="max-w-md text-xs text-muted-foreground" :class="compact ? '' : 'mx-auto'">
      {{ text }}
    </p>
    <p
      v-if="detail"
      class="max-w-md rounded-inner bg-surface-cut px-2 py-1.5 font-mono text-2xs break-words text-muted-foreground shadow-cut select-text"
      :class="compact ? '' : 'mx-auto text-left'"
    >
      {{ detail }}
    </p>
    <div class="flex items-center gap-2" :class="compact ? '' : 'justify-center'">
      <Button v-if="kind === 'error'" size="sm" variant="transparent" @click="emit('retry')">
        Try again
      </Button>
      <slot />
    </div>
  </div>
</template>
