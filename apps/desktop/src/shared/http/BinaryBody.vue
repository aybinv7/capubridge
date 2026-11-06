<script setup lang="ts">
import { computed, ref } from "vue";
import { Button } from "@capubridge/cladd";
import TextView from "@/shared/code-viewer/TextView.vue";
import HexDump from "@/shared/file-viewer/HexDump.vue";
import { formatBytes } from "@/shared/format/numbers";
import { base64Lines } from "./bodyContent";

const props = defineProps<{
  base64: string;
  bytes: number;
  mime: string;
  findSignal: number;
  wrapStorageKey: string;
}>();

const emit = defineEmits<{ copyBase64: [] }>();

const shown = ref<"summary" | "bytes" | "base64">("summary");
const lines = computed(() => (shown.value === "base64" ? base64Lines(props.base64) : ""));
const decoded = computed(() => {
  if (shown.value !== "bytes") return new Uint8Array(0);
  const binary = atob(props.base64);
  const out = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) out[index] = binary.charCodeAt(index);
  return out;
});
</script>

<template>
  <div v-if="shown === 'bytes'" class="flex h-full min-h-0 flex-col bg-surface-cut">
    <div class="flex shrink-0 items-center gap-2 border-b border-border-subtle px-3 py-1.5">
      <Button size="sm" variant="transparent" @click="shown = 'summary'">Back to summary</Button>
      <span class="text-2xs text-muted-foreground">
        {{ formatBytes(props.bytes) }}, 16 bytes a line.
      </span>
    </div>
    <HexDump :bytes="decoded" label="The body's bytes" />
  </div>
  <TextView
    v-else-if="shown === 'base64'"
    :text="lines"
    language="plain"
    :find-signal="props.findSignal"
    :wrap-storage-key="props.wrapStorageKey"
    find-label="Find in the Base64"
    notice="The bytes as Base64, 76 characters a line."
  >
    <template #lead>
      <Button size="sm" variant="transparent" @click="shown = 'summary'">Back to summary</Button>
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
        <Button size="sm" variant="transparent" @click="shown = 'bytes'">Show the bytes</Button>
        <Button size="sm" variant="transparent" @click="shown = 'base64'">Show as Base64</Button>
      </div>
    </div>
  </div>
</template>
