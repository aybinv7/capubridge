<script setup lang="ts">
import { computed, ref } from "vue";
import { Button } from "@capubridge/cladd";
import TextView from "@/shared/code-viewer/TextView.vue";
import { formatBytes } from "../requestCells";
import { base64Lines } from "./bodyContent";
import { NETWORK_WRAP_KEY } from "./bodyViewer";

const props = defineProps<{ base64: string; bytes: number; mime: string; findSignal: number }>();

const emit = defineEmits<{ copyBase64: [] }>();

const shown = ref(false);
const lines = computed(() => (shown.value ? base64Lines(props.base64) : ""));
</script>

<template>
  <TextView
    v-if="shown"
    :text="lines"
    language="plain"
    :find-signal="props.findSignal"
    :wrap-storage-key="NETWORK_WRAP_KEY"
    find-label="Find in the Base64"
    notice="The bytes as Base64, 76 characters a line."
  >
    <template #lead>
      <Button size="sm" variant="transparent" @click="shown = false">Back to summary</Button>
    </template>
  </TextView>
  <div v-else class="flex h-full items-center justify-center p-6">
    <div class="flex max-w-sm flex-col items-center gap-2 text-center" role="status">
      <p class="text-xs text-foreground">This body is not text</p>
      <p class="text-xs text-muted-foreground">
        {{ formatBytes(props.bytes) }} of <span class="font-mono">{{ props.mime }}</span
        >.
      </p>
      <div class="mt-1 flex gap-2">
        <Button size="sm" variant="transparent" @click="emit('copyBase64')">Copy as Base64</Button>
        <Button size="sm" variant="transparent" @click="shown = true">Show as Base64</Button>
      </div>
    </div>
  </div>
</template>
