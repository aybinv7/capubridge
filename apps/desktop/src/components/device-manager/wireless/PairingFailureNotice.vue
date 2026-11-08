<script setup lang="ts">
import { computed } from "vue";
import { TriangleAlert } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import type { PairingFailure } from "@/types/wireless.types";
import { failureCopy } from "./pairingCopy";

const props = defineProps<{
  reason: PairingFailure;
  detail: string | null;
  retryLabel: string;
  retrying?: boolean;
}>();
const emit = defineEmits<{ retry: [] }>();

const copy = computed(() => failureCopy(props.reason));
</script>

<template>
  <div class="flex flex-col gap-3" role="alert">
    <div class="flex items-start gap-2.5">
      <TriangleAlert class="mt-0.5 size-4 shrink-0 text-warning" :stroke-width="1.8" />
      <div class="flex min-w-0 flex-col gap-1">
        <p class="text-sm font-medium text-foreground">{{ copy.title }}</p>
        <p class="text-xs text-muted-foreground">{{ copy.body }}</p>
      </div>
    </div>
    <ul class="flex flex-col gap-1.5 pl-6.5">
      <li
        v-for="hint in copy.hints"
        :key="hint"
        class="relative text-xs text-muted-foreground before:absolute before:top-1.5 before:-left-3 before:size-1 before:rounded-full before:bg-[var(--fg-subtle)]"
      >
        {{ hint }}
      </li>
    </ul>
    <p
      v-if="props.detail"
      class="ml-6.5 truncate font-mono text-2xs text-[var(--fg-subtle)]"
      :title="props.detail"
    >
      {{ props.detail }}
    </p>
    <div class="pl-6.5">
      <Button
        variant="solid-fill"
        color="brand"
        size="sm"
        :loading="props.retrying"
        @click="emit('retry')"
      >
        {{ props.retryLabel }}
      </Button>
    </div>
  </div>
</template>
