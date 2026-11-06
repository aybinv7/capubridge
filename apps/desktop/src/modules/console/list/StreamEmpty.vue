<script setup lang="ts">
import { ref } from "vue";
import { Link } from "@capubridge/cladd";

/**
 * An empty or failed list said plainly: what is going on, what to do, and (for errors) the raw
 * detail on demand. Actions come through the default slot.
 */
const props = defineProps<{
  title: string;
  detail?: string | null;
  raw?: string | null;
  tone?: "neutral" | "error";
}>();

const showRaw = ref(false);
</script>

<template>
  <div class="flex min-h-0 flex-1 items-center justify-center p-4">
    <div class="flex max-w-md flex-col items-center gap-1.5 text-center">
      <p class="text-sm" :class="props.tone === 'error' ? 'text-error' : 'text-foreground'">
        {{ props.title }}
      </p>
      <p v-if="props.detail" class="text-xs text-muted-foreground">{{ props.detail }}</p>
      <div v-if="$slots.default" class="mt-1 flex flex-wrap items-center justify-center gap-2">
        <slot />
      </div>
      <template v-if="props.raw">
        <Link class="mt-1 text-2xs" @click="showRaw = !showRaw">
          {{ showRaw ? "Hide the details" : "Show the details" }}
        </Link>
        <pre
          v-if="showRaw"
          class="max-h-32 w-full overflow-auto rounded-inner bg-surface-cut p-2 text-left font-mono text-2xs whitespace-pre-wrap text-muted-foreground shadow-cut"
          >{{ props.raw }}</pre
        >
      </template>
    </div>
  </div>
</template>
