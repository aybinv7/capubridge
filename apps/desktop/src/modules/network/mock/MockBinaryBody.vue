<script setup lang="ts">
import { computed } from "vue";
import { Button } from "@capubridge/cladd";
import { base64ByteLength } from "@/lib/base64";
import { formatBytes } from "../requests/requestCells";

const props = defineProps<{ base64: string; contentType: string }>();

const emit = defineEmits<{ replace: [] }>();

const size = computed(() => formatBytes(base64ByteLength(props.base64)));
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-3 rounded-control bg-surface-cut px-3 py-2.5 shadow-cut"
  >
    <p class="min-w-0 flex-1 text-xs text-muted-foreground">
      Answers with {{ size }} of
      <span class="font-mono">{{ props.contentType || "binary data" }}</span
      >, kept exactly as the server sent it. Binary data cannot be edited as text.
    </p>
    <Button size="sm" variant="transparent" class="shrink-0" @click="emit('replace')">
      Write a text body instead
    </Button>
  </div>
</template>
